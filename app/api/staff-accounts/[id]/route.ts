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

    // ADMIN and SUPER_ADMIN can view staff accounts; ADMIN limited to STAFF
    const resolvedParams = await params
    const accountId = parseInt(resolvedParams.id)
    if (isNaN(accountId)) return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })

    const account = await prisma.userAccount.findUnique({
      where: { id: accountId },
      include: { user: true }
    })

    if (!account) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (token.role === 'ADMIN' && account.role !== 'STAFF') {
      return NextResponse.json({ error: 'Admin can only view staff accounts' }, { status: 403 })
    }

    return NextResponse.json(account)
  } catch (error) {
    console.error('Error fetching staff account:', error)
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

    const resolvedParams = await params
    const accountId = parseInt(resolvedParams.id)
    if (isNaN(accountId)) return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })

    const body = await req.json()
    const { is_active } = body

    const account = await prisma.userAccount.findUnique({ where: { id: accountId } })
    if (!account) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (token.role === 'ADMIN' && account.role !== 'STAFF') {
      return NextResponse.json({ error: 'Admin can only update staff accounts' }, { status: 403 })
    }

    const updated = await prisma.userAccount.update({
      where: { id: accountId },
      data: { is_active: typeof is_active === 'boolean' ? is_active : account.is_active },
      include: { user: true }
    })

    return NextResponse.json({ success: true, data: updated, message: 'Account updated successfully' })
  } catch (error) {
    console.error('Error updating staff account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


