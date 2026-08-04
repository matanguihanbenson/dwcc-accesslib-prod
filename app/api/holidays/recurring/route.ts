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
        // Parse the original date components as strings to avoid
        // timezone-related date shifting (e.g. Jun 12 becoming Jun 11).
        const dateStr = holiday.date instanceof Date
          ? holiday.date.toISOString().slice(0, 10)
          : String(holiday.date).slice(0, 10)
        const [, origMonth, origDay] = dateStr.split('-')

        // Build the target date as a UTC midnight Date to avoid
        // local-timezone shifts when Prisma compares DateTime values.
        const newDate = new Date(Date.UTC(yearNum, parseInt(origMonth) - 1, parseInt(origDay)))

        // Check if a holiday with the same name already exists on
        // the target date (any time on that calendar day). Using
        // gte/lt on the UTC day avoids mismatches caused by time
        // components or timezone offsets stored in the DB.
        const dayStart = new Date(Date.UTC(yearNum, parseInt(origMonth) - 1, parseInt(origDay), 0, 0, 0))
        const dayEnd = new Date(Date.UTC(yearNum, parseInt(origMonth) - 1, parseInt(origDay), 23, 59, 59, 999))

        const existing = await prisma.holiday.findFirst({
          where: {
            name: holiday.name,
            date: { gte: dayStart, lte: dayEnd },
            is_active: true
          }
        })

        if (existing) {
          skipped.push({ name: holiday.name, date: newDate.toISOString(), reason: 'Already exists' })
          continue
        }

        // Create new holiday for this year
        const newHoliday = await prisma.holiday.create({
          data: {
            name: holiday.name,
            date: newDate,
            description: holiday.description,
            is_recurring: holiday.is_recurring,
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
