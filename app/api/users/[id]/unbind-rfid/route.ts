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

    const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
    if (!userAccount || !allowedRoles.includes(userAccount.role as UserRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions to unbind RFID codes' },
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
        { error: 'Cannot unbind RFID for an inactive or archived user' },
        { status: 400 }
      )
    }

    if (!existingUser.rfid_code) {
      return NextResponse.json(
        { error: 'User does not have an RFID code bound' },
        { status: 400 }
      )
    }

    // Remove RFID code from user
    const updatedUser = await prisma.user.update({
      where: { user_id: userId },
      data: { rfid_code: null },
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
      'UNBIND_RFID_USER',
      `Unbound RFID from user ${updatedUser.full_name} (${updatedUser.account_id})`,
      request
    )

    return NextResponse.json({
      success: true,
      message: 'RFID code unbound successfully',
      user: {
        id: updatedUser.user_id,
        fullName: updatedUser.full_name,
        accountId: updatedUser.account_id,
        rfidCode: updatedUser.rfid_code
      }
    })

  } catch (error) {
    console.error('Error unbinding RFID:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
