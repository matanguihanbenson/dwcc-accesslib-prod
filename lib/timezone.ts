/**
 * Asia/Manila-aware date helpers.
 *
 * The Prisma/MySQL connection in `lib/prisma.ts` pins the database
 * session to `+08:00` so every DATETIME value in the DB is interpreted
 * as Philippine local time. The Node server, however, often runs in
 * UTC on hosted environments. That mismatch made the analytics APIs
 * compute "today" / "this week" / "this month" / "peak hour" in the
 * server's local time, which is up to 8 hours off from what the
 * Philippines-based staff and admins see on the dashboard.
 *
 * The helpers here always interpret the calendar components
 * (year/month/day/hour/weekday) in Asia/Manila and return UTC
 * `Date` objects that are safe to use directly in Prisma `gte`/`lt`
 * filters. Every dashboard / report endpoint that needs "today" or
 * "this week" should funnel through these helpers instead of calling
 * `new Date()` and `setHours(0, 0, 0, 0)` directly.
 *
 * Hardcoded to Asia/Manila because the app is single-tenant and the
 * Prisma connection string is already locked to `+08:00`.
 */

/** IANA timezone used for all calendar-component interpretation. */
export const TIMEZONE = 'Asia/Manila' as const

export type DateParts = {
  year: number
  /** 1-12, matching `Intl.DateTimeFormat` output (not JS Date's 0-11). */
  month: number
  day: number
  /** 0-23, always local time in `tz`. */
  hour: number
  minute: number
  second: number
  /** 0 (Sunday) - 6 (Saturday), matching JS `Date.getDay()`. */
  weekday: number
}

const PARTS_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>()

function getPartsFormatter(tz: string): Intl.DateTimeFormat {
  let f = PARTS_FORMATTER_CACHE.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'short',
    })
    PARTS_FORMATTER_CACHE.set(tz, f)
  }
  return f
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

/**
 * Return the calendar components of `date` as they appear in `tz`.
 * Uses `Intl.DateTimeFormat` so the answer is independent of the
 * server's local timezone.
 */
export function getDatePartsInTz(date: Date, tz: string = TIMEZONE): DateParts {
  const parts = getPartsFormatter(tz).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((p) => p.type === type)
    if (!part) {
      throw new Error(`Missing Intl.DateTimeFormat part: ${type}`)
    }
    if (type === 'weekday') {
      const idx = WEEKDAY_INDEX[part.value]
      if (idx === undefined) {
        throw new Error(`Unknown weekday: ${part.value}`)
      }
      return idx
    }
    return parseInt(part.value, 10)
  }
  // `hour12: false` formats midnight as "24" in some Node versions; normalise to 0.
  const rawHour = get('hour')
  const hour = rawHour === 24 ? 0 : rawHour
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour,
    minute: get('minute'),
    second: get('second'),
    weekday: get('weekday'),
  }
}

/**
 * Offset (in ms) between `tz` and UTC at the moment `date` represents.
 *
 *   PH (UTC+8, no DST): returns 8 * 60 * 60 * 1000
 *   NY in summer  (UTC-4): returns -4 * 60 * 60 * 1000
 *
 * Useful for converting a Y-M-D h:m:s wall-clock value in `tz` into a
 * UTC `Date`. Input is floored to whole seconds because
 * `Intl.DateTimeFormat` parts do not include milliseconds, so
 * reconstructing without rounding can shift the computed offset by
 * up to 999 ms and break end-of-day boundary checks.
 */
export function getTzOffsetMs(date: Date, tz: string = TIMEZONE): number {
  const secondMs = Math.floor(date.getTime() / 1000) * 1000
  const parts = getDatePartsInTz(new Date(secondMs), tz)
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )
  return asUtc - secondMs
}

/**
 * UTC `Date` that represents 00:00:00.000 of the Y-M-D wall-clock day
 * in `tz`. Use as `gte` in a Prisma range filter.
 */
