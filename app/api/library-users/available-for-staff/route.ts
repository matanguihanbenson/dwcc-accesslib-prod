import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })
    
    if (!token?.role) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (token.role !== 'SUPER_ADMIN' && token.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get users who currently have non-USER roles (ADMIN/STAFF/SUPER_ADMIN)
    // Users with role USER or with no account should be available for promotion
    const existingPrivileged = await prisma.userAccount.findMany({
      where: { role: { in: ['ADMIN', 'STAFF', 'SUPER_ADMIN'] } },
      select: { user_id: true }
    })
    const existingUserIds = existingPrivileged.map(ua => ua.user_id)
    
    // Then get all users who are NOT in the existing staff accounts
    // Handle case where no existing users (empty notIn would cause error)
    const whereClause = existingUserIds.length > 0 
      ? { user_id: { notIn: existingUserIds } }
      : {} // If no privileged accounts, show all users
    
    const libraryUsers = await prisma.user.findMany({
      where: whereClause,
      select: {
        user_id: true,
        account_id: true,
        full_name: true,
        user_type: true,
        email: true,
        year_level: true,
        department_id: true,
        program_id: true,
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
      },
      orderBy: {
        full_name: 'asc'
      }
    })

    return NextResponse.json(libraryUsers)

  } catch (error) {
    console.error('Error fetching library users for staff promotion:', error)
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
