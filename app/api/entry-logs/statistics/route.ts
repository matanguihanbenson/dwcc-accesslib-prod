import { NextRequest } from 'next/server'
import { UserRole, Campus } from '@/types'
import { withAuth, createSuccessResponse, getSearchParams } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(
  async (req: NextRequest, session) => {
    try {
      console.log('Fetching entry statistics...')

      const filters = getSearchParams(req)

      // Auto-scope STAFF users to their own campus, matching the
      // behavior of /api/entry-logs. ADMIN / SUPER_ADMIN can pass an
      // explicit `campus` query param (or leave it empty for all).
      let effectiveCampus: Campus | undefined
      if (filters.campus === Campus.COLLEGE || filters.campus === Campus.BASIC_EDUCATION) {
        effectiveCampus = filters.campus
      }
      if (session?.user?.role === UserRole.STAFF) {
        const accountId = parseInt(session.user.id || '0')
        if (!isNaN(accountId) && accountId > 0) {
          const account = await prisma.userAccount.findUnique({
            where: { id: accountId },
            select: { campus: true }
          })
          if (account?.campus) {
            effectiveCampus = account.campus
          }
        }
      }

      // The `campus` column lives directly on entrylog, so a single
      // shared `campusWhere` clause covers every count / findMany below.
      const campusWhere = effectiveCampus ? { campus: effectiveCampus } : {}

      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - today.getDay())

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      // Basic statistics first
      console.log('Fetching basic counts...')
      const totalToday = await prisma.entryLog.count({
        where: {
          ...campusWhere,
          entry_time: { gte: today, lt: tomorrow }
        }
      })

      const totalThisWeek = await prisma.entryLog.count({
        where: {
          ...campusWhere,
          entry_time: { gte: startOfWeek, lte: now }
        }
      })

      const totalThisMonth = await prisma.entryLog.count({
        where: {
          ...campusWhere,
          entry_time: { gte: startOfMonth, lte: now }
        }
      })

      const currentlyInside = await prisma.entryLog.count({
        where: { ...campusWhere, exit_time: null }
      })

      // Get unique user counts using DISTINCT user_id
      console.log('Fetching unique user counts...')
      const uniqueUsersToday = await prisma.entryLog.findMany({
        where: {
          ...campusWhere,
          entry_time: { gte: today, lt: tomorrow }
        },
        select: { user_id: true },
        distinct: ['user_id']
      })

      const uniqueUsersWeek = await prisma.entryLog.findMany({
        where: {
          ...campusWhere,
          entry_time: { gte: startOfWeek, lte: now }
        },
        select: { user_id: true },
        distinct: ['user_id']
      })

      const uniqueUsersMonth = await prisma.entryLog.findMany({
        where: {
          ...campusWhere,
          entry_time: { gte: startOfMonth, lte: now }
        },
        select: { user_id: true },
        distinct: ['user_id']
      })

      console.log('Basic stats:', { 
        totalToday, 
        totalThisWeek, 
        totalThisMonth, 
        currentlyInside,
        uniqueCountToday: uniqueUsersToday.length,
        uniqueCountWeek: uniqueUsersWeek.length,
        uniqueCountMonth: uniqueUsersMonth.length
      })

      // Simplified hourly trends (just for today)
      const hourlyTrends = []
      for (let i = 0; i < 24; i++) {
        const hourStart = new Date(today)
        hourStart.setHours(i, 0, 0, 0)
        const hourEnd = new Date(hourStart)
        hourEnd.setHours(i + 1, 0, 0, 0)

        const count = await prisma.entryLog.count({
          where: {
            ...campusWhere,
            entry_time: { gte: hourStart, lt: hourEnd }
          }
        })

        hourlyTrends.push({
          hour: `${i.toString().padStart(2, '0')}:00`,
          entries: count
        })
      }

      // Find peak hour
      const peakHourData = hourlyTrends.reduce((max, current) =>
        current.entries > max.entries ? current : max,
        hourlyTrends[0]
      )

      // Department breakdown - simplified
      const departmentBreakdown: { [key: string]: number } = {}
      try {
        const departmentStats = await prisma.entryLog.findMany({
          where: {
            ...campusWhere,
            entry_time: { gte: today, lt: tomorrow }
          },
          include: {
            user: {
              select: {
                year_level: true,
                department_ref: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        })

        departmentStats.forEach(entry => {
          const dept = entry.user?.department_ref?.name || 'Unknown'
          departmentBreakdown[dept] = (departmentBreakdown[dept] || 0) + 1
        })
      } catch (deptError) {
        console.error('Error fetching department breakdown:', deptError)
        departmentBreakdown['Unknown'] = totalToday
      }

      const statistics = {
        totalToday,
        totalThisWeek,
        totalThisMonth,
        uniqueUsersToday: uniqueUsersToday.length,
        uniqueUsersWeek: uniqueUsersWeek.length,
        uniqueUsersMonth: uniqueUsersMonth.length,
        currentlyInside,
        peakHour: peakHourData?.hour || 'N/A',
        departmentBreakdown,
        yearLevelDistribution: { 'N/A': totalToday }, // Simplified for now
        hourlyTrends
      }

      console.log('Statistics computed successfully:', statistics)
      return createSuccessResponse({ statistics })
    } catch (error) {
      console.error('Error fetching entry statistics:', error)
      // Return basic fallback statistics instead of throwing
      const fallbackStats = {
        totalToday: 0,
        totalThisWeek: 0,
        totalThisMonth: 0,
        uniqueUsersToday: 0,
        uniqueUsersWeek: 0,
        uniqueUsersMonth: 0,
        currentlyInside: 0,
        peakHour: 'N/A',
        departmentBreakdown: {},
        yearLevelDistribution: {},
        hourlyTrends: Array.from({ length: 24 }, (_, i) => ({
          hour: `${i.toString().padStart(2, '0')}:00`,
          entries: 0
        }))
      }
      
      return createSuccessResponse({ statistics: fallbackStats })
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
