import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-utils'
import { UserRole } from '@/types'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const accountId = searchParams.get('account_id')
    
    if (!accountId) {
      return NextResponse.json(
        { error: 'account_id parameter is required' },
        { status: 400 }
      )
    }
    
    try {
      const existingUser = await prisma.user.findUnique({
        where: { account_id: accountId },
        select: { user_id: true, account_id: true }
      })
      
      return NextResponse.json({
        exists: !!existingUser,
        available: !existingUser
      })
    } catch (error) {
      console.error('Error checking account_id:', error)
      return NextResponse.json(
        { error: 'Failed to check account ID' },
        { status: 500 }
      )
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
)