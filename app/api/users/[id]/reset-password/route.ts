import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { auditLogger } from '@/lib/audit-logger'
import { UserRole } from '@/types'
import bcrypt from 'bcryptjs'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils'

export async function POST(
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

    const { newPassword } = await req.json()

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 4) {
      return createErrorResponse('New password must be at least 4 characters long', 400, 'VALIDATION_ERROR')
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
      return createErrorResponse('Admin can only reset staff account passwords', 403, 'FORBIDDEN')
    }

    // Hash the new password with a good salt rounds
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    console.log(`Resetting password for user account ID: ${userId}, username: ${userAccount.username}`)
    console.log(`Old password hash: ${userAccount.password_hash.substring(0, 20)}...`)
    console.log(`New password hash: ${hashedPassword.substring(0, 20)}...`)
    console.log(`New password length: ${newPassword.length}`)

    // Update the password with explicit transaction to ensure consistency
    const updatedAccount = await prisma.$transaction(async (tx) => {
      const updated = await tx.userAccount.update({
        where: { id: userId },
        data: { 
          password_hash: hashedPassword,
          updated_at: new Date()
        },
        include: {
          user: true
        }
      })

      // Verify the update was successful by reading the hash again
      const verified = await tx.userAccount.findUnique({
        where: { id: userId },
        select: { 
          id: true, 
          username: true, 
          password_hash: true,
          updated_at: true
        }
      })

      if (!verified || verified.password_hash !== hashedPassword) {
        throw new Error('Password update verification failed')
      }

      console.log(`Password hash verified after update: ${verified.password_hash.substring(0, 20)}...`)
      console.log(`Updated at: ${verified.updated_at}`)

      return updated
    })

    console.log(`Password updated successfully for user: ${updatedAccount.username}`)

    // Test the new password immediately to ensure it works
    const testResult = await bcrypt.compare(newPassword, updatedAccount.password_hash)
    console.log(`Password verification test result: ${testResult}`)

    if (!testResult) {
      console.error('WARNING: Password reset succeeded but verification failed!')
      return createErrorResponse('Password reset failed verification', 500, 'INTERNAL_ERROR')
    }

    // Force a database flush to ensure the change is persisted
    await prisma.$executeRaw`SELECT 1`

    // Log the password reset
    await auditLogger.logPasswordReset(
      parseInt(token.sub || '0'),
      token.role as UserRole,
      `${userAccount.user?.full_name || userAccount.username} (${userAccount.user?.account_id || userAccount.username})`,
      req
    )

    return createSuccessResponse({
      account: {
        id: updatedAccount.id,
        username: updatedAccount.username,
        role: updatedAccount.role,
        is_active: updatedAccount.is_active
      }
    }, 'Password reset successfully')

  } catch (error) {
  console.error('Error resetting password:', error)
  return createErrorResponse('Internal server error', 500, 'INTERNAL_ERROR')
  }
}
