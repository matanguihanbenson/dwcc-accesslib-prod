import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

// GET all holidays
export const GET = withAuth(
  async (req: NextRequest) => {
    try {
      const searchParams = req.nextUrl.searchParams
      const year = searchParams.get('year')
      const month = searchParams.get('month')
      const activeOnly = searchParams.get('active_only') === 'true'

      const where: any = {}

      if (activeOnly) {
        where.is_active = true
      }

      // Filter by year/month if provided
      if (year) {
        const yearNum = parseInt(year)
        const monthNum = month ? parseInt(month) : null

        if (monthNum) {
          // Specific month
          const startDate = new Date(yearNum, monthNum - 1, 1)
          const endDate = new Date(yearNum, monthNum, 0)
          where.date = {
            gte: startDate,
            lte: endDate
          }
        } else {
          // Entire year
          const startDate = new Date(yearNum, 0, 1)
          const endDate = new Date(yearNum, 11, 31)
          where.date = {
            gte: startDate,
            lte: endDate
          }
        }
      }

      const holidays = await prisma.holiday.findMany({
        where,
        orderBy: {
          date: 'asc'
        }
      })

      return createSuccessResponse(holidays)
    } catch (error) {
      console.error('Error fetching holidays:', error)
      return createErrorResponse('Failed to fetch holidays', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)

// POST create holiday
export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const body = await req.json()
      const { name, date, end_date, description, is_recurring, start_time, end_time } = body

      // Validation
      if (!name || !date) {
        return createErrorResponse('Name and date are required', 400)
      }

      // Parse dates
      const holidayDate = new Date(date)
      if (isNaN(holidayDate.getTime())) {
        return createErrorResponse('Invalid date format', 400)
      }

      let holidayEndDate = null
      if (end_date) {
        holidayEndDate = new Date(end_date)
        if (isNaN(holidayEndDate.getTime())) {
          return createErrorResponse('Invalid end_date format', 400)
        }
        if (holidayEndDate < holidayDate) {
          return createErrorResponse('End date must be after or equal to start date', 400)
        }
      }

      // Validate time format if provided
      if (start_time && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(start_time)) {
        return createErrorResponse('Invalid start_time format (use HH:MM)', 400)
      }

      if (end_time && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(end_time)) {
        return createErrorResponse('Invalid end_time format (use HH:MM)', 400)
      }

      // Check for duplicate (same date and name)
      const existing = await prisma.holiday.findFirst({
        where: {
          name,
          date: holidayDate,
          is_active: true
        }
      })

      if (existing) {
        return createErrorResponse(
          'A holiday with this name already exists on this date. You can create multiple events on the same date with different names.',
          400
        )
      }

      // Warn if creating holiday in the past
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const isPast = holidayDate < today

      const holiday = await prisma.holiday.create({
        data: {
          name,
          date: holidayDate,
          end_date: holidayEndDate,
          description: description || null,
          is_recurring: is_recurring || false,
          start_time: start_time || null,
          end_time: end_time || null
        }
      })

      return createSuccessResponse(
        holiday,
        isPast ? 'Holiday created (Note: This date is in the past)' : 'Holiday created successfully'
      )
    } catch (error) {
      console.error('Error creating holiday:', error)
      return createErrorResponse('Failed to create holiday', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
)
