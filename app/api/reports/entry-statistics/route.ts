import { NextRequest } from 'next/server'
import { UserRole, Campus } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

/**
 * Auto-scope STAFF to their own campus, mirror entry-logs resolver.
 * ADMIN / SUPER_ADMIN can pass an explicit `campus` query param.
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

export const GET = withAuth(
  async (req: NextRequest, session) => {
    try {
      const searchParams = req.nextUrl.searchParams
      const monthParam = searchParams.get('month')
      const yearParam = searchParams.get('year')
      const dateFrom = searchParams.get('date_from')
      const dateTo = searchParams.get('date_to')
      const queryCampus = searchParams.get('campus')

      // Determine date range
      let startDate: Date
      let endDate: Date
      let monthNum: number
      let yearNum: number

      if (dateFrom && dateTo) {
        // Parse dates and set to local timezone with proper time boundaries
        const fromParts = dateFrom.split('-').map(Number)
        const toParts = dateTo.split('-').map(Number)
        startDate = new Date(fromParts[0], fromParts[1] - 1, fromParts[2], 0, 0, 0, 0)
        endDate = new Date(toParts[0], toParts[1] - 1, toParts[2], 23, 59, 59, 999)
        monthNum = startDate.getMonth() + 1
        yearNum = startDate.getFullYear()
      } else if (monthParam && yearParam) {
        monthNum = parseInt(monthParam)
        yearNum = parseInt(yearParam)
        
        if (isNaN(monthNum) || isNaN(yearNum) || monthNum < 1 || monthNum > 12) {
          return createErrorResponse('Invalid month or year', 400)
        }
        
        startDate = new Date(yearNum, monthNum - 1, 1)
        endDate = new Date(yearNum, monthNum, 0, 23, 59, 59, 999)
      } else {
        return createErrorResponse('Month and year, or date range is required', 400)
      }
      
      // Only include days up to today (don't process future days)
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      if (endDate > today) {
        endDate = today
      }

      // Auto-scope by campus
      const effectiveCampus = await resolveReportCampus(session, queryCampus)
      const campusWhere = effectiveCampus ? { campus: effectiveCampus } : {}

      // Fetch holidays for the period
      const holidays = await prisma.holiday.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate
          },
          is_active: true
        }
      })

      const holidayMap = new Map(
        holidays.map(h => {
          // Parse date in local timezone to avoid UTC shift
          // Handle both Date objects and strings - extract date parts directly
          const dateValue = h.date instanceof Date ? h.date : new Date(h.date)
          const year = dateValue.getFullYear()
          const month = String(dateValue.getMonth() + 1).padStart(2, '0')
          const day = String(dateValue.getDate()).padStart(2, '0')
          const dateStr = `${year}-${month}-${day}`
          return [dateStr, h]
        })
      )

      // Fetch all entry logs for the period with user details
      const entryLogs = await prisma.entryLog.findMany({
        where: {
          ...campusWhere,
          entry_time: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          user: {
            include: {
              department_ref: {
                select: { name: true, code: true }
              },
              program: {
                select: { name: true, code: true }
              },
              grade_level: {
                select: { name: true, code: true, education_level: true }
              },
              section: {
                select: { name: true }
              },
              office_ref: {
                select: { name: true, code: true }
              }
            }
          }
        },
        orderBy: {
          entry_time: 'asc'
        }
      })

      // Process data by date and hour
      const dailyHourlyData: Record<string, Record<number, number>> = {}
      const userTypeStats: Record<string, number> = {
        STUDENT: 0,
        EMPLOYEE: 0,
        FACULTY: 0,
        GUEST: 0,
        ALUMNI: 0
      }
      const gradeLevelStats: Record<string, number> = {}

      entryLogs.forEach(log => {
        const entryDate = new Date(log.entry_time)
        const dateKey = entryDate.toISOString().split('T')[0]
        const hour = entryDate.getHours()

        // Initialize daily data if not exists
        if (!dailyHourlyData[dateKey]) {
          dailyHourlyData[dateKey] = {}
        }

        // Count entry for this hour
        dailyHourlyData[dateKey][hour] = (dailyHourlyData[dateKey][hour] || 0) + 1

        // Count by user type
        const userType = log.user.user_type
        userTypeStats[userType] = (userTypeStats[userType] || 0) + 1

        // Count by grade level for students
        if (log.user.grade_level) {
          const gradeName = log.user.grade_level.name
          gradeLevelStats[gradeName] = (gradeLevelStats[gradeName] || 0) + 1
        }
      })

      // Format for frontend
      const dailyData = Object.entries(dailyHourlyData).map(([date, hours]) => {
        const dateObj = new Date(date)
        const holiday = holidayMap.get(date)
        
        return {
          date,
          dayOfWeek: dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
          dayOfMonth: dateObj.getDate(),
          hours,
          total: Object.values(hours).reduce((sum, count) => sum + count, 0),
          holiday: holiday ? {
            name: holiday.name,
            description: holiday.description,
            start_time: holiday.start_time,
            end_time: holiday.end_time
          } : null
        }
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      // Calculate totals per hour slot across all days
      const hourlyTotals: Record<number, number> = {}
      dailyData.forEach(day => {
        Object.entries(day.hours).forEach(([hour, count]) => {
          const h = parseInt(hour)
          hourlyTotals[h] = (hourlyTotals[h] || 0) + count
        })
      })

      return createSuccessResponse({
        period: {
          month: monthNum,
          year: yearNum,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        dailyData,
        hourlyTotals,
        userTypeStats,
        gradeLevelStats,
        summary: {
          totalEntries: entryLogs.length,
          totalDays: dailyData.length,
          averagePerDay: Math.round(entryLogs.length / (dailyData.length || 1))
        }
      })
    } catch (error) {
      console.error('Error fetching entry statistics:', error)
      return createErrorResponse('Failed to fetch entry statistics', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
