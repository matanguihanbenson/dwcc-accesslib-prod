import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    let currentUserId = null
    let currentUserRole = null

    // Try NextAuth token first
    const token = await getToken({ req })
    if (token?.username) {
      // Get user by username from NextAuth
      const userAccount = await prisma.userAccount.findUnique({
        where: { 
          username: token.username as string
        },
        select: {
          id: true,
          is_active: true,
          role: true,
          user_id: true
        }
      })

      if (userAccount) {
        currentUserId = userAccount.id
        currentUserRole = userAccount.role
        
        // Return user status
        return NextResponse.json({
          is_active: userAccount.is_active,
          user_id: currentUserId,
          role: currentUserRole
        })
      }
    }

    // No valid authentication found
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    )

  } catch (error) {
    console.error('Error checking user status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
