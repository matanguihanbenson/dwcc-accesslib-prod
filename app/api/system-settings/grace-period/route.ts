import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/types'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    // Allow STAFF and ADMIN to access grace period for borrowing purposes
    if (!session || !['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return createErrorResponse('Unauthorized', 401)
    }

    // Get grace period setting from database
    const gracePeriodSetting = await prisma.systemConfig.findUnique({
      where: { key: 'grace_period_days' }
    })
    
    // Default to 3 days if not configured
    const gracePeriodDays = gracePeriodSetting 
      ? parseInt(gracePeriodSetting.value) || 3
      : 3

    return createSuccessResponse({
      grace_period_days: gracePeriodDays
    })
  } catch (error) {
    console.error('Error fetching grace period:', error)
    return createErrorResponse('Failed to fetch grace period', 500)
  }
}
