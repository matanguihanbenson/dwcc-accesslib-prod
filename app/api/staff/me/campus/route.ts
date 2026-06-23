import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

// GET /api/staff/me/campus
// Returns the current staff's campus designation. Used by the entry
// monitoring staff view to show the user which campus they're scoped
// to and by the realtime SSE handler to filter live events.
export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.role) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const accountId = parseInt((token.sub as string) || '0')
    if (isNaN(accountId) || accountId <= 0) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const account = await prisma.userAccount.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        role: true,
        campus: true,
        user: {
          select: { full_name: true, account_id: true }
        }
      }
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Non-staff roles have no campus. Return null so the UI can render
    // an "all campuses" picker for admin / super admin.
    return NextResponse.json({
      role: account.role,
      campus: account.campus,
      user: account.user
    })
  } catch (error) {
    console.error('Error fetching current staff campus:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