export function startOfDayInTz(
  year: number,
  month: number,
  day: number,
  tz: string = TIMEZONE
): Date {
  const asIfUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0)
  const offset = getTzOffsetMs(new Date(asIfUtc), tz)
  return new Date(asIfUtc - offset)
}

/**
 * UTC `Date` that represents 23:59:59.999 of the Y-M-D wall-clock day
 * in `tz`. Use as `lte` in a Prisma range filter.
 */
export function endOfDayInTz(
  year: number,
  month: number,
  day: number,
  tz: string = TIMEZONE
): Date {
  const asIfUtc = Date.UTC(year, month - 1, day, 23, 59, 59, 999)
  const offset = getTzOffsetMs(new Date(asIfUtc), tz)
  return new Date(asIfUtc - offset)
}

/**
 * Start of the wall-clock day in `tz` that contains `date`. Pure
 * date-arithmetic — does not mutate the input.
 */
export function startOfDayForDateInTz(date: Date, tz: string = TIMEZONE): Date {
  const p = getDatePartsInTz(date, tz)
  return startOfDayInTz(p.year, p.month, p.day, tz)
}

/**
 * End of the wall-clock day in `tz` that contains `date`.
 */
export function endOfDayForDateInTz(date: Date, tz: string = TIMEZONE): Date {
  const p = getDatePartsInTz(date, tz)
  return endOfDayInTz(p.year, p.month, p.day, tz)
}

/**
 * `{ start, end }` range for "today" in `tz` (start inclusive, end
 * inclusive, end-of-day).  The `end` is set to 23:59:59.999 so it
 * can be used with `lte`; pair it with `lt` (start of next day) if
 * you prefer the half-open form.
 */
export function getTodayRangeInTz(
  tz: string = TIMEZONE,
  now: Date = new Date()
): { start: Date; end: Date } {
  const p = getDatePartsInTz(now, tz)
  return {
    start: startOfDayInTz(p.year, p.month, p.day, tz),
    end: endOfDayInTz(p.year, p.month, p.day, tz),
  }
}

/**
 * Start of the calendar month in `tz` that contains `date`.
 */
export function startOfMonthInTz(date: Date, tz: string = TIMEZONE): Date {
  const p = getDatePartsInTz(date, tz)
  return startOfDayInTz(p.year, p.month, 1, tz)
}

/**
 * Start of the Sunday-start week in `tz` that contains `date`.
 */
export function startOfWeekInTz(date: Date, tz: string = TIMEZONE): Date {
  const p = getDatePartsInTz(date, tz)
  const start = startOfDayInTz(p.year, p.month, p.day, tz)
  start.setUTCDate(start.getUTCDate() - p.weekday)
  return start
}

/**
 * Start of the calendar year in `tz` that contains `date`.
 */
export function startOfYearInTz(date: Date, tz: string = TIMEZONE): Date {
  const p = getDatePartsInTz(date, tz)
  return startOfDayInTz(p.year, 1, 1, tz)
}

/**
 * Wall-clock hour (0-23) of `date` in `tz`. Use this instead of
 * `date.getHours()`, which is timezone-of-the-server and so produces
 * the wrong peak-hour for the analytics dashboard when the server
 * is in UTC.
 */
export function getHourInTz(date: Date, tz: string = TIMEZONE): number {
  return getDatePartsInTz(date, tz).hour
}

/**
 * Localised weekday short label (e.g. "Mon", "Tue") for the day
 * in `tz` that contains `date`. Used as the X-axis label on the
 * analytics line chart so the weekday matches the bucket the
 * server used, regardless of where the Node process happens to run.
 */
export function getWeekdayShortLabel(date: Date, tz: string = TIMEZONE): string {
  const idx = getDatePartsInTz(date, tz).weekday
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][idx]
}

export type DayBucket = {
  /** UTC `Date` marking 00:00 in `tz` for this day. */
  start: Date
  /** UTC `Date` marking 23:59:59.999 in `tz` for this day. */
  end: Date
  /** Short weekday label, e.g. "Mon". */
  name: string
  /** Y-M-D in `tz`, useful for logs / debugging. */
  key: string
}

