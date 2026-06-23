import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { LockerStatisticsReportData, UserRole, Campus } from '@/types'
import { categorizeUserForEntranceExit } from '@/lib/utils'

/**
 * Auto-scope STAFF to their own campus. The campus lives on the
 * `locker` row, so the filter goes through the locker relation
 * (`locker: { campus: ... }`). ADMIN / SUPER_ADMIN can pass an
 * explicit `campus` query param.
 */
async function resolveReportCampus(
  session: any,
  queryCampus: string | null
): Promise<Campus | null> {
  if (session?.user?.role === UserRole.STAFF) {
    const accountId = parseInt(session.user.id || '0')
    if (!isNaN(accountId) && accountId > 0) {
      const account = await prisma.userAccount.findUnique({
        where: { id: accountId },
        select: { campus: true }
      })
      if (account?.campus) return account.campus
    }
  }
  if (queryCampus === Campus.COLLEGE || queryCampus === Campus.BASIC_EDUCATION) {
    return queryCampus
  }
  return null
}

export const GET = withAuth(async (req: NextRequest, session) => {
  try {
    const { searchParams } = new URL(req.url)
    const monthParam = searchParams.get('month')
    const yearParam = searchParams.get('year')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const queryCampus = searchParams.get('campus')

    // Determine date range
    let startDate: Date
    let endDate: Date
    let month: number
    let year: number

    if (dateFrom && dateTo) {
      // Parse dates and set to local timezone with proper time boundaries
      const fromParts = dateFrom.split('-').map(Number)
      const toParts = dateTo.split('-').map(Number)
      startDate = new Date(fromParts[0], fromParts[1] - 1, fromParts[2], 0, 0, 0, 0)
      endDate = new Date(toParts[0], toParts[1] - 1, toParts[2], 23, 59, 59, 999)
      month = startDate.getMonth() + 1
      year = startDate.getFullYear()
    } else if (monthParam && yearParam) {
      month = parseInt(monthParam)
      year = parseInt(yearParam)
      
      if (month < 1 || month > 12) {
        return createErrorResponse('Invalid month. Must be between 1 and 12.', 400)
      }

      if (year < 2000 || year > 2100) {
        return createErrorResponse('Invalid year. Must be between 2000 and 2100.', 400)
      }
      
      startDate = new Date(year, month - 1, 1)
      endDate = new Date(year, month, 0, 23, 59, 59)
    } else {
      return createErrorResponse('Month and year, or date range is required', 400)
    }

    // Auto-scope by campus (filter via the locker relation since
    // locker_transaction has no campus column of its own).
    const effectiveCampus = await resolveReportCampus(session, queryCampus)
    const campusWhere = effectiveCampus ? { locker: { campus: effectiveCampus } } : {}

    // Fetch all locker transactions that overlap with the month
    const lockerTransactions = await prisma.lockerTransaction.findMany({
      where: {
        ...campusWhere,
        OR: [
          {
            // Transactions that started in this month
            borrow_time: {
              gte: startDate,
              lte: endDate,
            },
          },
          {
            // Transactions that started before but ended (or still active) during this month
            AND: [
              {
                borrow_time: {
                  lt: startDate,
                },
              },
              {
                OR: [
                  {
                    return_time: {
                      gte: startDate,
                    },
                  },
                  {
                    return_time: null, // Still active
                  },
                ],
              },
            ],
          },
        ],
      },
      include: {
        user: {
          select: {
            user_id: true,
            user_type: true,
            grade_level_id: true,
            section_id: true,
            department_id: true,
            program_id: true,
            user_account: {
              select: {
                role: true,
              },
            },
          },
        },
      },
      orderBy: {
        borrow_time: 'asc',
      },
    })

    // Fetch holidays for the month
    const holidays = await prisma.holiday.findMany({
      where: {
        OR: [
          {
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
          {
            end_date: {
              gte: startDate,
              lte: endDate,
            },
          },
          {
            AND: [
              { date: { lte: startDate } },
              { end_date: { gte: endDate } },
            ],
          },
        ],
      },
    })

    // Initialize daily data structure
    const dailyData: Array<{
      date: string
      dayOfWeek: string
      dayOfMonth: number
      hours: Record<number, number>
      total: number
      uniqueCount: number
      uniqueUsers: Set<number>
      holiday?: { name: string; description?: string | null }
    }> = []

    // Initialize hourly totals (7 AM to 7 PM = hours 7-19)
    const hourlyTotals: Record<number, number> = {}
    for (let h = 7; h <= 19; h++) {
      hourlyTotals[h] = 0
    }

    // User type statistics
    const userTypeStats: Record<string, number> = {
      ADMIN: 0,
      FACULTY: 0,
      EMPLOYEE: 0,
      GUEST: 0,
      ALUMNI: 0,
      'BASIC EDUCATION STUDENTS': 0,
      'COLLEGE STUDENTS': 0,
    }

    // Track unique users per day
    const uniqueUsersPerDay = new Map<string, Set<number>>()

    // Track today's date for data processing (don't count future transactions)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    
    // Create daily data for each day in the date range (including future days, but they'll have 0 data)
    let currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' })
      const dayOfMonth = currentDate.getDate()
      // Format date in local timezone to avoid UTC shift
      const year = currentDate.getFullYear()
      const month = String(currentDate.getMonth() + 1).padStart(2, '0')
      const day = String(currentDate.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      
      // Check if this day is a holiday
      const dayHoliday = holidays.find(h => {
        // Parse dates in local timezone to avoid UTC shift
        // Extract date from ISO string to avoid timezone conversion
        const dateValue = h.date instanceof Date ? h.date : new Date(h.date)
        const dateStr = dateValue.toISOString().split('T')[0]
        const dateParts = dateStr.split('-').map(Number)
        const hStart = new Date(dateParts[0], dateParts[1] - 1, dateParts[2])
        
        let hEnd: Date
        if (h.end_date) {
          const endValue = h.end_date instanceof Date ? h.end_date : new Date(h.end_date)
          const endStr = endValue.toISOString().split('T')[0]
          const endParts = endStr.split('-').map(Number)
          hEnd = new Date(endParts[0], endParts[1] - 1, endParts[2])
        } else {
          hEnd = new Date(hStart)
        }
        
        return currentDate >= hStart && currentDate <= hEnd
      })

      const hours: Record<number, number> = {}
      for (let h = 7; h <= 19; h++) {
        hours[h] = 0
      }

      uniqueUsersPerDay.set(dateStr, new Set<number>())

      dailyData.push({
        date: dateStr,
        dayOfWeek,
        dayOfMonth,
        hours,
        total: 0,
        uniqueCount: 0,
        uniqueUsers: uniqueUsersPerDay.get(dateStr)!,
        holiday: dayHoliday ? { name: dayHoliday.name, description: dayHoliday.description } : undefined,
      })
      
      // Move to next day
      currentDate = new Date(currentDate)
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Track which user categories have been counted (for user type stats)
    const userTypeCounted = new Set<string>()

    // Process locker transactions - count concurrent active lockers per hour (only for days up to today)
    for (let i = 0; i < dailyData.length; i++) {
      const dayData = dailyData[i]
      const dayDate = new Date(dayData.date)
      
      // Skip processing future days (they'll show 0s)
      if (dayDate > today) continue

      for (let hour = 7; hour <= 19; hour++) {
        const hourStart = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), hour, 0, 0)
        const hourEnd = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), hour, 59, 59)

        // Skip future hours (hours that haven't started yet) so that the
        // current in-progress hour is still counted. Otherwise an active
        // locker would be auto-populated into every hour until 7 PM, even
        // for hours that have not yet occurred.
        if (hourStart > now) {
          dayData.hours[hour] = 0
          continue
        }

        // Count active locker transactions during this hour
        const activeUsers = new Set<number>()
        
        lockerTransactions.forEach(transaction => {
          const borrowTime = new Date(transaction.borrow_time)
          const returnTime = transaction.return_time ? new Date(transaction.return_time) : null

          // Locker was active if:
          // - Borrowed before/during this hour AND
          // - Either not returned yet OR returned during/after this hour
          if (
            borrowTime <= hourEnd &&
            (!returnTime || returnTime >= hourStart)
          ) {
            activeUsers.add(transaction.user_id)
            dayData.uniqueUsers.add(transaction.user_id)

            // Count for user type stats (only once per user)
            const userKey = `${transaction.user_id}-${transaction.user?.user_account?.role || ''}-${transaction.user?.user_type || ''}`
            if (!userTypeCounted.has(userKey)) {
              userTypeCounted.add(userKey)

              const category = categorizeUserForEntranceExit({
                role: transaction.user?.user_account?.role,
                user_type: transaction.user?.user_type,
                grade_level_id: transaction.user?.grade_level_id,
                section_id: transaction.user?.section_id,
                department_id: transaction.user?.department_id,
                program_id: transaction.user?.program_id,
              })

              switch (category) {
                case 'ADMIN':
                  userTypeStats.ADMIN++
                  break
                case 'FACULTY':
                  userTypeStats.FACULTY++
                  break
                case 'EMPLOYEE':
                  userTypeStats.EMPLOYEE++
                  break
                case 'GUEST':
                  userTypeStats.GUEST++
                  break
                case 'ALUMNI':
                  userTypeStats.ALUMNI++
                  break
                case 'BASIC_EDUCATION':
                  userTypeStats['BASIC EDUCATION STUDENTS']++
                  break
                case 'COLLEGE_STUDENTS':
                  userTypeStats['COLLEGE STUDENTS']++
                  break
              }
            }
          }
        })

        const concurrentCount = activeUsers.size
        dayData.hours[hour] = concurrentCount
        dayData.total += concurrentCount
        hourlyTotals[hour] += concurrentCount
      }
    }

    // Convert uniqueUsers Sets to counts
    const finalDailyData = dailyData.map(day => {
      const uniqueCount = day.uniqueUsers.size
      const { uniqueUsers, ...rest } = day
      return {
        ...rest,
        uniqueCount,
      }
    })

    // Calculate summary statistics
    const totalConcurrentCount = Object.values(hourlyTotals).reduce((sum, val) => sum + val, 0)
    const totalDays = dailyData.length
    const averagePerDay = totalConcurrentCount / (totalDays * 13) // 13 hours per day

    // Calculate peak hours
    const peakHours = Object.entries(hourlyTotals)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .filter(({ count }) => count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Calculate hourly averages
    const hourlyAverages: Record<number, number> = {}
    for (let h = 7; h <= 19; h++) {
      hourlyAverages[h] = Math.round((hourlyTotals[h] / totalDays) * 10) / 10
    }

    // Calculate total unique users across the month
    const allUniqueUsers = new Set<number>()
    dailyData.forEach(day => day.uniqueUsers.forEach(userId => allUniqueUsers.add(userId)))
    const totalUniqueUsers = allUniqueUsers.size

    // Calculate max and average occupancy
    const allHourlyCounts = finalDailyData.flatMap(day => Object.values(day.hours))
    const maxOccupancy = Math.max(...allHourlyCounts, 0)
    const averageOccupancy = Math.round((totalConcurrentCount / (totalDays * 13)) * 10) / 10

    const reportData: LockerStatisticsReportData = {
      month,
      year,
      dailyData: finalDailyData,
      hourlyTotals,
      hourlyAverages,
      peakHours,
      userTypeStats,
      summary: {
        totalAssignments: totalConcurrentCount,
        totalDays,
        averagePerDay: Math.round(averagePerDay * 10) / 10,
        maxOccupancy,
        averageOccupancy,
        peakHour: peakHours.length > 0 ? peakHours[0].hour : undefined,
        totalUniqueUsers,
      },
    }

    return createSuccessResponse(reportData)
  } catch (error) {
    console.error('Error generating locker concurrent statistics report:', error)
    return createErrorResponse('Failed to generate locker concurrent statistics report', 500)
  }
}, [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STAFF])
