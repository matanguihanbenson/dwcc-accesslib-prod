import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { AuditService } from '@/lib/services/audit.service'
import { UserRole } from '@/types'
import logger from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    logger.apiRequest('POST', '/api/users/change-password')
    
    // Get session for authentication
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      logger.warn('No authentication found for password change')
      return createErrorResponse('No authentication found', 401)
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body

    logger.info('Change password request body:', { 
      hasCurrentPassword: !!currentPassword,
      currentPasswordType: typeof currentPassword,
      hasNewPassword: !!newPassword,
      newPasswordType: typeof newPassword,
      bodyKeys: Object.keys(body)
    })

    // Validate inputs
    if (!currentPassword || typeof currentPassword !== 'string') {
      logger.warn('Invalid current password:', { currentPassword: typeof currentPassword })
      return createErrorResponse('Current password is required', 400)
    }

    if (!newPassword || typeof newPassword !== 'string') {
      logger.warn('Invalid new password:', { newPassword: typeof newPassword })
      return createErrorResponse('New password is required', 400)
    }

    if (newPassword.length < 6) {
      logger.warn('New password too short:', { length: newPassword.length })
      return createErrorResponse('New password must be at least 6 characters long', 400)
    }

    // Get current user account
    const userAccount = await prisma.userAccount.findUnique({
      where: {
        id: parseInt(session.user.id),
        is_active: true
      },
      include: {
        user: {
          select: {
            full_name: true,
            account_id: true
          }
        }
      }
    })

    if (!userAccount) {
      logger.warn('User account not found for password change', { accountId: session.user.id })
      return createErrorResponse('User account not found', 404)
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userAccount.password_hash)
    
    if (!isCurrentPasswordValid) {
      logger.warn('Invalid current password for password change', { username: userAccount.username })
      return createErrorResponse('Current password is incorrect', 400)
    }

    // Check if new password is different from current
    const isSamePassword = await bcrypt.compare(newPassword, userAccount.password_hash)
    
    if (isSamePassword) {
      return createErrorResponse('New password must be different from current password', 400)
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12)

    // Update password
    await prisma.userAccount.update({
      where: { id: userAccount.id },
      data: { 
        password_hash: hashedNewPassword,
        updated_at: new Date()
      }
    })

    // Log the password change
    await AuditService.logProfile(
      userAccount.id,
      userAccount.role as UserRole,
      'PASSWORD_CHANGE',
      `User ${userAccount.username} changed their password`,
      request?.headers?.get('x-forwarded-for') || 'unknown',
      request?.headers?.get('user-agent') || 'unknown'
    )

    logger.info('Password changed successfully', { 
      username: userAccount.username,
      userId: userAccount.id.toString()
    })

    return createSuccessResponse({
      message: 'Password changed successfully'
    })

  } catch (error) {
    logger.error('Password change error', error instanceof Error ? error : new Error(String(error)))
    return createErrorResponse('Internal server error', 500)
  }
}
