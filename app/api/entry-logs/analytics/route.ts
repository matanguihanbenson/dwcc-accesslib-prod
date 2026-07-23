import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { UserRole, Campus } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { TIMEZONE, getDatePartsInTz } from '@/lib/timezone'

/**
 * GET /api/entry-logs/analytics
 *
 * Purpose-built analytics endpoint for the entry monitoring
 * Analytics tab. Serves the comprehensive "Library Access Report"
 * that the LIBADMIN uses to monitor per-campus and per-entrance
 * (i.e. per-library) trends.
 *
 * Differs from /api/entry-logs/statistics (which is still served
 * for the simple today/week/month cards) in two important ways:
 *
 *   1. Every metric is scoped to a USER-PROVIDED date
 *      range, plus optional campus, entrance, and
 *      user-type filters. There are no hardcoded
 *      today / week / month buckets.
 *   2. Returns a single, comprehensive payload with
 *      the trend series, per-campus series,
 *      per-entrance series, heatmaps, and every
 *      breakdown in one round-trip. The frontend can
 *      pick which chart to render based on the active
 *      filter without a second fetch.
 *
 * Query params (all optional unless noted):
 *   - dateFrom     (ISO date, YYYY-MM-DD; defaults to today)
 *   - dateTo       (ISO date, YYYY-MM-DD; defaults to today)
 *   - campus       (COLLEGE | BASIC_EDUCATION)
 *   - entrance_id  (numeric id, or comma-separated ids)
 *   - userType     (STUDENT | EMPLOYEE | ALUMNI | GUEST)
 *   - departmentId (numeric)
 *   - programId    (numeric)
 *   - gradeLevelId (numeric)
 *   - yearLevel    (string)
 *   - interval     (hour | day | week | month; auto-derived
 *                   from the range if not provided)
 *
 * STAFF users are always scoped to their own campus
 * (matching the rest of the entry-logs API surface);
 * ADMIN / SUPER_ADMIN can pass any combination.
 *
 * Auto-derives the trend interval from the range when the
 * caller didn't pick one:
 *   - Same day     -> hourly buckets (24)
 *   - 2-31 days    -> daily buckets
 *   - 32-180 days  -> weekly buckets (Mon-Sun)
 *   - 181+ days    -> monthly buckets
 *
 * Cap raised to 2 years when interval is `week` or `month`
 * (the per-bucket resolution is coarse enough that longer
 * ranges are still fast).
 */

type Interval = 'hour' | 'day' | 'week' | 'month'

