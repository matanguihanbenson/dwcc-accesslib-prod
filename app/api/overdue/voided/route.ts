import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import jwt from 'jsonwebtoken'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/types'

/**
 * GET /api/overdue/voided
 *
 * Lists every overdue penalty that has been voided. A row is
 * considered "voided" when its `notes` starts with the literal
 * `VOIDED` prefix written by /api/overdue/void. The page uses this
 * to populate the "View Voided" modal.
 *
 * Optional query params:
 *   - `user_id`  : filter to a single borrower
 *   - `limit`    : cap on the number of rows returned (default 100)
 *   - `from`     : ISO date; only voided rows whose `updated_at` is on/after this
 *   - `to`       : ISO date; only voided rows whose `updated_at` is on/before this
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // ---------- Auth ----------
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

    // ---------- Filters ----------
    const userIdRaw = searchParams.get('user_id')
    const userIdNum = userIdRaw ? Number(userIdRaw) : null
    if (userIdRaw && (!Number.isFinite(userIdNum) || (userIdNum as number) <= 0)) {
      return NextResponse.json({ error: 'Invalid user_id' }, { status: 400 })
    }

    const limitRaw = searchParams.get('limit')
    const limitNum = limitRaw ? Number(limitRaw) : 100
    const limit =
      Number.isFinite(limitNum) && limitNum > 0 ? Math.min(limitNum, 500) : 100

    const from = searchParams.get('from')
    const to = searchParams.get('to')
    if (from && Number.isNaN(new Date(from).getTime())) {
      return NextResponse.json({ error: 'Invalid `from` date' }, { status: 400 })
    }
    if (to && Number.isNaN(new Date(to).getTime())) {
      return NextResponse.json({ error: 'Invalid `to` date' }, { status: 400 })
    }

    const updatedAtFilter: { gte?: Date; lte?: Date } = {}
    if (from) updatedAtFilter.gte = new Date(from)
    if (to) {
      const end = new Date(to)
      end.setHours(23, 59, 59, 999)
      updatedAtFilter.lte = end
    }

    // ---------- Query ----------
    // Voided rows are written by /api/overdue/void with notes
    // starting with "VOIDED" (and optionally "VOIDED: <reason>").
    // The prefix match is the source of truth -- status is
    // always SETTLED after a void regardless of how the row got
    // there, so we don't filter on status.
    const rows = await prisma.overdueSettlement.findMany({
      where: {
        notes: { startsWith: 'VOIDED' },
        ...(userIdNum ? { user_id: userIdNum } : {}),
        ...(Object.keys(updatedAtFilter).length ? { updated_at: updatedAtFilter } : {})
      },
      orderBy: { updated_at: 'desc' },
      take: limit,
      include: {
        // Prisma relation: `BorrowerSettlements` is the relation
        // alias for the FK on user_id (defined in prisma/schema.prisma).
        user: {
          select: {
            user_id: true,
            full_name: true,
            account_id: true,
            user_type: true,
            email: true
          }
        },
        // The "processed_by" FK is mapped via ProcessedSettlements.
        processedByUser: {
          select: {
            user_id: true,
            full_name: true,
            account_id: true
          }
        }
      }
    })

    // Shape the response so the page can render a clean table.
    const voided = rows.map((r) => ({
      settlement_id: r.settlement_id,
      transaction_type: r.transaction_type,
      transaction_id: r.transaction_id,
      penalty_amount: Number(r.penalty_amount),
      amount_paid: Number(r.amount_paid),
      remaining_balance: Number(r.remaining_balance),
      status: r.status,
      // Strip the leading "VOIDED" / "VOIDED: " prefix so the
      // page can show just the reason text in its own column.
      reason: (r.notes || '').replace(/^VOIDED:\s*/, '').trim() || '(no reason given)',
      voided_at: r.settled_at || r.updated_at,
      voided_by: r.processedByUser
        ? {
            user_id: r.processedByUser.user_id,
            full_name: r.processedByUser.full_name,
            account_id: r.processedByUser.account_id
          }
        : null,
      borrower: r.user
        ? {
            user_id: r.user.user_id,
            full_name: r.user.full_name,
            account_id: r.user.account_id,
            user_type: r.user.user_type,
            email: r.user.email
          }
        : null
    }))

    return NextResponse.json({
      success: true,
      count: voided.length,
      voided
    })
  } catch (error) {
    console.error('Error listing voided overdue penalties:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
