import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

// POST auto-apply recurring holidays for a specific year
export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const body = await req.json()
      const { year } = body

      if (!year) {
        return createErrorResponse('Year is required', 400)
      }

      const yearNum = parseInt(year)
      if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
        return createErrorResponse('Invalid year', 400)
      }

      // Get all recurring holidays
      const recurringHolidays = await prisma.holiday.findMany({
        where: {
          is_recurring: true,
          is_active: true
        }
      })

      if (recurringHolidays.length === 0) {
        return createErrorResponse('No recurring holidays found', 404)
      }

      const created: any[] = []
      const skipped: any[] = []

      for (const holiday of recurringHolidays) {
        const originalDate = new Date(holiday.date)
        const newDate = new Date(yearNum, originalDate.getMonth(), originalDate.getDate())

        // Check if already exists for this year
        const existing = await prisma.holiday.findFirst({
          where: {
            name: holiday.name,
            date: newDate,
            is_active: true
          }
        })

        if (existing) {
          skipped.push({ name: holiday.name, date: newDate, reason: 'Already exists' })
          continue
        }

        // Create new holiday for this year
        const newHoliday = await prisma.holiday.create({
          data: {
            name: holiday.name,
            date: newDate,
            description: holiday.description,
            is_recurring: false,
            start_time: holiday.start_time,
            end_time: holiday.end_time
          }
        })

        created.push(newHoliday)
      }

      return createSuccessResponse(
        { created, skipped },
        `Applied ${created.length} recurring holidays to year ${yearNum}. ${skipped.length} skipped.`
      )
    } catch (error) {
      console.error('Error applying recurring holidays:', error)
      return createErrorResponse('Failed to apply recurring holidays', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
)
