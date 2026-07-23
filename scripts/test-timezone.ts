/**
 * Quick sanity test for lib/timezone.ts. Run with:
 *   npx tsx scripts/test-timezone.ts
 * or compiled:
 *   npx tsc --outDir /tmp scripts/test-timezone.ts && node /tmp/test-timezone.js
 *
 * Tests cover the exact case the user reported:
 *   - server in UTC, current PH time = 2026-06-23 11:38
 *   - DB row stored at PH 2026-06-23 09:15:53 (which is UTC 2026-06-23 01:15:53)
 *   - the row should land in the "today" bucket, not "yesterday"
 */
import {
  TIMEZONE,
  getDatePartsInTz,
  getTzOffsetMs,
  startOfDayInTz,
  endOfDayInTz,
  getTodayRangeInTz,
  startOfMonthInTz,
  startOfWeekInTz,
  getDayBucketsInTz,
  getWeekdayShortLabel,
  getHourInTz,
} from '../lib/timezone'

let failed = 0
function expect(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) {
    failed++
    console.error(`FAIL  ${label}`)
    console.error(`      got:      ${JSON.stringify(actual)}`)
    console.error(`      expected: ${JSON.stringify(expected)}`)
  } else {
    console.log(`ok    ${label}`)
  }
}

// Pretend the server clock is in UTC. The user's wall clock in PH is
// 2026-06-23 11:38, which is 2026-06-23 03:38:00 UTC.
const fakeNowUtc = new Date('2026-06-23T03:38:00.000Z')

// "DB row" stored as PH 2026-06-23 09:15:53 — i.e. UTC 2026-06-23 01:15:53
const fakeEntryUtc = new Date('2026-06-23T01:15:53.000Z')

console.log('--- getDatePartsInTz ---')
expect(
  'PH parts of 2026-06-23 03:38 UTC',
  getDatePartsInTz(fakeNowUtc),
  { year: 2026, month: 6, day: 23, hour: 11, minute: 38, second: 0, weekday: 2 }
)

console.log('--- getTzOffsetMs ---')
expect(
  'PH offset at 2026-06-23 03:38 UTC is +8h',
  getTzOffsetMs(fakeNowUtc),
  8 * 60 * 60 * 1000
)

console.log('--- startOfDayInTz / endOfDayInTz ---')
expect(
  'start of 2026-06-23 PH is 2026-06-22 16:00 UTC',
  startOfDayInTz(2026, 6, 23).toISOString(),
  '2026-06-22T16:00:00.000Z'
)
expect(
  'end of 2026-06-23 PH is 2026-06-23 15:59:59.999 UTC',
  endOfDayInTz(2026, 6, 23).toISOString(),
  '2026-06-23T15:59:59.999Z'
)

console.log('--- getTodayRangeInTz ---')
const today = getTodayRangeInTz(undefined, fakeNowUtc)
expect(
  'today.start is 2026-06-22 16:00 UTC',
  today.start.toISOString(),
  '2026-06-22T16:00:00.000Z'
)
expect(
  'today.end is 2026-06-23 15:59:59.999 UTC',
  today.end.toISOString(),
  '2026-06-23T15:59:59.999Z'
)
expect(
  'fakeEntryUtc (09:15 PH) is within today',
  fakeEntryUtc >= today.start && fakeEntryUtc <= today.end,
  true
)

console.log('--- startOfMonthInTz / startOfWeekInTz ---')
expect(
  'start of June 2026 PH is 2026-05-31 16:00 UTC',
  startOfMonthInTz(fakeNowUtc).toISOString(),
  '2026-05-31T16:00:00.000Z'
)
// 2026-06-23 is a Tuesday (weekday 2). Sunday-start of that week = 2026-06-21
expect(
  'start of week of 2026-06-23 PH is 2026-06-20 16:00 UTC (Sunday 2026-06-21 PH)',
  startOfWeekInTz(fakeNowUtc).toISOString(),
  '2026-06-20T16:00:00.000Z'
)

console.log('--- getDayBucketsInTz ---')
const buckets = getDayBucketsInTz(7, fakeNowUtc)
expect('7 buckets returned', buckets.length, 7)
expect(
  'first bucket is 2026-06-17 PH (Wednesday 17 Jun PH)',
  buckets[0]?.key,
  '2026-06-17'
)
expect('first bucket weekday label', buckets[0]?.name, 'Wed')
expect(
  'last bucket is 2026-06-23 PH (Tuesday 23 Jun PH)',
  buckets[6]?.key,
  '2026-06-23'
)
expect('last bucket weekday label', buckets[6]?.name, 'Tue')
expect(
  'last bucket start is 2026-06-22 16:00 UTC',
  buckets[6]?.start.toISOString(),
  '2026-06-22T16:00:00.000Z'
)
expect(
  'fakeEntryUtc falls in the LAST bucket (today)',
  fakeEntryUtc >= buckets[6]!.start && fakeEntryUtc <= buckets[6]!.end,
  true
)

console.log('--- getHourInTz ---')
expect(
  '09:15 PH entry has hour 9 in PH',
  getHourInTz(fakeEntryUtc),
  9
)
expect(
  '03:38 UTC moment has hour 11 in PH',
  getHourInTz(fakeNowUtc),
  11
)

console.log('--- getWeekdayShortLabel ---')
expect(
  '2026-06-23 PH (03:38 UTC) is Tue',
  getWeekdayShortLabel(fakeNowUtc),
  'Tue'
)
expect(
  '2026-06-22 17:00 UTC is 2026-06-23 01:00 PH — still Tue',
  getWeekdayShortLabel(new Date('2026-06-22T17:00:00.000Z')),
  'Tue'
)
expect(
  '2026-06-22 15:59 UTC is 2026-06-22 23:59 PH — still Mon',
  getWeekdayShortLabel(new Date('2026-06-22T15:59:00.000Z')),
  'Mon'
)

console.log('')
if (failed === 0) {
  console.log(`All checks passed. TIMEZONE = ${TIMEZONE}`)
  process.exit(0)
} else {
  console.error(`${failed} check(s) failed.`)
  process.exit(1)
}
