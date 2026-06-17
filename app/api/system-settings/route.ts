import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/types'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { AuditService } from '@/lib/services/audit.service'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    // Allow ADMIN, SUPER_ADMIN, and STAFF to read settings
    if (!session || !['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(session.user.role)) {
      return createErrorResponse('Unauthorized', 401)
    }

    // Get system settings from database
    const settings = await prisma.systemConfig.findMany()
    
    // Convert array to nested object structure
    const settingsObj = {
      fines: {
        book_fine_per_day: parseFloat(settings.find(s => s.key === 'book_fine_per_day')?.value || '5.00'),
        locker_fine_per_hour: parseFloat(settings.find(s => s.key === 'locker_fine_per_hour')?.value || '20.00'),
        max_book_fine: parseFloat(settings.find(s => s.key === 'max_book_fine')?.value || '100.00'),
        max_locker_fine: parseFloat(settings.find(s => s.key === 'max_locker_fine')?.value || '500.00'),
        grace_period_days: parseInt(settings.find(s => s.key === 'grace_period_days')?.value || '3'),
        grace_period_hours: parseInt(settings.find(s => s.key === 'grace_period_hours')?.value || '2'),
        grace_period_minutes: parseInt(settings.find(s => s.key === 'grace_period_minutes')?.value || '15'),
        max_locker_extensions: parseInt(settings.find(s => s.key === 'max_locker_extensions')?.value || '1')
      }
    }

    return createSuccessResponse(settingsObj)
  } catch (error) {
    console.error('Error fetching system settings:', error)
    return createErrorResponse('Failed to fetch system settings', 500)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.ADMIN)) {
      return createErrorResponse('Unauthorized', 401)
    }

    const data = await req.json()
    
    // Validate input
    if (!data.fines) {
      return createErrorResponse('Invalid settings data', 400)
    }

    const { fines } = data
    
    // Validate numeric values
    if (
      fines.book_fine_per_day < 0 || 
      fines.locker_fine_per_hour < 0 ||
      fines.max_book_fine < 0 ||
      fines.max_locker_fine < 0 ||
      fines.grace_period_days < 0 ||
      fines.grace_period_hours < 0 ||
      (fines.grace_period_minutes !== undefined && fines.grace_period_minutes < 0) ||
      (fines.max_locker_extensions !== undefined && fines.max_locker_extensions < 0)
    ) {
      return createErrorResponse('Fine amounts and grace periods cannot be negative', 400)
    }

    // Update settings in database using upsert
    const settingsToUpdate = [
      { key: 'book_fine_per_day', value: fines.book_fine_per_day.toString(), description: 'Fine amount per day for overdue books' },
      { key: 'locker_fine_per_hour', value: fines.locker_fine_per_hour.toString(), description: 'Fine amount per hour for overdue lockers' },
      { key: 'max_book_fine', value: fines.max_book_fine.toString(), description: 'Maximum fine amount for overdue books' },
      { key: 'max_locker_fine', value: fines.max_locker_fine.toString(), description: 'Maximum fine amount for overdue lockers' },
      { key: 'grace_period_days', value: fines.grace_period_days.toString(), description: 'Grace period in days before book fines apply' },
      { key: 'grace_period_hours', value: fines.grace_period_hours.toString(), description: 'Grace period in hours before locker fines apply' },
      { key: 'grace_period_minutes', value: (fines.grace_period_minutes !== undefined ? fines.grace_period_minutes : 15).toString(), description: 'Additional grace period in minutes before locker fines apply' },
      { key: 'max_locker_extensions', value: (fines.max_locker_extensions !== undefined ? fines.max_locker_extensions : 1).toString(), description: 'Maximum number of allowed extensions per locker transaction' }
    ]

    await Promise.all(
      settingsToUpdate.map(setting =>
        prisma.systemConfig.upsert({
          where: { key: setting.key },
          update: { 
            value: setting.value,
            updated_at: new Date()
          },
          create: {
            key: setting.key,
            value: setting.value,
            description: setting.description,
            data_type: 'NUMBER'
          }
        })
      )
    )

    // Log the settings update
    await AuditService.logAction(
      parseInt(session.user.id),
      session.user.role as UserRole,
      'SYSTEM_SETTINGS_UPDATE',
      `Updated system settings: fine structure modified`,
      'System Settings'
    )

    return createSuccessResponse(null, 'System settings updated successfully')
  } catch (error) {
    console.error('Error updating system settings:', error)
    return createErrorResponse('Failed to update system settings', 500)
  }
}
