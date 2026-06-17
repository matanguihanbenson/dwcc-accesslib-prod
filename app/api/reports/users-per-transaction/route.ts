import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(
  async (req: NextRequest, session) => {
    try {
      const searchParams = req.nextUrl.searchParams
      const monthParam = searchParams.get('month')
      const yearParam = searchParams.get('year')
      const dateFrom = searchParams.get('date_from')
      const dateTo = searchParams.get('date_to')

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
        
        if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
          return createErrorResponse('Invalid month or year', 400)
        }
        
        startDate = new Date(year, month - 1, 1)
        endDate = new Date(year, month, 0, 23, 59, 59)
      } else {
        return createErrorResponse('Month and year, or date range is required', 400)
      }

      // Get all entry logs within the date range
      const entryLogs = await prisma.entryLog.findMany({
        where: {
          entry_time: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          user: {
            select: {
              user_id: true,
              user_type: true,
              department_ref: { select: { name: true } },
              grade_level: { select: { name: true, education_level: true } },
              program: { select: { name: true } }
            }
          }
        },
        orderBy: {
          entry_time: 'asc'
        }
      })

      // Fetch holidays
      const holidays = await prisma.holiday.findMany({
        where: {
          is_active: true,
          OR: [
            {
              date: {
                gte: startDate,
                lte: endDate
              }
            },
            {
              end_date: {
                gte: startDate
              },
              date: {
                lt: startDate
              }
            }
          ]
        }
      })

      // Helper function to format date
      const formatLocalDate = (date: Date): string => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }

      const holidayMap = new Map<string, { name: string; description?: string | null }>()

      const addHolidayForDate = (d: Date, h: typeof holidays[number]) => {
        const localDateStr = formatLocalDate(d)
        if (!holidayMap.has(localDateStr)) {
          holidayMap.set(localDateStr, { name: h.name, description: h.description })
        }
      }

      holidays.forEach(h => {
        // Parse dates in local timezone to avoid UTC shift
        // Extract date from ISO string to avoid timezone conversion
        const dateValue = h.date instanceof Date ? h.date : new Date(h.date)
        const dateStr = dateValue.toISOString().split('T')[0]
        const dateParts = dateStr.split('-').map(Number)
        const start = new Date(dateParts[0], dateParts[1] - 1, dateParts[2])
        
        let end: Date
        if (h.end_date) {
          const endValue = h.end_date instanceof Date ? h.end_date : new Date(h.end_date)
          const endStr = endValue.toISOString().split('T')[0]
          const endParts = endStr.split('-').map(Number)
          end = new Date(endParts[0], endParts[1] - 1, endParts[2])
        } else {
          end = new Date(start)
        }
        
        let cur = new Date(Math.max(start.getTime(), startDate.getTime()))
        const last = new Date(Math.min(end.getTime(), endDate.getTime()))

        while (cur <= last) {
          addHolidayForDate(cur, h)
          cur = new Date(cur)
          cur.setDate(cur.getDate() + 1)
        }
      })

      // Initialize daily data for the date range (show all days including future, but future will have 0 data)
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      
      const dailyDataMap = new Map<string, any>()
      const dailyUniqueUsersMap = new Map<string, Set<number>>()

      let currentDate = new Date(startDate)
      while (currentDate <= endDate) {
        const dateStr = formatLocalDate(currentDate)
        const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' })
        const dayOfMonth = currentDate.getDate()
        
        dailyDataMap.set(dateStr, {
          date: dateStr,
          dayOfWeek,
          dayOfMonth,
          hours: {} as Record<number, number>,
          total: 0,
          holiday: holidayMap.get(dateStr)
        })

        dailyUniqueUsersMap.set(dateStr, new Set<number>())
        
        currentDate = new Date(currentDate)
        currentDate.setDate(currentDate.getDate() + 1)
      }

      // Count entry transactions per hour (7 AM to 7 PM)
      const hourRange = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
      const hourlyTotals: Record<number, number> = {}
      hourRange.forEach(h => hourlyTotals[h] = 0)

      // Initialize hours for each day
      dailyDataMap.forEach(dayData => {
        hourRange.forEach(h => dayData.hours[h] = 0)
      })

      // Process entry logs - count transactions started per hour
      entryLogs.forEach(log => {
        const entryTime = new Date(log.entry_time)
        const hour = entryTime.getHours()
        const dateStr = formatLocalDate(entryTime)

        // Only count entries within library hours (7 AM to 7 PM)
        if (hour >= 7 && hour <= 19) {
          const dayData = dailyDataMap.get(dateStr)
          if (dayData) {
            dayData.hours[hour]++
            dayData.total++
            hourlyTotals[hour]++

            const dayUsers = dailyUniqueUsersMap.get(dateStr)
            if (dayUsers) {
              dayUsers.add(log.user_id)
            }
          }
        }
      })

      // Add unique counts to daily data
      dailyDataMap.forEach((dayData, dateStr) => {
        const dayUsers = dailyUniqueUsersMap.get(dateStr)
        dayData.uniqueCount = dayUsers ? dayUsers.size : 0
      })

      // Calculate hourly averages
      const hourlyAverages: Record<number, number> = {}
      hourRange.forEach(hour => {
        hourlyAverages[hour] = Math.round((hourlyTotals[hour] / dailyDataMap.size) * 10) / 10
      })

      // Find peak hours
      const peakHours = hourRange
        .map(hour => ({ hour, count: hourlyTotals[hour] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      // User type breakdown - only count users from entries during library hours (7 AM - 7 PM)
      const uniqueUsers = new Map<number, string>()
      entryLogs.forEach(log => {
        const hour = new Date(log.entry_time).getHours()
        if (hour >= 7 && hour <= 19 && !uniqueUsers.has(log.user_id)) {
          uniqueUsers.set(log.user_id, log.user.user_type)
        }
      })

      const userTypeBreakdown: Record<string, number> = {}
      uniqueUsers.forEach(userType => {
        userTypeBreakdown[userType] = (userTypeBreakdown[userType] || 0) + 1
      })

      // Grade level statistics
      const gradeLevelStats: Record<string, number> = {}
      entryLogs.forEach(log => {
        if (log.user.grade_level) {
          const level = log.user.grade_level.name
          gradeLevelStats[level] = (gradeLevelStats[level] || 0) + 1
        }
      })

      // Calculate summary statistics
      const maxOccupancy = Math.max(...Object.values(hourlyTotals), 0)
      const totalEntries = entryLogs.filter(log => {
        const hour = new Date(log.entry_time).getHours()
        return hour >= 7 && hour <= 19
      }).length
      const averageOccupancy = dailyDataMap.size > 0 ? Math.round((totalEntries / (dailyDataMap.size * hourRange.length)) * 10) / 10 : 0

      return createSuccessResponse({
        period: {
          month,
          year,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        dailyData: Array.from(dailyDataMap.values()),
        hourlyAverages,
        hourlyTotals,
        peakHours,
        userTypeStats: userTypeBreakdown,
        gradeLevelStats,
        summary: {
          totalEntries: totalEntries,
          totalDays: dailyDataMap.size,
          averagePerDay: Math.round((totalEntries / dailyDataMap.size) * 10) / 10,
          maxOccupancy,
          averageOccupancy,
          peakHour: peakHours[0]?.hour,
          totalUniqueUsers: uniqueUsers.size
        }
      })
    } catch (error) {
      console.error('Error fetching users-per-transaction statistics:', error)
      return createErrorResponse('Failed to fetch users-per-transaction statistics', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
