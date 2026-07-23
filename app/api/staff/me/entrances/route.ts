import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

// GET /api/staff/me/entrances
// List the entrances the current staff member is allowed to
// operate from. Always scoped to the staff's campus so a
// COLLEGE-designated staff never sees BASIC_EDUCATION
// entrances and vice versa. Archived entrances are filtered
// out (they shouldn't show up as an "active" choice on the
// entry management page).
export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.role) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    // Allow STAFF and ADMIN/SUPER_ADMIN so admins can also
    // use the entry-management UI (the StaffView's entrance
    // dropdown) without re-scoping themselves.
    if (token.role !== 'STAFF' && token.role !== 'ADMIN' && token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const accountId = parseInt((token.sub as string) || '0')
    if (!accountId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }
    const account = await prisma.userAccount.findUnique({
      where: { id: accountId },
      select: { role: true, campus: true }
    })
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const noStoreHeaders = {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    }

    // ADMIN / SUPER_ADMIN have no campus designation, so we
    // return every active entrance. They can pick any.
    if (!account.campus) {
      const entrances = await prisma.entrance.findMany({
        where: { archived_at: null, is_active: true },
        orderBy: [{ campus: 'asc' }, { name: 'asc' }]
      })
      return NextResponse.json({
        success: true,
        campus: null,
        role: account.role,
        data: entrances
      }, { headers: noStoreHeaders })
    }

    const entrances = await prisma.entrance.findMany({
      where: { archived_at: null, is_active: true, campus: account.campus },
      orderBy: [{ name: 'asc' }]
    })

    return NextResponse.json({
      success: true,
      campus: account.campus,
      role: account.role,
      data: entrances
    }, { headers: noStoreHeaders })
  } catch (error) {
    console.error('Error fetching staff entrances:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
