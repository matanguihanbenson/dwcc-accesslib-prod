import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
    if (!allowedRoles.includes(session.user.role as UserRole)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limitParam = parseInt(searchParams.get('limit') || '10')
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 10

    const transactions = await prisma.lockerTransaction.findMany({
      include: {
        locker: {
          select: {
            locker_id: true,
            locker_number: true,
            location: true,
            status: true
          }
        },
        user: {
          select: {
            user_id: true,
            full_name: true,
            account_id: true,
            user_type: true
          }
        }
      },
      orderBy: {
        borrow_time: 'desc'
      },
      take: limit
    })

    return NextResponse.json({
      success: true,
      transactions
    })
  } catch (error) {
    console.error('Error fetching recent locker transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recent locker transactions' },
      { status: 500 }
    )
  }
}
