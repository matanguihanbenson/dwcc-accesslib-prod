import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

// GET single holiday
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const holidayId = parseInt(id)

    if (isNaN(holidayId)) {
      return createErrorResponse('Invalid holiday ID', 400)
    }

    const holiday = await prisma.holiday.findUnique({
      where: { holiday_id: holidayId }
    })

    if (!holiday) {
      return createErrorResponse('Holiday not found', 404)
    }

    return createSuccessResponse(holiday)
  } catch (error) {
    console.error('Error fetching holiday:', error)
    return createErrorResponse('Failed to fetch holiday', 500)
  }
}

// PUT update holiday
export const PUT = withAuth(
  async (req: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params
      const holidayId = parseInt(id)

      if (isNaN(holidayId)) {
        return createErrorResponse('Invalid holiday ID', 400)
      }

      const body = await req.json()
      const { name, date, end_date, description, is_recurring, start_time, end_time, is_active } = body

      const existing = await prisma.holiday.findUnique({
        where: { holiday_id: holidayId }
      })

      if (!existing) {
        return createErrorResponse('Holiday not found', 404)
      }

      const updateData: any = {}

      if (name !== undefined) updateData.name = name
      if (description !== undefined) updateData.description = description || null
      if (is_recurring !== undefined) updateData.is_recurring = is_recurring
      if (is_active !== undefined) updateData.is_active = is_active
      if (start_time !== undefined) updateData.start_time = start_time || null
      if (end_time !== undefined) updateData.end_time = end_time || null

      if (date !== undefined) {
        const holidayDate = new Date(date)
        if (isNaN(holidayDate.getTime())) {
          return createErrorResponse('Invalid date format', 400)
        }
        updateData.date = holidayDate
      }

      if (end_date !== undefined) {
        if (end_date) {
          const holidayEndDate = new Date(end_date)
          if (isNaN(holidayEndDate.getTime())) {
            return createErrorResponse('Invalid end_date format', 400)
          }
          const startDate = updateData.date || existing.date
          if (holidayEndDate < startDate) {
            return createErrorResponse('End date must be after or equal to start date', 400)
          }
          updateData.end_date = holidayEndDate
        } else {
          updateData.end_date = null
        }
      }

      // Validate time formats
      if (start_time && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(start_time)) {
        return createErrorResponse('Invalid start_time format (use HH:MM)', 400)
      }

      if (end_time && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(end_time)) {
        return createErrorResponse('Invalid end_time format (use HH:MM)', 400)
      }

      const updated = await prisma.holiday.update({
        where: { holiday_id: holidayId },
        data: updateData
      })

      return createSuccessResponse(updated, 'Holiday updated successfully')
    } catch (error) {
      console.error('Error updating holiday:', error)
      return createErrorResponse('Failed to update holiday', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
)

// DELETE holiday
export const DELETE = withAuth(
  async (req: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params
      const holidayId = parseInt(id)

      if (isNaN(holidayId)) {
        return createErrorResponse('Invalid holiday ID', 400)
      }

      const existing = await prisma.holiday.findUnique({
        where: { holiday_id: holidayId }
      })

      if (!existing) {
        return createErrorResponse('Holiday not found', 404)
      }

      // Soft delete by setting is_active to false
      await prisma.holiday.update({
        where: { holiday_id: holidayId },
        data: { is_active: false }
      })

      return createSuccessResponse(null, 'Holiday deleted successfully')
    } catch (error) {
      console.error('Error deleting holiday:', error)
      return createErrorResponse('Failed to delete holiday', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
)
