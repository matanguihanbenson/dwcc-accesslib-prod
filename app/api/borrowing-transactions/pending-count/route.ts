import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/types'

/**
 * GET /api/borrowing-transactions/pending-count
 *
 * Returns the number of `PENDING_APPROVAL` book-borrow
 * transactions. Used by the Sidebar "Books" badge and the
 * Pending Approval tab so the Library Admin sees a live
 * count without having to load the full transaction list.
 *
 * Accessible to ADMIN and STAFF. The Books sidebar item is
 * shown to all three roles, but only ADMIN and STAFF have
 * access to the underlying transactions endpoint, so we
 * mirror that permission here.
 */
export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })

    if (!token?.role) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (token.role !== UserRole.ADMIN && token.role !== UserRole.STAFF) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const count = await prisma.bookTransaction.count({
      where: { status: 'PENDING_APPROVAL' }
    })

    return NextResponse.json({ count })
  } catch (error) {
    console.error('Error counting pending borrow transactions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
