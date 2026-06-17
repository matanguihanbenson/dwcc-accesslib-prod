import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req })
    if (!token?.role) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    if (token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const resolvedParams = await params
    const accountId = parseInt(resolvedParams.id)
    if (isNaN(accountId)) return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })

    const account = await prisma.userAccount.findUnique({
      where: { id: accountId },
      include: { user: true }
    })

    if (!account) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    return NextResponse.json(account)
  } catch (error) {
    console.error('Error fetching admin account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req })
    if (!token?.role) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    if (token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const resolvedParams = await params
    const accountId = parseInt(resolvedParams.id)
    if (isNaN(accountId)) return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })

    const body = await req.json()
    const { is_active, role } = body

    const account = await prisma.userAccount.findUnique({ where: { id: accountId } })
    if (!account) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Check if trying to activate a deactivated ADMIN account
    if (is_active === true && account.is_active === false && account.role === 'ADMIN') {
      // Count currently active ADMIN accounts
      const activeAdminCount = await prisma.userAccount.count({
        where: {
          role: 'ADMIN',
          is_active: true
        }
      })

      if (activeAdminCount >= 1) {
        return NextResponse.json({ 
          error: 'Maximum number of active Library Admin accounts (1) has been reached. Please deactivate an existing admin before activating this one.',
          code: 'ADMIN_LIMIT_REACHED'
        }, { status: 400 })
      }
    }

    const updated = await prisma.userAccount.update({
      where: { id: accountId },
      data: {
        is_active: typeof is_active === 'boolean' ? is_active : account.is_active,
        role: role || account.role,
      },
      include: { user: true }
    })

    return NextResponse.json({ success: true, data: updated, message: 'Admin updated successfully' })
  } catch (error) {
    console.error('Error updating admin account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


