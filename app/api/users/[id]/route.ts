import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const resolvedParams = await params
    const userId = parseInt(resolvedParams.id)
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      )
    }

    const userAccount = await prisma.userAccount.findUnique({
      where: { id: userId },
      include: {
        user: {
          include: {
            department_ref: true,
            program: true,
          }
        }
      }
    })

    if (!userAccount) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check role-based access
    const currentUserRole = token.role
    if (currentUserRole === 'ADMIN' && userAccount.role !== 'STAFF') {
      return NextResponse.json(
        { error: 'Admin can only view staff accounts' },
        { status: 403 }
      )
    }

    // Normalize response to include derived department/program names
    const normalized = {
      ...userAccount,
      user: userAccount.user ? {
        full_name: userAccount.user.full_name,
        user_type: userAccount.user.user_type,
        email: userAccount.user.email,
        year_level: userAccount.user.year_level || undefined,
        // Map program name to course for UI compatibility
        course: userAccount.user.program?.name || undefined,
        department: userAccount.user.department_ref?.name || undefined,
      } : null
    }

    return NextResponse.json(normalized)

  } catch (error) {
    console.error('Error fetching user details:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req })
    if (!token?.role) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const resolvedParams = await params
    const userId = parseInt(resolvedParams.id)
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const body = await req.json()
    const { is_active, role } = body

    const account = await prisma.userAccount.findUnique({ where: { id: userId } })
    if (!account) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Admin can only update staff accounts and cannot change role
    // Super admin can update any and may change role
    if (token.role === 'ADMIN') {
      if (account.role !== 'STAFF') {
        return NextResponse.json({ error: 'Admin can only update staff accounts' }, { status: 403 })
      }
    }

    const updated = await prisma.userAccount.update({
      where: { id: userId },
      data: {
        is_active: typeof is_active === 'boolean' ? is_active : account.is_active,
        ...(token.role === 'SUPER_ADMIN' && role ? { role } : {}),
      },
      include: { user: true }
    })

    return NextResponse.json({ success: true, data: updated, message: 'User updated successfully' })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
