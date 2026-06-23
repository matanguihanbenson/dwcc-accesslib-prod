import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/types'

/**
 * GET /api/reports/fines-summary
 *
 * Returns a per-borrower breakdown of overdue fines. Used by
 * the "Summary of Fines" report in the Reports page.
 *
 * Query params:
 *   - `type`       : 'combined' (default) | 'book' | 'locker'
 *   - `date_from`  : ISO date, only settlements updated on/after
 *   - `date_to`    : ISO date, only settlements updated on/before
 *   - `department_id` : optional, restrict to one department
 *   - `user_type`  : optional, restrict to one user_type
 *
 * Each row is one borrower (User) with:
 *   - book fine total (₱), paid (₱), remaining (₱), count
 *   - locker fine total (₱), paid (₱), remaining (₱), count
 *   - combined totals (when `type=combined`)
 *   - a `settlements` list of the underlying rows so the
 *     PDF / Excel reports can show transaction-level detail.
 *
 * Restricted to ADMIN and SUPER_ADMIN.
 */

const TX_TYPE = {
  COMBINED: 'combined',
  BOOK: 'book',
  LOCKER: 'locker'
} as const

type Type = (typeof TX_TYPE)[keyof typeof TX_TYPE]

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })

    if (!token?.role) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    if (token.role !== UserRole.ADMIN && token.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const url = new URL(req.url)
    const typeParam = (url.searchParams.get('type') || 'combined').toLowerCase()
    const type: Type =
      typeParam === 'book' || typeParam === 'locker' || typeParam === 'combined'
        ? (typeParam as Type)
        : TX_TYPE.COMBINED

    const dateFrom = url.searchParams.get('date_from')
    const dateTo = url.searchParams.get('date_to')
    const departmentId = url.searchParams.get('department_id')
    const userType = url.searchParams.get('user_type')

    // Date range filter applies to `updated_at` (the timestamp
    // that changes on every payment / status update), so we
    // catch any fines that were paid off within the window.
    const updatedAtFilter: { gte?: Date; lte?: Date } = {}
    if (dateFrom) updatedAtFilter.gte = new Date(dateFrom)
    if (dateTo) {
      const end = new Date(dateTo)
      end.setHours(23, 59, 59, 999)
      updatedAtFilter.lte = end
    }

    // Build the type filter from the `type` param. Note we
    // include the voided settlements too because they were
    // once part of the payable balance; the report user can
    // ignore them downstream if not relevant.
    const where: any = {
      notes: { not: { startsWith: 'VOIDED' } }
    }
    if (type === 'book') where.transaction_type = 'BOOK'
    if (type === 'locker') where.transaction_type = 'LOCKER'
    if (Object.keys(updatedAtFilter).length > 0) {
      where.updated_at = updatedAtFilter
    }

    // User filter (department / user_type) is applied at the
    // group stage via the include, not the where, so we can
    // group on User.user_id. We do that below.
    const settlements = await prisma.overdueSettlement.findMany({
      where,
      include: {
        user: {
          select: {
            user_id: true,
            account_id: true,
            full_name: true,
            user_type: true,
            status: true,
            email: true,
            department_id: true,
            department_ref: { select: { department_id: true, name: true, code: true } },
            program: { select: { name: true } },
            year_level: true
          }
        }
      },
      orderBy: [{ user_id: 'asc' }, { transaction_type: 'asc' }, { updated_at: 'desc' }]
    })

    // Optional post-query user filter (department / user_type)
    // so we can use the User relation's fields.
    const filtered = settlements.filter((s) => {
      if (departmentId) {
        const did = s.user?.department_id
        if (did == null || String(did) !== String(departmentId)) return false
      }
      if (userType) {
        if (s.user?.user_type !== userType) return false
      }
      return true
    })

    // Group by user. Each user row exposes per-type totals
    // and a settlements list.
    interface UserRow {
      user: any
      book: { total: number; paid: number; remaining: number; count: number }
      locker: { total: number; paid: number; remaining: number; count: number }
      combined: { total: number; paid: number; remaining: number; count: number }
      settlements: any[]
    }

    const grouped = new Map<number, UserRow>()
    for (const s of filtered) {
      const userId = s.user_id
      if (!grouped.has(userId)) {
        grouped.set(userId, {
          user: s.user,
          book: { total: 0, paid: 0, remaining: 0, count: 0 },
          locker: { total: 0, paid: 0, remaining: 0, count: 0 },
          combined: { total: 0, paid: 0, remaining: 0, count: 0 },
          settlements: []
        })
      }
      const row = grouped.get(userId)!
      const total = Number(s.penalty_amount || 0)
      const paid = Number(s.amount_paid || 0)
      const remaining = Number(s.remaining_balance || 0)
      row.combined.total += total
      row.combined.paid += paid
      row.combined.remaining += remaining
      row.combined.count += 1
      if (s.transaction_type === 'BOOK') {
        row.book.total += total
        row.book.paid += paid
        row.book.remaining += remaining
        row.book.count += 1
      } else if (s.transaction_type === 'LOCKER') {
        row.locker.total += total
        row.locker.paid += paid
        row.locker.remaining += remaining
        row.locker.count += 1
      }
      row.settlements.push({
        settlement_id: s.settlement_id,
        transaction_type: s.transaction_type,
        transaction_id: s.transaction_id,
        penalty_amount: total,
        amount_paid: paid,
        remaining_balance: remaining,
        status: s.status,
        settled_at: s.settled_at,
        notes: s.notes,
        created_at: s.created_at,
        updated_at: s.updated_at
      })
    }

    // Round to 2 decimals so the report doesn't have FP noise.
    const round = (n: number) => Math.round(n * 100) / 100
    const rows = Array.from(grouped.values()).map((r) => ({
      user: r.user,
      book: {
        total: round(r.book.total),
        paid: round(r.book.paid),
        remaining: round(r.book.remaining),
        count: r.book.count
      },
      locker: {
        total: round(r.locker.total),
        paid: round(r.locker.paid),
        remaining: round(r.locker.remaining),
        count: r.locker.count
      },
      combined: {
        total: round(r.combined.total),
        paid: round(r.combined.paid),
        remaining: round(r.combined.remaining),
        count: r.combined.count
      },
      settlements: r.settlements
    }))

    // Sort by remaining (descending) so the biggest outstanding
    // balances float to the top of the report.
    rows.sort(
      (a, b) =>
        b.combined.remaining - a.combined.remaining ||
        a.user.full_name?.localeCompare(b.user.full_name || '') || 0
    )

    // Grand totals for the report header.
    const grand = {
      total: round(rows.reduce((s, r) => s + r.combined.total, 0)),
      paid: round(rows.reduce((s, r) => s + r.combined.paid, 0)),
      remaining: round(rows.reduce((s, r) => s + r.combined.remaining, 0)),
      borrower_count: rows.length,
      settlement_count: rows.reduce((s, r) => s + r.combined.count, 0)
    }

    return NextResponse.json({
      success: true,
      type,
      filters: {
        date_from: dateFrom,
        date_to: dateTo,
        department_id: departmentId,
        user_type: userType
      },
      grand,
      rows
    })
  } catch (error) {
    console.error('Error generating fines summary:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
