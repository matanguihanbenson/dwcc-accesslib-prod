import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/types'
import { auditLogger } from '@/lib/audit-logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.username) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has permission (SUPER_ADMIN, ADMIN, or STAFF)
    const userAccount = await prisma.userAccount.findFirst({
      where: {
        username: session.user.username,
        is_active: true
      }
    })

    if (!userAccount || !([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] as string[]).includes(userAccount.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions to bind RFID codes' },
        { status: 403 }
      )
    }

    const { id } = await params
    const userId = parseInt(id)
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { rfidCode } = body

    if (!rfidCode || typeof rfidCode !== 'string') {
      return NextResponse.json(
        { error: 'RFID code is required' },
        { status: 400 }
      )
    }

    const trimmedRfidCode = rfidCode.trim()

    if (trimmedRfidCode.length === 0) {
      return NextResponse.json(
        { error: 'RFID code cannot be empty' },
        { status: 400 }
      )
    }

    if (trimmedRfidCode.length > 50) {
      return NextResponse.json(
        { error: 'RFID code must be 50 characters or less' },
        { status: 400 }
      )
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        full_name: true,
        rfid_code: true,
        status: true
      }
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (existingUser.status && existingUser.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Cannot bind RFID to an inactive or archived user' },
        { status: 400 }
      )
    }

    // Check if RFID code is already in use by another user
    const duplicateUser = await prisma.user.findUnique({
      where: { rfid_code: trimmedRfidCode },
      select: {
        user_id: true,
        full_name: true,
        account_id: true
      }
    })

    if (duplicateUser && duplicateUser.user_id !== userId) {
      return NextResponse.json(
        {
          error: 'RFID already bound',
          message: `This RFID code is already assigned to ${duplicateUser.full_name} (${duplicateUser.account_id})`,
          existingUser: {
            id: duplicateUser.user_id,
            fullName: duplicateUser.full_name,
            accountId: duplicateUser.account_id
          }
        },
        { status: 409 }
      )
    }

    const duplicateLocker = await prisma.locker.findFirst({
      where: { rfid_code: trimmedRfidCode, archived_at: null },
      select: { locker_id: true, locker_number: true }
    })

    if (duplicateLocker) {
      return NextResponse.json(
        {
          error: 'RFID already bound',
          message: `This RFID code is already assigned to locker ${duplicateLocker.locker_number}`,
          existingLocker: {
            id: duplicateLocker.locker_id,
            lockerNumber: duplicateLocker.locker_number
          }
        },
        { status: 409 }
      )
    }

    // Update user's RFID code
    const updatedUser = await prisma.user.update({
      where: { user_id: userId },
      data: { rfid_code: trimmedRfidCode },
      select: {
        user_id: true,
        full_name: true,
        account_id: true,
        rfid_code: true
      }
    })

    // Log the action
    await auditLogger.logAction(
      userAccount.id,
      userAccount.role as UserRole,
      'BIND_RFID_USER',
      `Bound RFID ${trimmedRfidCode} to user ${updatedUser.full_name} (${updatedUser.account_id})`,
      request
    )

    return NextResponse.json({
      success: true,
      message: 'RFID code bound successfully',
      user: {
        id: updatedUser.user_id,
        fullName: updatedUser.full_name,
        accountId: updatedUser.account_id,
        rfidCode: updatedUser.rfid_code
      }
    })

  } catch (error) {
    console.error('Error binding RFID:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
