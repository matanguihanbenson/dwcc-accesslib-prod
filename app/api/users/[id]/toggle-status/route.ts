import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { auditLogger } from '@/lib/audit-logger'
import { UserRole } from '@/types'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req })
    
    if (!token?.role) {
      return createErrorResponse('Authentication required', 401, 'UNAUTHORIZED')
    }

    if (token.role !== 'SUPER_ADMIN' && token.role !== 'ADMIN') {
      return createErrorResponse('Insufficient permissions', 403, 'FORBIDDEN')
    }

    const resolvedParams = await params
    const userId = parseInt(resolvedParams.id)
    if (isNaN(userId)) {
      return createErrorResponse('Invalid user ID', 400, 'VALIDATION_ERROR')
    }

    const userAccount = await prisma.userAccount.findUnique({
      where: { id: userId },
      include: {
        user: true
      }
    })

    if (!userAccount) {
      return createErrorResponse('User account not found', 404, 'NOT_FOUND')
    }

    if (token.role === 'ADMIN' && userAccount.role !== 'STAFF') {
      return createErrorResponse('Admin can only toggle staff account status', 403, 'FORBIDDEN')
    }

    const newStatus = userAccount.is_active ? false : true

    // Check if trying to activate a deactivated ADMIN account
    if (newStatus === true && userAccount.role === 'ADMIN') {
      // Count currently active ADMIN accounts
      const activeAdminCount = await prisma.userAccount.count({
        where: {
          role: 'ADMIN',
          is_active: true
        }
      })

      if (activeAdminCount >= 1) {
        return createErrorResponse(
          'Maximum number of active Library Admin accounts (1) has been reached. Please deactivate an existing admin before activating this one.',
          400,
          'ADMIN_LIMIT_REACHED'
        )
      }
    }

    const updatedAccount = await prisma.userAccount.update({
      where: { id: userId },
      data: { is_active: newStatus },
      include: {
        user: true
      }
    })

    // Log the status change
    await auditLogger.logUserStatusChange(
      parseInt(token.sub || '0'),
      token.role as UserRole,
      `${userAccount.user?.full_name || userAccount.username} (${userAccount.user?.account_id || userAccount.username})`,
      newStatus ? 'ACTIVE' : 'INACTIVE',
      req
    )

    return createSuccessResponse({
      account: updatedAccount
    }, `User account ${newStatus ? 'activated' : 'deactivated'} successfully`)

  } catch (error) {
  console.error('Error toggling user status:', error)
  return createErrorResponse('Internal server error', 500, 'INTERNAL_ERROR')
  }
}