export const GET = withAuth(
  async (req: NextRequest, session) => {
    try {
      const { searchParams } = new URL(req.url)
      const dateFromRaw = searchParams.get('date_from') || searchParams.get('dateFrom')
      const dateToRaw = searchParams.get('date_to') || searchParams.get('dateTo')
      const queryCampus = searchParams.get('campus')
      const userType = searchParams.get('userType')
      const rawEntrance = searchParams.get('entrance_id')
      const intervalRaw = (searchParams.get('interval') || '').toLowerCase()
      const departmentIdRaw = searchParams.get('departmentId') || searchParams.get('department_id')
      const programIdRaw = searchParams.get('programId') || searchParams.get('program_id')
      const gradeLevelIdRaw = searchParams.get('gradeLevelId') || searchParams.get('grade_level_id')
      const yearLevelRaw = searchParams.get('yearLevel') || searchParams.get('year_level')

      // ---- Resolve the date range ----
      // Default to "today" so the empty-state on the
      // frontend is meaningful when the user hasn't
      // picked anything yet. Hours are normalised to
      // local-day boundaries so the trend chart
      // buckets line up with the user's calendar.
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      let rangeStart = todayStart
      let rangeEnd = new Date(todayStart)
      rangeEnd.setHours(23, 59, 59, 999)

      if (dateFromRaw) {
        const parts = dateFromRaw.split('-').map(Number)
        if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
          rangeStart = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0)
        }
      }
      if (dateToRaw) {
        const parts = dateToRaw.split('-').map(Number)
        if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
          rangeEnd = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999)
        }
      }
      // Guard against inverted ranges
      if (rangeStart > rangeEnd) {
        const tmp = rangeStart
        rangeStart = rangeEnd
        rangeEnd = tmp
      }

      // ---- Resolve interval ----
      // Auto-derive from the date range when the caller
      // didn't pick one. The pivot points match the
      // comment in the route header.
      const isSameDay =
        rangeStart.getFullYear() === rangeEnd.getFullYear() &&
        rangeStart.getMonth() === rangeEnd.getMonth() &&
        rangeStart.getDate() === rangeEnd.getDate()
      const daySpan = Math.max(
        1,
        Math.round((rangeEnd.getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000)) + 1
      )
      let interval: Interval
      if (intervalRaw === 'hour' || intervalRaw === 'day' || intervalRaw === 'week' || intervalRaw === 'month') {
        interval = intervalRaw as Interval
      } else if (isSameDay) {
        interval = 'hour'
      } else if (daySpan <= 31) {
        interval = 'day'
      } else if (daySpan <= 180) {
        interval = 'week'
      } else {
        interval = 'month'
      }

      // ---- Cap the range by interval ----
      // Hourly is the most expensive (up to 24 buckets/day);
      // weekly and monthly are coarse enough that a 2-year
      // range is still cheap.
      const maxRangeDays = interval === 'hour' ? 31 : interval === 'day' ? 366 : 730
      const maxRangeMs = maxRangeDays * 24 * 60 * 60 * 1000
      if (rangeEnd.getTime() - rangeStart.getTime() > maxRangeMs) {
        return createErrorResponse(
          `Date range too large for the ${interval} interval. Maximum is ${maxRangeDays} days; use a coarser interval or a narrower range.`,
          400
        )
      }

      // ---- Resolve campus ----
      // STAFF: locked to their own campus, any query
      //        value is overridden (matches the rest
      //        of the entry-logs API).
      // ADMIN/SUPER_ADMIN: explicit value wins, empty
      //        value means "all campuses".
      let effectiveCampus: Campus | undefined
      if (queryCampus === Campus.COLLEGE || queryCampus === Campus.BASIC_EDUCATION) {
        effectiveCampus = queryCampus as Campus
      }
      if (session?.user?.role === UserRole.STAFF) {
        const accountId = parseInt(session.user.id || '0')
        if (Number.isFinite(accountId) && accountId > 0) {
          const account = await prisma.userAccount.findUnique({
            where: { id: accountId },
            select: { campus: true }
          })
          if (account?.campus) {
            effectiveCampus = account.campus as Campus
          }
        }
      }

      // ---- Resolve entrance filter ----
      // Accept single id, numeric string, or
      // comma-separated list. Normalise to a Prisma
      // `in: [...]` clause so multi-entrance queries
      // (e.g. "Main Library + Law School Library")
      // work without a second endpoint.
      const entranceWhere: { entrance_id?: number | { in: number[] } } = {}
      let entranceIdFilter: number | number[] | null = null
      if (rawEntrance) {
        const str = String(rawEntrance).trim()
        if (str) {
          if (str.includes(',')) {
            const ids = str
              .split(',')
              .map((s) => parseInt(s.trim()))
              .filter((n) => Number.isFinite(n) && n > 0)
            if (ids.length === 1) {
              entranceWhere.entrance_id = ids[0]
              entranceIdFilter = ids[0]
            } else if (ids.length > 1) {
              entranceWhere.entrance_id = { in: ids }
              entranceIdFilter = ids
            }
          } else {
            const n = parseInt(str)
            if (Number.isFinite(n) && n > 0) {
              entranceWhere.entrance_id = n
              entranceIdFilter = n
            }
          }
        }
      }

      // ---- Resolve user-type filter ----
      // Same simple-shape as the existing entry-logs
      // search. The column lives on the `user` table
      // so this is a relation filter, not a column.
      const userTypeWhere: { user?: { user_type: string } } = {}
      const allowedUserTypes = ['STUDENT', 'EMPLOYEE', 'ALUMNI', 'GUEST']
      if (userType && allowedUserTypes.includes(userType)) {
        userTypeWhere.user = { user_type: userType }
      }

      // ---- Resolve demographic filters ----
      // department / program / grade-level / year-level
      // all live on the user record. They compose with
      // each other (AND) and with the user-type filter.
      const demographicWhere: { department_id?: number; program_id?: number; grade_level_id?: number; year_level?: string } = {}
      let departmentId: number | null = null
      let programId: number | null = null
      let gradeLevelId: number | null = null
      let yearLevel: string | null = null
      if (departmentIdRaw) {
        const n = parseInt(departmentIdRaw)
        if (Number.isFinite(n) && n > 0) {
          demographicWhere.department_id = n
          departmentId = n
        }
      }
      if (programIdRaw) {
        const n = parseInt(programIdRaw)
        if (Number.isFinite(n) && n > 0) {
          demographicWhere.program_id = n
          programId = n
        }
      }
      if (gradeLevelIdRaw) {
        const n = parseInt(gradeLevelIdRaw)
        if (Number.isFinite(n) && n > 0) {
          demographicWhere.grade_level_id = n
          gradeLevelId = n
        }
      }
      if (yearLevelRaw) {
        const y = String(yearLevelRaw)
        demographicWhere.year_level = y
        yearLevel = y
      }
      const demographicUserFilter = Object.keys(demographicWhere).length > 0
        ? { user: { ...userTypeWhere.user, ...demographicWhere } }
        : userTypeWhere

      // ---- Assemble the shared "where" clause ----
      const baseWhere: any = {
        ...demographicUserFilter,
        entry_time: { gte: rangeStart, lte: rangeEnd }
      }
      if (effectiveCampus) baseWhere.campus = effectiveCampus
      Object.assign(baseWhere, entranceWhere)

      // ---- Date-bucket SQL fragment ----
      // Each branch returns one column: `bucket` (a Date
      // that is the start of the bucket). The chart's
      // X-axis label is built from this Date on the
      // Node side via `getDatePartsInTz(d, TIMEZONE)`
      // (see `labelFor` below) so it always matches the
      // PH wall-clock the realtime monitoring table
      // shows.
      //
      // We wrap `e.entry_time` in `CONVERT_TZ(...,
      // '+00:00', '+08:00')` at the source so the
      // bucketing is always in Asia/Manila — `DATE_FORMAT`
      // and friends use the MySQL session timezone, and
      // without this conversion the per-campus /
      // per-entrance series shift by 8h whenever the
      // server's session timezone is UTC (or PH, which
      // would double-shift). The earlier `CONVERT_TZ`
      // fix for the heatmaps didn't reach the trend
      // queries, which is why the campus chart was
      // still landing 2pm PH entries in the 6:00
      // bucket.
      const bucketExpr =
        interval === 'hour'
          ? Prisma.sql`DATE_FORMAT(CONVERT_TZ(e.entry_time, '+00:00', '+08:00'), '%Y-%m-%d %H:00:00')`
          : interval === 'day'
            ? Prisma.sql`DATE(CONVERT_TZ(e.entry_time, '+00:00', '+08:00'))`
            : interval === 'week'
              ? Prisma.sql`DATE_SUB(DATE(CONVERT_TZ(e.entry_time, '+00:00', '+08:00')), INTERVAL WEEKDAY(CONVERT_TZ(e.entry_time, '+00:00', '+08:00')) DAY)`
              : Prisma.sql`DATE_FORMAT(CONVERT_TZ(e.entry_time, '+00:00', '+08:00'), '%Y-%m-01')`
      const bucketGroupBy =
        interval === 'hour'
          ? Prisma.sql`DATE_FORMAT(CONVERT_TZ(e.entry_time, '+00:00', '+08:00'), '%Y-%m-%d %H:00:00')`
          : interval === 'day'
            ? Prisma.sql`DATE(CONVERT_TZ(e.entry_time, '+00:00', '+08:00'))`
            : interval === 'week'
              ? Prisma.sql`DATE_SUB(DATE(CONVERT_TZ(e.entry_time, '+00:00', '+08:00')), INTERVAL WEEKDAY(CONVERT_TZ(e.entry_time, '+00:00', '+08:00')) DAY)`
              : Prisma.sql`DATE_FORMAT(CONVERT_TZ(e.entry_time, '+00:00', '+08:00'), '%Y-%m')`

      // ---- User-table WHERE fragments ----
      // The raw SQL queries below need to honour the
      // same demographic filters the model-based
      // queries get for free (department, program,
      // grade level, year level, user type). They
      // live on the `user` table, so the raw queries
      // LEFT JOIN it and append these fragments.
      const userTypeFilter = userType
        ? Prisma.sql`AND u.user_type = ${userType}`
        : Prisma.sql``
      const departmentFilter = departmentId
        ? Prisma.sql`AND u.department_id = ${departmentId}`
        : Prisma.sql``
      const programFilter = programId
        ? Prisma.sql`AND u.program_id = ${programId}`
        : Prisma.sql``
      const gradeLevelFilter = gradeLevelId
        ? Prisma.sql`AND u.grade_level_id = ${gradeLevelId}`
        : Prisma.sql``
      const yearLevelFilter = yearLevel
        ? Prisma.sql`AND u.year_level = ${yearLevel}`
        : Prisma.sql``
      // Entrance filter: same WHERE clause as the
      // model-based queries (single id or `IN (...)`).
      const entranceFilter: Prisma.Sql =
        typeof entranceIdFilter === 'number'
          ? Prisma.sql`AND e.entrance_id = ${entranceIdFilter}`
          : Array.isArray(entranceIdFilter)
            ? Prisma.sql`AND e.entrance_id IN (${Prisma.join(entranceIdFilter as number[])})`
            : Prisma.sql``

      // ---- Parallel data fetches ----
      // Eight round-trips, but they're all indexed
      // on the (entry_time, campus, entrance_id) tuple
      // so each one is O(matching rows). Wrapped in
      // Promise.all so the total wall-time is the
      // slowest query, not the sum.
      const [
        totalEntries,
        totalExits,
        uniqueUserRows,
        currentlyInside,
        trendByInterval,
        trendByCampus,
        trendByEntrance,
        byCampus,
        byEntrance,
        byUserType,
        byDepartment,
        byPurpose,
        hourOfDayRows,
        dayOfWeekRows
      ] = await Promise.all([
        prisma.entryLog.count({ where: baseWhere }),
        prisma.entryLog.count({
          where: { ...baseWhere, exit_time: { not: null } }
        }),
        prisma.entryLog.findMany({
          where: baseWhere,
          select: { user_id: true },
          distinct: ['user_id']
        }),
        prisma.entryLog.count({
          where: { ...baseWhere, exit_time: null }
        }),

        // ---- Aggregate trend (entries + exits per bucket) ----
        prisma.$queryRaw<Array<{ bucket: Date; entries: number; exits: number }>>(
          Prisma.sql`
            SELECT
              ${bucketExpr} AS bucket,
              COUNT(*) AS entries,
              SUM(CASE WHEN e.exit_time IS NOT NULL THEN 1 ELSE 0 END) AS exits
            FROM entrylog e
            LEFT JOIN \`user\` u ON u.user_id = e.user_id
            WHERE e.entry_time >= ${rangeStart} AND e.entry_time <= ${rangeEnd}
              ${effectiveCampus ? Prisma.sql`AND e.campus = ${effectiveCampus}` : Prisma.sql``}
              ${entranceFilter}
              ${userTypeFilter}
              ${departmentFilter}
              ${programFilter}
              ${gradeLevelFilter}
              ${yearLevelFilter}
            GROUP BY ${bucketGroupBy}
            ORDER BY bucket ASC
          `
        ),

        // ---- Per-campus trend (one series per campus) ----
        // Only fetched when no campus filter is set
        // (otherwise there's only one series and the
        // chart would be a single line).
        effectiveCampus
          ? Promise.resolve([])
          : prisma.$queryRaw<Array<{ bucket: Date; campus: string; entries: number }>>(
              Prisma.sql`
                SELECT
                  ${bucketExpr} AS bucket,
                  e.campus,
                  COUNT(*) AS entries
                FROM entrylog e
                LEFT JOIN \`user\` u ON u.user_id = e.user_id
                WHERE e.entry_time >= ${rangeStart} AND e.entry_time <= ${rangeEnd}
                  ${entranceFilter}
                  ${userTypeFilter}
                  ${departmentFilter}
                  ${programFilter}
                  ${gradeLevelFilter}
                  ${yearLevelFilter}
                GROUP BY ${bucketGroupBy}, e.campus
                ORDER BY bucket ASC
              `
            ),

        // ---- Per-entrance trend (one series per entrance) ----
        // Only fetched when the caller didn't pin a
        // single entrance. Up to ~20 entrances in
        // practice, so the result set is bounded.
        entranceIdFilter
          ? Promise.resolve([])
          : prisma.$queryRaw<Array<{ bucket: Date; entrance_id: number; entries: number }>>(
              Prisma.sql`
                SELECT
                  ${bucketExpr} AS bucket,
                  e.entrance_id,
                  COUNT(*) AS entries
                FROM entrylog e
                LEFT JOIN \`user\` u ON u.user_id = e.user_id
                WHERE e.entry_time >= ${rangeStart} AND e.entry_time <= ${rangeEnd}
                  ${effectiveCampus ? Prisma.sql`AND e.campus = ${effectiveCampus}` : Prisma.sql``}
                  AND e.entrance_id IS NOT NULL
                  ${userTypeFilter}
                  ${departmentFilter}
                  ${programFilter}
                  ${gradeLevelFilter}
                  ${yearLevelFilter}
                GROUP BY ${bucketGroupBy}, e.entrance_id
                ORDER BY bucket ASC
              `
            ),

        prisma.entryLog.groupBy({
          by: ['campus'],
          where: baseWhere,
          _count: { _all: true }
        }),
        prisma.entryLog.groupBy({
          by: ['entrance_id'],
          where: baseWhere,
          _count: { _all: true }
        }),
        prisma.entryLog.groupBy({
          by: ['user_id'],
          where: baseWhere,
          _count: { _all: true }
        }),
        // Department + program + grade + year need
        // relation joins. Done as a single findMany +
        // in-memory bucket so we don't pay N round-trips
        // for N departments.
        prisma.entryLog.findMany({
          where: baseWhere,
          take: 20000,
          select: {
            user: {
              select: {
                department_ref: { select: { name: true } },
                program: { select: { name: true } },
                grade_level: { select: { name: true } },
                year_level: true
              }
            }
          }
        }),
        prisma.entryLog.groupBy({
          by: ['purpose'],
          where: baseWhere,
          _count: { _all: true }
        }),

        // ---- Hour-of-day heatmap ----
        // Returns 24 rows (00-23) with the total
        // entry count per hour, summed across the
        // date range. Useful for spotting the
        // library's peak hours at a glance.
        //
        // The `HOUR()` and `DAYOFWEEK()` built-ins read
        // the value as stored; the column is a wall-
        // clock value and the server's session timezone
        // is UTC, so we wrap the column in
        // `CONVERT_TZ(..., '+00:00', '+08:00')` to
        // shift into Asia/Manila before extracting the
        // component. Without this, a 2:30pm PH entry
        // (stored as `06:30`) shows up in the 06:00
        // bucket instead of the 14:00 bucket.
        prisma.$queryRaw<Array<{ hour: number; entries: number }>>(
          Prisma.sql`
            SELECT
              HOUR(CONVERT_TZ(e.entry_time, '+00:00', '+08:00')) AS hour,
              COUNT(*) AS entries
            FROM entrylog e
            LEFT JOIN \`user\` u ON u.user_id = e.user_id
            WHERE e.entry_time >= ${rangeStart} AND e.entry_time <= ${rangeEnd}
              ${effectiveCampus ? Prisma.sql`AND e.campus = ${effectiveCampus}` : Prisma.sql``}
              ${entranceFilter}
              ${userTypeFilter}
              ${departmentFilter}
              ${programFilter}
              ${gradeLevelFilter}
              ${yearLevelFilter}
            GROUP BY HOUR(CONVERT_TZ(e.entry_time, '+00:00', '+08:00'))
            ORDER BY hour ASC
          `
        ),

        // ---- Day-of-week heatmap ----
        // Returns 7 rows (Sun=1..Sat=7 in MySQL's
        // DAYOFWEEK() convention) with the total
        // entry count per weekday, summed across the
        // date range.
        prisma.$queryRaw<Array<{ dow: number; entries: number }>>(
          Prisma.sql`
            SELECT
              DAYOFWEEK(CONVERT_TZ(e.entry_time, '+00:00', '+08:00')) AS dow,
              COUNT(*) AS entries
            FROM entrylog e
            LEFT JOIN \`user\` u ON u.user_id = e.user_id
            WHERE e.entry_time >= ${rangeStart} AND e.entry_time <= ${rangeEnd}
              ${effectiveCampus ? Prisma.sql`AND e.campus = ${effectiveCampus}` : Prisma.sql``}
              ${entranceFilter}
              ${userTypeFilter}
              ${departmentFilter}
              ${programFilter}
              ${gradeLevelFilter}
              ${yearLevelFilter}
            GROUP BY DAYOFWEEK(CONVERT_TZ(e.entry_time, '+00:00', '+08:00'))
            ORDER BY dow ASC
          `
        )
      ])

      // ---- Build the trend buckets ----
      // The raw `trendByInterval` only has buckets
      // where entries exist. Pad the result so the
      // chart always has a contiguous series.
      //
      // Date components are read in the Asia/Manila
      // timezone via `getDatePartsInTz` instead of the
      // server's local timezone (`Date#getHours` etc.).
      // The Node process is almost always UTC on
      // hosted deployments, so the default methods
      // would return the UTC hour — i.e. a 2:30pm PH
      // entry would land in the "06:00" bucket and
      // show up on the chart at 06:00.
      //
      // The hour labels use the same 12-hour AM/PM
      // format the realtime monitoring table renders
      // via `toLocaleTimeString(..., { hour: '2-digit',
      // minute: '2-digit', hour12: true })`, so the
      // chart X-axis reads identically to the entry
      // log timestamps the LIBADMIN is looking at.
      const labelFor = (d: Date): string => {
        const p = getDatePartsInTz(d, TIMEZONE)
        if (interval === 'hour') {
          const ampm = p.hour >= 12 ? 'PM' : 'AM'
          const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12
          return `${hour12}:00 ${ampm}`
        }
        if (interval === 'day') {
          return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
        }
        if (interval === 'week') {
          // The bucket is the Monday of the ISO week.
          // We render it as "Mon DD" so the chart
          // label is short and readable.
          return `${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
        }
        // month
        return `${p.year}-${String(p.month).padStart(2, '0')}`
      }

      const trendBuckets = new Map<string, { entries: number; exits: number }>()
      for (const row of trendByInterval as any[]) {
        const d = row.bucket instanceof Date ? row.bucket : new Date(row.bucket)
        const key = labelFor(d)
        trendBuckets.set(key, {
          entries: Number(row.entries) || 0,
          exits: Number(row.exits) || 0
        })
      }
      // Build a contiguous bucket series across the
      // range so the chart x-axis is always even.
      //
      // The cursor walks the range in PH wall-clock
      // components (`getDatePartsInTz`) and rebuilds
      // the Date with the next bucket's wall-clock
      // values via the `new Date(y, m-1, d, h, ...)`
      // constructor — that constructor builds a Date
      // in the Node process's local timezone, which
      // matches the wall-clock components we just
      // computed for PH. This avoids the bug where
      // `setHours(h+1)` on a UTC server would shift
      // the cursor out of the intended range.
      const trend: Array<{ label: string; key: string; entries: number; exits: number }> = []
      {
        const startParts = getDatePartsInTz(rangeStart, TIMEZONE)
        let cursorParts = { ...startParts, minute: 0, second: 0 }
        const rangeEndParts = getDatePartsInTz(rangeEnd, TIMEZONE)
        const makeCursorDate = (p: typeof cursorParts) =>
          new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
        const bump = (p: typeof cursorParts, kind: Interval): typeof cursorParts => {
          const next: typeof cursorParts = { ...p }
          if (kind === 'hour') next.hour += 1
          else if (kind === 'day') next.day += 1
          else if (kind === 'week') next.day += 7
          else next.month += 1
          return next
        }
        // The `while` predicate compares in UTC ms so
        // the off-by-DST or off-by-tz edge cases can't
        // pop up; the cursor date and rangeEnd are
        // both anchored at the same instant within
        // their respective buckets.
        let cursorDate = makeCursorDate(cursorParts)
        const endDate = makeCursorDate(rangeEndParts)
        while (cursorDate.getTime() <= endDate.getTime()) {
          const key = labelFor(cursorDate)
          const b = trendBuckets.get(key) || { entries: 0, exits: 0 }
          trend.push({ label: key, key, entries: b.entries, exits: b.exits })
          cursorParts = bump(cursorParts, interval)
          cursorDate = makeCursorDate(cursorParts)
        }
      }

      // ---- Per-campus series ----
      // One line per campus, aligned to the same
      // bucket x-axis as the main trend. When the
      // caller pinned a single campus, this is an
      // empty array (the main trend already shows
      // that single campus).
      const campusSeries: Array<{ name: string; data: Array<{ key: string; entries: number }> }> = []
      if (!effectiveCampus) {
        const campusColors = ['#3b82f6', '#f59e0b']
        const byCampusBucket = new Map<string, Map<string, number>>()
        const campusNames: string[] = []
        for (const row of trendByCampus as any[]) {
          const d = row.bucket instanceof Date ? row.bucket : new Date(row.bucket)
          const key = labelFor(d)
          const campusName = String(row.campus)
          if (!byCampusBucket.has(campusName)) {
            byCampusBucket.set(campusName, new Map())
            campusNames.push(campusName)
          }
          byCampusBucket.get(campusName)!.set(key, Number(row.entries) || 0)
        }
        for (let i = 0; i < campusNames.length; i++) {
          const name = campusNames[i]
          const buckets = byCampusBucket.get(name)!
          campusSeries.push({
            name: name === 'COLLEGE' ? 'College' : 'Basic Education',
            data: trend.map((b) => ({ key: b.key, entries: buckets.get(b.key) || 0 }))
          })
        }
        // Stable color order (College blue, Basic Ed amber)
        campusSeries.sort((a, b) => (a.name === 'College' ? -1 : 1))
        // Attach the colors so the frontend doesn't
        // need a separate map.
        for (let i = 0; i < campusSeries.length; i++) {
          ;(campusSeries[i] as any).stroke = campusColors[i % campusColors.length]
        }
      }

      // ---- Per-entrance series ----
      // One line per entrance, aligned to the same
      // bucket x-axis. When the caller pinned one
      // (or many) entrance(s), this is empty.
      const entranceSeries: Array<{
        entrance_id: number
        name: string
        campus: Campus | null
        data: Array<{ key: string; entries: number }>
      }> = []
      if (!entranceIdFilter) {
        // Resolve entrance_id -> name in one query
        const entranceIds = Array.from(
          new Set(
            (trendByEntrance as any[])
              .map((r) => Number(r.entrance_id))
              .filter((n) => Number.isFinite(n) && n > 0)
          )
        )
        const entranceMeta = entranceIds.length
          ? await prisma.entrance.findMany({
              where: { entrance_id: { in: entranceIds } },
              select: { entrance_id: true, name: true, campus: true }
            })
          : []
        const metaMap = new Map(entranceMeta.map((e) => [e.entrance_id, e]))

        const byEntranceBucket = new Map<number, Map<string, number>>()
        for (const row of trendByEntrance as any[]) {
          const id = Number(row.entrance_id)
          if (!Number.isFinite(id) || id <= 0) continue
          const d = row.bucket instanceof Date ? row.bucket : new Date(row.bucket)
          const key = labelFor(d)
          if (!byEntranceBucket.has(id)) byEntranceBucket.set(id, new Map())
          byEntranceBucket.get(id)!.set(key, Number(row.entries) || 0)
        }
        for (const [id, buckets] of byEntranceBucket.entries()) {
          const meta = metaMap.get(id)
          entranceSeries.push({
            entrance_id: id,
            name: meta?.name || `Entrance #${id}`,
            campus: meta?.campus || null,
            data: trend.map((b) => ({ key: b.key, entries: buckets.get(b.key) || 0 }))
          })
        }
        // Stable ordering: by total entries desc.
        const totals = new Map<number, number>()
        for (const s of entranceSeries) {
          totals.set(s.entrance_id, s.data.reduce((acc, d) => acc + d.entries, 0))
        }
        entranceSeries.sort((a, b) => (totals.get(b.entrance_id) || 0) - (totals.get(a.entrance_id) || 0))
      }

      // ---- Peak bucket ----
      // Useful for the "Peak Hour" / "Peak Day" cards
      // on the analytics tab.
      const peakBucket = trend.reduce(
        (max, b) => (b.entries > max.entries ? b : max),
        trend[0] || { label: 'N/A', entries: 0, exits: 0 }
      )

      // ---- byCampus: include the full Campus enum
      // so the chart always shows every campus even
      // when one of them has 0 entries in the range. ----
      const campusCounts = new Map<string, number>()
      for (const c of (byCampus as any[])) {
        campusCounts.set(String(c.campus), Number(c._count?._all) || 0)
      }
      const campusBreakdown = (Object.values(Campus) as string[]).map((c) => ({
        campus: c,
        entries: campusCounts.get(c) || 0
      }))

      // ---- byEntrance: resolve the entrance_id
      // numbers to names. ----
      const entranceIds = (byEntrance as any[])
        .map((b) => b.entrance_id)
        .filter((id): id is number => id != null)
      const entranceRows = entranceIds.length
        ? await prisma.entrance.findMany({
            where: { entrance_id: { in: entranceIds } },
            select: { entrance_id: true, name: true, campus: true }
          })
        : []
      const entranceMap = new Map(entranceRows.map((e) => [e.entrance_id, e]))
      const entranceBreakdown = (byEntrance as any[])
        .map((b) => {
          const id = b.entrance_id as number | null
          if (id == null) {
            return {
              entrance_id: null as number | null,
              name: 'Unassigned',
              campus: null as Campus | null,
              entries: Number(b._count?._all) || 0
            }
          }
          const meta = entranceMap.get(id)
          return {
            entrance_id: id,
            name: meta?.name || `Entrance #${id}`,
            campus: meta?.campus || null,
            entries: Number(b._count?._all) || 0
          }
        })
        .sort((a, b) => b.entries - a.entries)

      // ---- byUserType ----
      const userIds = (byUserType as any[]).map((b) => b.user_id).filter(Boolean)
      const userRows = userIds.length
        ? await prisma.user.findMany({
            where: { user_id: { in: userIds } },
            select: { user_id: true, user_type: true }
          })
        : []
      const userTypeMap = new Map(userRows.map((u) => [u.user_id, u.user_type]))
      const userTypeBucket = new Map<string, number>()
      for (const b of byUserType as any[]) {
        const t = userTypeMap.get(b.user_id) || 'UNKNOWN'
        userTypeBucket.set(t, (userTypeBucket.get(t) || 0) + (Number(b._count?._all) || 0))
      }
      const userTypeBreakdown = ['STUDENT', 'EMPLOYEE', 'ALUMNI', 'GUEST'].map((t) => ({
        userType: t,
        entries: userTypeBucket.get(t) || 0
      }))

      // ---- byDepartment / byProgram / byGradeLevel / byYearLevel ----
      // All four share the same in-memory bucket
      // pattern so we walk the user-joined rows once.
      const departmentBucket = new Map<string, number>()
      const programBucket = new Map<string, number>()
      const gradeLevelBucket = new Map<string, number>()
      const yearLevelBucket = new Map<string, number>()
      for (const r of byDepartment as any[]) {
        const d = r.user?.department_ref?.name || 'Unassigned'
        departmentBucket.set(d, (departmentBucket.get(d) || 0) + 1)
        const p = r.user?.program?.name || 'Unassigned'
        programBucket.set(p, (programBucket.get(p) || 0) + 1)
        const g = r.user?.grade_level?.name || 'Unassigned'
        gradeLevelBucket.set(g, (gradeLevelBucket.get(g) || 0) + 1)
        const y = r.user?.year_level || 'Unassigned'
        yearLevelBucket.set(y, (yearLevelBucket.get(y) || 0) + 1)
      }
      const toSorted = (m: Map<string, number>, labelKey: string) =>
        Array.from(m.entries())
          .map(([name, entries]) => ({ [labelKey]: name, entries }))
          .sort((a, b) => b.entries - a.entries) as any[]
      const departmentBreakdown = toSorted(departmentBucket, 'department')
      const programBreakdown = toSorted(programBucket, 'program')
      const gradeLevelBreakdown = toSorted(gradeLevelBucket, 'gradeLevel')
      const yearLevelBreakdown = toSorted(yearLevelBucket, 'yearLevel')

      // ---- byPurpose ----
      const purposeCounts = new Map<string, number>()
      for (const p of byPurpose as any[]) {
        const key = p.purpose && p.purpose.trim() ? p.purpose : 'General'
        purposeCounts.set(key, (purposeCounts.get(key) || 0) + (Number(p._count?._all) || 0))
      }
      const purposeBreakdown = Array.from(purposeCounts.entries())
        .map(([purpose, entries]) => ({ purpose, entries }))
        .sort((a, b) => b.entries - a.entries)

      // ---- Heatmaps ----
      // Always emit 24 / 7 rows (zero-filled) so the
      // frontend can render a stable grid even when
      // some hours / weekdays have no entries.
      const hourOfDay = Array.from({ length: 24 }, (_, h) => {
        const row = (hourOfDayRows as any[]).find((r) => Number(r.hour) === h)
        return {
          hour: h,
          label: `${String(h).padStart(2, '0')}:00`,
          entries: row ? Number(row.entries) || 0 : 0
        }
      })
      // MySQL's DAYOFWEEK returns 1=Sun..7=Sat. We
      // shift to a Mon-first week to match the trend
      // bucket ordering.
      const dowLabelMap: Record<number, string> = {
        1: 'Sun', 2: 'Mon', 3: 'Tue', 4: 'Wed', 5: 'Thu', 6: 'Fri', 7: 'Sat'
      }
      const dayOfWeek = [2, 3, 4, 5, 6, 7, 1].map((dow) => {
        const row = (dayOfWeekRows as any[]).find((r) => Number(r.dow) === dow)
        return {
          dow,
          label: dowLabelMap[dow],
          entries: row ? Number(row.entries) || 0 : 0
        }
      })

      return createSuccessResponse({
        scope: {
          dateFrom: rangeStart.toISOString(),
          dateTo: rangeEnd.toISOString(),
          campus: effectiveCampus || null,
          entrance_id: entranceIdFilter,
          userType: userType || null,
          interval
        },
        summary: {
          totalEntries,
          totalExits,
          uniqueUsers: uniqueUserRows.length,
          currentlyInside,
          peakBucket: { label: peakBucket.label, entries: peakBucket.entries, exits: peakBucket.exits },
          interval,
          daySpan
        },
        trend,
        campusSeries,
        entranceSeries,
        heatmaps: {
          hourOfDay,
          dayOfWeek
        },
        breakdowns: {
          byCampus: campusBreakdown,
          byEntrance: entranceBreakdown,
          byUserType: userTypeBreakdown,
          byDepartment: departmentBreakdown,
          byProgram: programBreakdown,
          byGradeLevel: gradeLevelBreakdown,
          byYearLevel: yearLevelBreakdown,
          byPurpose: purposeBreakdown
        }
      })
    } catch (error) {
      console.error('Error fetching entry analytics:', error)
      return createErrorResponse('Failed to fetch entry analytics', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
