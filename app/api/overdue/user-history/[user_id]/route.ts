import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import jwt from 'jsonwebtoken'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/overdue/user-history/[user_id]
 *
 * Per-user settlement history. Mirrors the shape of
 * /api/overdue/payment-history but is scoped to a single
 * borrower so the Quick-View Fines modal can paginate
 * server-side without dragging the full settlement table
 * over the wire.
 *
 * Query params:
 *   - `page`  : 1-indexed page number (default 1)
 *   - `limit` : rows per page (default 10, max 100)
 *
 * Rows are ordered by `created_at DESC` so the most
 * recent transaction is at the top.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ user_id: string }> }
) {
  try {
    // ---------- Auth ----------
    // Re-use the same dual-path (NextAuth session OR JWT
    // cookie) used by /api/overdue/payment-history so the
    // modal works regardless of how the page is signed in.
    const session = await getServerSession(authOptions)
    let authed = !!session?.user
    if (!authed) {
      const token = request.cookies.get('token')?.value
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
          if (decoded?.userId) authed = true
        } catch {
          // fall through to 401
        }
      }
    }
    if (!authed) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // ---------- Path / query ----------
    const resolvedParams = await params
    const userIdNum = Number(resolvedParams.user_id)
    if (!Number.isFinite(userIdNum) || userIdNum <= 0) {
      return NextResponse.json({ error: 'Invalid user_id' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const pageRaw = Number(searchParams.get('page') || '1')
    const limitRaw = Number(searchParams.get('limit') || '10')
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1
    const limit = Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.floor(limitRaw), 100)
      : 10
    const skip = (page - 1) * limit

    // ---------- Query ----------
    // One DB round-trip for the count and one for the
    // page; ordered by created_at DESC so the most
    // recent row is at the top.
    const where = { user_id: userIdNum }

    const [total, settlements] = await Promise.all([
      prisma.overdueSettlement.count({ where }),
      prisma.overdueSettlement.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          processedByUser: {
            select: {
              user_id: true,
              full_name: true,
              account_id: true
            }
          }
        }
      })
    ])

    // Enrich each row with the underlying transaction
    // (book title / locker number + due dates) so the
    // History tab can render without a second round-trip.
    const enriched = await Promise.all(
      settlements.map(async (s) => {
        let transactionDetails: any = null

        if (s.transaction_type === 'BOOK') {
          const bt = await prisma.bookTransaction.findUnique({
            where: { transaction_id: s.transaction_id },
            include: {
              book: {
                select: {
                  title: true,
                  authors: {
                    select: { name: true },
                    orderBy: { display_order: 'asc' },
                    take: 1
                  }
                }
              },
              copy: {
                select: { accession_number: true }
              }
            }
          })
          if (bt) {
            transactionDetails = {
              type: 'BOOK',
              book_title: bt.book?.title,
              book_author:
                bt.book?.authors && bt.book.authors.length > 0
                  ? bt.book.authors[0].name
                  : undefined,
              accession_number: bt.copy?.accession_number,
              borrow_date: bt.borrow_date,
              due_date: bt.due_date,
              return_date: bt.return_date
            }
          }
        } else {
          const lt = await prisma.lockerTransaction.findUnique({
            where: { transaction_id: s.transaction_id },
            include: {
              locker: {
                select: { locker_number: true, location: true }
              }
            }
          })
          if (lt) {
            transactionDetails = {
              type: 'LOCKER',
              locker_number: lt.locker?.locker_number,
              locker_location: lt.locker?.location,
              borrow_time: lt.borrow_time,
              return_time: lt.return_time
            }
          }
        }

        return {
          settlement_id: s.settlement_id,
          transaction_type: s.transaction_type,
          transaction_id: s.transaction_id,
          penalty_amount: Number(s.penalty_amount),
          amount_paid: Number(s.amount_paid),
          remaining_balance: Number(s.remaining_balance),
          status: s.status,
          created_at: s.created_at,
          settled_at: s.settled_at,
          updated_at: s.updated_at,
          notes: s.notes,
          transaction_details: transactionDetails,
          voided: typeof s.notes === 'string' && s.notes.startsWith('VOIDED'),
          processed_by: s.processedByUser
            ? {
                user_id: s.processedByUser.user_id,
                full_name: s.processedByUser.full_name,
                account_id: s.processedByUser.account_id
              }
            : null
        }
      })
    )

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      data: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    })
  } catch (error) {
    console.error('Error fetching user settlement history:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
