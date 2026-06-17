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

      // Filter logs to only include entries during library hours (7 AM - 7 PM)
      const filteredLogs = entryLogs.filter(log => {
        const entryTime = new Date(log.entry_time)
        const hour = entryTime.getHours()
        // Only include entries between 7 AM (7) and 7 PM (19)
        return hour >= 7 && hour <= 19
      })

      // Fetch holidays that overlap the period (single-day or ranges)
      const holidays = await prisma.holiday.findMany({
        where: {
          is_active: true,
          OR: [
            {
              // start date within period
              date: {
                gte: startDate,
                lte: endDate
              }
            },
            {
              // ranges that start before but end inside/after the period
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

      // Helper function to format date as YYYY-MM-DD in local timezone
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

      // Expand each holiday across its date range (or single date)
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

        // Clamp to reporting period
        let cur = new Date(Math.max(start.getTime(), startDate.getTime()))
        const last = new Date(Math.min(end.getTime(), endDate.getTime()))

        while (cur <= last) {
          addHolidayForDate(cur, h)
          cur = new Date(cur)
          cur.setDate(cur.getDate() + 1)
        }
      })

      // Process data by date and hour
      const dailyDataMap = new Map<string, any>()
      const dailyUniqueUsersMap = new Map<string, Set<number>>()

      // Initialize days in the actual date range (show all days including future, but future will have 0 data)
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      
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
          peakHour: 0,
          peakCount: 0,
          averageOccupancy: 0,
          holiday: holidayMap.get(dateStr)
        })

        // Track unique users for each day
        dailyUniqueUsersMap.set(dateStr, new Set<number>())
        
        // Move to next day
        currentDate = new Date(currentDate)
        currentDate.setDate(currentDate.getDate() + 1)
      }
      
      const totalDays = dailyDataMap.size

      // Count users present per hour (7 AM to 7 PM)
      const hourRange = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19] // 7 AM to 7 PM

      for (const [dateStr, dayData] of dailyDataMap.entries()) {
        const date = new Date(dateStr)
        const now = new Date()
        
        for (const hour of hourRange) {
          const hourStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0)
          const hourEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 59, 59)

          // Skip future hours (hours that haven't started yet) so that the
          // current in-progress hour is still counted (otherwise a 10:09 AM
          // entry wouldn't appear under the 10 AM slot until 11:00 AM).
          if (hourStart > now) {
            dayData.hours[hour] = 0
            continue
          }

          // Count unique users present during this hour
          const usersPresent = new Set<number>()
          
          // Check ALL logs in the entire date range, not just logs from this specific day
          for (const log of entryLogs) {
            const entryTime = new Date(log.entry_time)
            const exitTime = log.exit_time ? new Date(log.exit_time) : null

            // User was in library if:
            // - They entered before/during this hour AND
            // - They either haven't exited yet OR exited during/after this hour
            if (
              entryTime <= hourEnd &&
              (!exitTime || exitTime >= hourStart)
            ) {
              usersPresent.add(log.user_id)
              // Also count this user as present for the day
              const dayUsers = dailyUniqueUsersMap.get(dateStr)
              if (dayUsers) {
                dayUsers.add(log.user_id)
              }
            }
          }

          dayData.hours[hour] = usersPresent.size
        }

        // Calculate peak hour for this day
        let maxCount = 0
        let peakHour = 0
        for (const hour of hourRange) {
          if (dayData.hours[hour] > maxCount) {
            maxCount = dayData.hours[hour]
            peakHour = hour
          }
        }
        dayData.peakHour = peakHour
        dayData.peakCount = maxCount

        // Calculate average occupancy for the day
        const totalOccupancy = hourRange.reduce((sum, hour) => sum + (dayData.hours[hour] || 0), 0)
        dayData.averageOccupancy = Math.round(totalOccupancy / hourRange.length)

        // Store unique user count for this day
        const dayUsers = dailyUniqueUsersMap.get(dateStr)
        dayData.uniqueCount = dayUsers ? dayUsers.size : 0
      }

      // Calculate hourly totals and averages across all days
      const hourlyTotals: Record<number, number> = {}
      const hourlyAverages: Record<number, number> = {}
      for (const hour of hourRange) {
        const total = Array.from(dailyDataMap.values())
          .reduce((sum, day) => sum + (day.hours[hour] || 0), 0)
        hourlyTotals[hour] = total
        hourlyAverages[hour] = totalDays > 0 ? Math.round(total / totalDays) : 0
      }

      // Find overall peak hours (use totals, not averages)
      const peakHours = hourRange
        .map(hour => ({ hour, count: hourlyTotals[hour] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      // User type breakdown (unique users who visited during the period)
      const uniqueUsers = new Map<number, string>()
      filteredLogs.forEach(log => {
        if (!uniqueUsers.has(log.user_id)) {
          uniqueUsers.set(log.user_id, log.user.user_type)
        }
      })

      const userTypeBreakdown: Record<string, number> = {}
      uniqueUsers.forEach(userType => {
        userTypeBreakdown[userType] = (userTypeBreakdown[userType] || 0) + 1
      })

      // Calculate summary statistics
      const allHourlyCounts = Array.from(dailyDataMap.values())
        .flatMap(day => hourRange.map(hour => day.hours[hour] || 0))
      const maxOccupancy = Math.max(...allHourlyCounts, 0)
      const averageOccupancy = Math.round(
        allHourlyCounts.reduce((sum, count) => sum + count, 0) / allHourlyCounts.length
      )
      const overallPeakHour = peakHours[0]?.hour || 0

      // Grade level statistics
      const gradeLevelStats: Record<string, number> = {}
      filteredLogs.forEach(log => {
        if (log.user.grade_level) {
          const level = log.user.grade_level.name
          gradeLevelStats[level] = (gradeLevelStats[level] || 0) + 1
        }
      })

      return createSuccessResponse({
        period: {
          month,
          year,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        dailyData: Array.from(dailyDataMap.values()),
        hourlyAverages,
        hourlyTotals: hourlyAverages, // Alias for compatibility
        peakHours,
        userTypeStats: userTypeBreakdown,
        gradeLevelStats,
        summary: {
          maxOccupancy,
          averageOccupancy,
          peakHour: overallPeakHour,
          totalUniqueUsers: uniqueUsers.size,
          totalVisits: filteredLogs.length
        }
      })
    } catch (error) {
      console.error('Error fetching users-per-hour statistics:', error)
      return createErrorResponse('Failed to fetch users-per-hour statistics', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
