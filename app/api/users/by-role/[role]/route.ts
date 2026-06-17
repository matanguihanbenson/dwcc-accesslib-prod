import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ role: string }> }
) {
  try {
    const resolvedParams = await params
    const { role } = resolvedParams

    // Validate role parameter
    const validRoles = ['admin', 'staff', 'super_admin']
    if (!validRoles.includes(role.toLowerCase())) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    let currentUserRole: string | null = null
    let isAuthenticated = false

    // Try NextAuth session first
    const session = await getServerSession(authOptions)
    
    if (session?.user?.username) {
      try {
        const userAccount = await prisma.userAccount.findUnique({
          where: {
            username: session.user.username,
            is_active: true
          }
        })
        
        if (userAccount) {
          currentUserRole = userAccount.role
          isAuthenticated = true
        }
      } catch (dbError) {
        console.error('Database error during session lookup:', dbError)
      }
    }

    // If no session, try JWT token from cookies
    if (!isAuthenticated) {
      const token = request.cookies.get('token')?.value
      
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
          const userId = decoded.userId

          const userAccount = await prisma.userAccount.findUnique({
            where: { id: userId, is_active: true }
          })

          if (userAccount) {
            currentUserRole = userAccount.role
            isAuthenticated = true
          }
        } catch (jwtError) {
          console.warn('JWT verification failed:', jwtError)
        }
      }
    }

    if (!isAuthenticated || !currentUserRole) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Check permissions - Fixed to allow proper access
    const rolePermissions = {
      admin: ['SUPER_ADMIN'], // Only SUPER_ADMIN can view admin accounts
      staff: ['SUPER_ADMIN', 'ADMIN'], // Both SUPER_ADMIN and ADMIN can view staff accounts  
      super_admin: ['SUPER_ADMIN'] // Only SUPER_ADMIN can view super_admin accounts
    }

    const allowedRoles = rolePermissions[role.toLowerCase() as keyof typeof rolePermissions]
    if (!allowedRoles || !allowedRoles.includes(currentUserRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Map request role to database role
    const dbRoleMap = {
      admin: 'ADMIN',
      staff: 'STAFF',
      super_admin: 'SUPER_ADMIN'
    }

    const targetRole = dbRoleMap[role.toLowerCase() as keyof typeof dbRoleMap]

    // Fetch users with the specified role (both active and inactive)
    const userAccounts = await prisma.userAccount.findMany({
      where: {
        role: targetRole as any
      },
      include: {
        user: {
          select: {
            account_id: true,
            full_name: true,
            user_type: true,
            email: true,
            year_level: true,
            department_ref: {
              select: {
                name: true,
                code: true
              }
            },
            program: {
              select: {
                name: true,
                code: true
              }
            }
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    // Transform the data to match frontend expectations
    const users = userAccounts.map(account => ({
      id: account.id,
      username: account.username,
      account_id: account.user?.account_id || 'N/A',
      role: account.role,
      is_active: account.is_active,  // Return boolean as expected by frontend
      user: account.user
    }))

    // Add cache control headers to prevent stale data
    const response = NextResponse.json(users)
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    response.headers.set('Surrogate-Control', 'no-store')

    return response
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
