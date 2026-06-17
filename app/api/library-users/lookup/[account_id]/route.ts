import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ account_id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow staff and above to lookup users
    if (!['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const resolvedParams = await params
    const accountId = resolvedParams.account_id

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: {
        account_id: accountId
      },
      include: {
        department_ref: true,
        program: true,
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: user
    })

  } catch (error) {
    console.error('Error looking up user by account ID:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

