import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { EntranceExitReportData, EntranceExitTimeRangeData } from '@/types'
import { categorizeUserForEntranceExit } from '@/lib/utils'
import { UserRole } from '@prisma/client'

/**
 * GET /api/reports/entrance-exit
 * Generate entrance/exit control statistics report
 * Query params: month (1-12), year (YYYY)
 */
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)
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
      
      // Validate month and year
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

    // Fetch all entry logs for the month with user details
    const entryLogs = await prisma.entryLog.findMany({
      where: {
        entry_time: {
          gte: startDate,
          lte: endDate,
        },
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
    })

    // Initialize time range data for 12 hourly ranges (7:00-8:00, 8:01-9:00, ..., 6:01-7:00)
    const timeRanges = [
      '7:00-8:00',
      '8:01-9:00',
      '9:01-10:00',
      '10:01-11:00',
      '11:01-12:00',
      '12:01-1:00',
      '1:01-2:00',
      '2:01-3:00',
      '3:01-4:00',
      '4:01-5:00',
      '5:01-6:00',
      '6:01-7:00',
    ]

    const timeRangeData: EntranceExitTimeRangeData[] = timeRanges.map(range => ({
      timeRange: range,
      admin: 0,
      faculty: 0,
      employee: 0,
      guest: 0,
      alumni: 0,
      basicEducation: 0,
      collegeStudents: 0,
      total: 0,
    }))

    // Process each entry log
    entryLogs.forEach(log => {
      const entryTime = new Date(log.entry_time)
      const hour = entryTime.getHours()
      const minute = entryTime.getMinutes()

      // Determine which time range this entry falls into
      // Time ranges use inclusive start, exclusive end: [7:00, 8:00)
      let rangeIndex = -1

      if (hour >= 7 && hour < 19) {
        if (hour === 7 && minute === 0) {
          rangeIndex = 0 // 7:00-8:00
        } else if (hour >= 7 && hour < 19) {
          // For 7:01 onwards, calculate range
          if (minute === 0) {
            // Exactly on the hour (8:00, 9:00, etc.) - goes to previous range
            rangeIndex = hour - 7 - 1
          } else {
            // Minutes 01-59 - goes to current range
            rangeIndex = hour - 7
          }
        }
      }

      // If entry is outside 7 AM - 7 PM range, skip it
      if (rangeIndex < 0 || rangeIndex >= 12) {
        return
      }

      // Categorize the user
      const category = categorizeUserForEntranceExit({
        role: log.user?.user_account?.role,
        user_type: log.user?.user_type,
        grade_level_id: log.user?.grade_level_id,
        section_id: log.user?.section_id,
        department_id: log.user?.department_id,
        program_id: log.user?.program_id,
      })

      // Increment the appropriate counter
      const rangeData = timeRangeData[rangeIndex]
      switch (category) {
        case 'ADMIN':
          rangeData.admin++
          break
        case 'FACULTY':
          rangeData.faculty++
          break
        case 'EMPLOYEE':
          rangeData.employee++
          break
        case 'GUEST':
          rangeData.guest++
          break
        case 'ALUMNI':
          rangeData.alumni++
          break
        case 'BASIC_EDUCATION':
          rangeData.basicEducation++
          break
        case 'COLLEGE_STUDENTS':
          rangeData.collegeStudents++
          break
      }
      rangeData.total++
    })

    // Calculate summary statistics
    const totalEntries = timeRangeData.reduce((sum, range) => sum + range.total, 0)
    const peakRange = timeRangeData.reduce((max, range) =>
      range.total > max.total ? range : max
    )
    const averagePerHour = totalEntries / 12

    const reportData: EntranceExitReportData = {
      month,
      year,
      timeRangeData,
      summary: {
        totalEntries,
        peakTimeRange: peakRange.timeRange,
        averagePerHour: Math.round(averagePerHour * 10) / 10, // Round to 1 decimal
      },
    }

    return createSuccessResponse(reportData)
  } catch (error) {
    console.error('Error generating entrance/exit report:', error)
    return createErrorResponse('Failed to generate entrance/exit report', 500)
  }
}, [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STAFF])
