import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/types'
import {
  TIMEZONE,
  getDayBucketsInTz,
  getTodayRangeInTz,
  getHourInTz,
} from '@/lib/timezone'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role as UserRole
    if (userRole !== UserRole.STAFF && userRole !== UserRole.ADMIN && userRole !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date()

    // Last 7 day buckets, each anchored to Asia/Manila wall-clock
    // days so a 9:15am PH entry shows up on "today", not "yesterday",
    // regardless of whether the Node process is in UTC or PH time.
    const last7Days = getDayBucketsInTz(7, now, TIMEZONE)

    // Fetch real data for the last 7 days
    const usageChartData = await Promise.all(
      last7Days.map(async ({ start, end, name }) => {
        const [entries, books, lockers] = await Promise.all([
          // Library entries for this day
          prisma.entryLog.count({
            where: {
              entry_time: {
                gte: start,
                lte: end
              }
            }
          }),
          // Books borrowed on this day
          prisma.bookTransaction.count({
            where: {
              borrow_date: {
                gte: start,
                lte: end
              }
            }
          }),
          // Lockers assigned on this day
          prisma.lockerTransaction.count({
            where: {
              borrow_time: {
                gte: start,
                lte: end
              }
            }
          })
        ])

        return {
          name,
          entries,
          books,
          lockers
        }
      })
    )

    // Today's range, anchored to the PH wall-clock day.
    const { start: today, end: tomorrow } = getTodayRangeInTz(TIMEZONE)

    const [
      todayEntries,
      todayBooks, 
      todayLockers,
      weeklyAverages
    ] = await Promise.all([
      prisma.entryLog.count({
        where: {
          entry_time: { gte: today, lte: tomorrow }
        }
      }),
      prisma.bookTransaction.count({
        where: {
          borrow_date: { gte: today, lte: tomorrow }
        }
      }),
      prisma.lockerTransaction.count({
        where: {
          borrow_time: { gte: today, lte: tomorrow }
        }
      }),
      // Calculate weekly averages
      (async () => {
        const totalEntries = usageChartData.reduce((sum, day) => sum + day.entries, 0)
        const totalBooks = usageChartData.reduce((sum, day) => sum + day.books, 0)
        const totalLockers = usageChartData.reduce((sum, day) => sum + day.lockers, 0)
        
        return {
          entries: Math.round(totalEntries / 7),
          books: Math.round(totalBooks / 7),
          lockers: Math.round(totalLockers / 7)
        }
      })()
    ])

    // Calculate trends (comparing today vs weekly average)
    const trends = {
      entries: todayEntries > weeklyAverages.entries ? 'up' : todayEntries < weeklyAverages.entries ? 'down' : 'stable',
      books: todayBooks > weeklyAverages.books ? 'up' : todayBooks < weeklyAverages.books ? 'down' : 'stable',
      lockers: todayLockers > weeklyAverages.lockers ? 'up' : todayLockers < weeklyAverages.lockers ? 'down' : 'stable'
    }

    // Get peak activity times for today
    const hourlyActivity = await prisma.entryLog.findMany({
      where: {
        entry_time: { gte: today, lte: tomorrow }
      },
      select: {
        entry_time: true
      }
    })

    const hourCounts: { [hour: string]: number } = {}
    hourlyActivity.forEach(entry => {
      // Use the PH wall-clock hour, not the server's local hour
      // (Date#getHours() returns the Node process's timezone, which
      // is usually UTC on hosted servers and would shift the peak
      // hour 8h off from what the staff see on the dashboard).
      const hour = getHourInTz(entry.entry_time, TIMEZONE)
      const hourKey = `${hour}:00`
      hourCounts[hourKey] = (hourCounts[hourKey] || 0) + 1
    })

    const peakHour = Object.entries(hourCounts).reduce((max, [hour, count]) => 
      count > (hourCounts[max[0]] || 0) ? [hour, count] : max, ['8:00', 0]
    )[0]

    // Get utilization rates
    const [totalLockers, totalBooks] = await Promise.all([
      prisma.locker.count({ where: { status: { not: 'ARCHIVED' } } }),
      prisma.book.count({ where: { status: { not: 'ARCHIVED' } } })
    ])

    const utilizationRates = {
      lockers: totalLockers > 0 ? Math.round((todayLockers / totalLockers) * 100) : 0,
      books: totalBooks > 0 ? Math.round((todayBooks / totalBooks) * 100) : 0
    }

    const analytics = {
      usageChartData,
      todayStats: {
        entries: todayEntries,
        books: todayBooks,
        lockers: todayLockers,
        peakHour
      },
      weeklyAverages,
      trends,
      utilizationRates,
      summary: {
        totalWeeklyActivity: usageChartData.reduce((sum, day) => sum + day.entries + day.books + day.lockers, 0),
        mostActiveDay: usageChartData.reduce((max, day) => 
          (day.entries + day.books + day.lockers) > (max.entries + max.books + max.lockers) ? day : max
        ).name,
        currentTrend: trends.entries === 'up' ? 'Increasing' : trends.entries === 'down' ? 'Decreasing' : 'Stable'
      }
    }

    return NextResponse.json(analytics)

  } catch (error) {
    console.error('Error fetching staff analytics:', error)
    
    // Return fallback data instead of error to prevent dashboard crashes.
    // The bucket labels are anchored to PH weekdays so they line up
    // with whatever the real branch returned when the request succeeds.
    const fallbackData = {
      usageChartData: getDayBucketsInTz(7, new Date(), TIMEZONE).map((b) => ({
        name: b.name,
        entries: 0,
        books: 0,
        lockers: 0
      })),
      todayStats: { entries: 0, books: 0, lockers: 0, peakHour: '8:00' },
      weeklyAverages: { entries: 0, books: 0, lockers: 0 },
      trends: { entries: 'stable', books: 'stable', lockers: 'stable' },
      utilizationRates: { lockers: 0, books: 0 },
      summary: {
        totalWeeklyActivity: 0,
        mostActiveDay: 'Mon',
        currentTrend: 'Stable'
      }
    }
    
    return NextResponse.json(fallbackData)
  }
}