/**
 * Build `count` consecutive day buckets in `tz`, ending with the
 * wall-clock day in `tz` that contains `now` (default: `new Date()`).
 * Bucket 0 is the oldest day, bucket `count - 1` is "today".
 *
 * Each bucket's `end` is end-of-day-in-tz; if you want a half-open
 * range, use `startOfDayInTz(y, m, d + 1)` as the upper bound.
 */
export function getDayBucketsInTz(
  count: number,
  now: Date = new Date(),
  tz: string = TIMEZONE
): DayBucket[] {
  const todayParts = getDatePartsInTz(now, tz)
  // Anchor at noon-UTC of "today in tz". Using noon UTC (i.e. 20:00 PH)
  // keeps the wall-clock weekday stable when we then walk back whole
  // UTC days, even near the day boundary, and `getUTCDay()` on the
  // result still matches the PH weekday for every bucket in the range.
  const anchor = new Date(
    Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day, 12, 0, 0, 0)
  )
  const buckets: DayBucket[] = []
  for (let i = count - 1; i >= 0; i--) {
    const day = new Date(anchor)
    day.setUTCDate(day.getUTCDate() - i)
    const y = day.getUTCFullYear()
    const m = day.getUTCMonth() + 1
    const d = day.getUTCDate()
    buckets.push({
      start: startOfDayInTz(y, m, d, tz),
      end: endOfDayInTz(y, m, d, tz),
      name: getWeekdayShortLabel(day, tz),
      key: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    })
  }
  return buckets
}

export type MonthBucket = {
  /** UTC `Date` marking 00:00 on day 1 of the month in `tz`. */
  start: Date
  /** UTC `Date` marking the last instant of the last day in the month. */
  end: Date
  /** Short month label, e.g. "Jan". */
  name: string
  /** Y-M in `tz`, useful for logs / debugging. */
  key: string
}

const MONTH_SHORT_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

/**
 * Localised short month label (e.g. "Jan", "Feb") for the month
 * in `tz` that contains `date`.
 */
export function getMonthShortLabel(date: Date, tz: string = TIMEZONE): string {
  const p = getDatePartsInTz(date, tz)
  return MONTH_SHORT_LABELS[p.month - 1] || 'Jan'
}

/**
 * Build `count` consecutive calendar-month buckets in `tz`, ending
 * with the wall-clock month in `tz` that contains `now` (default:
 * `new Date()`). Bucket 0 is the oldest month, bucket `count - 1`
 * is the current month.
 */
export function getMonthBucketsInTz(
  count: number,
  now: Date = new Date(),
  tz: string = TIMEZONE
): MonthBucket[] {
  const todayParts = getDatePartsInTz(now, tz)
  // Anchor at noon-UTC of the 15th of the current month. Using the
  // 15th (instead of day 1) keeps the wall-clock month stable when
  // we then walk back whole months, even near the day boundary, and
  // the resulting `getUTCMonth()` still matches the PH month for
  // every bucket in the range.
  const anchor = new Date(
    Date.UTC(todayParts.year, todayParts.month - 1, 15, 12, 0, 0, 0)
  )
  const buckets: MonthBucket[] = []
  for (let i = count - 1; i >= 0; i--) {
    const ref = new Date(anchor)
    ref.setUTCMonth(ref.getUTCMonth() - i)
    const y = ref.getUTCFullYear()
    const m = ref.getUTCMonth() + 1
    // Last day of the month: day 0 of the next month in UTC (since
    // the anchor is on the 15th, the month never shifts here).
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
    buckets.push({
      start: startOfDayInTz(y, m, 1, tz),
      end: endOfDayInTz(y, m, lastDay, tz),
      name: MONTH_SHORT_LABELS[m - 1] || 'Jan',
      key: `${y}-${String(m).padStart(2, '0')}`,
    })
  }
  return buckets
}
