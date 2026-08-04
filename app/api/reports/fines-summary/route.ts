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
 * Sources:
 *   1. overdue_settlement rows (returned items with fines)
 *   2. Active overdue transactions (still checked out past due,
 *      penalty calculated dynamically from due_date)
 *
 * Query params:
 *   - `type`       : 'combined' (default) | 'book' | 'locker'
 *   - `date_from`  : ISO date
 *   - `date_to`    : ISO date
 *   - `department_id` : optional
 *   - `user_type`  : optional
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

    // Load fine settings for dynamic penalty calculation
    const fineSettings = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: ['book_fine_per_day', 'locker_fine_per_hour', 'max_book_fine', 'max_locker_fine']
        }
      }
    })
    const bookFinePerDay = parseFloat(fineSettings.find(s => s.key === 'book_fine_per_day')?.value || '5')
    const lockerFinePerHour = parseFloat(fineSettings.find(s => s.key === 'locker_fine_per_hour')?.value || '20')
    const maxBookFine = parseFloat(fineSettings.find(s => s.key === 'max_book_fine')?.value || '100')
    const maxLockerFine = parseFloat(fineSettings.find(s => s.key === 'max_locker_fine')?.value || '500')

    const currentDate = new Date()
    const round = (n: number) => Math.round(n * 100) / 100

    // ── User filter helpers ─────────────────────────────────
    const userSelect = {
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

    // ── 1. Settlement-based fines (returned items) ─────────
    // Query ALL settlements without status or notes filters,
    // matching the individual student report's approach.
    const settlementWhere: any = {}
    if (type === 'book') settlementWhere.transaction_type = 'BOOK'
    if (type === 'locker') settlementWhere.transaction_type = 'LOCKER'

    const settlements = await prisma.overdueSettlement.findMany({
      where: settlementWhere,
      include: { user: { select: userSelect } }
    })

    // ── 2. Active overdue book transactions ────────────────
    const activeOverdueBooks: any[] = []
    if (type === 'book' || type === 'combined') {
      const bookTxns = await prisma.bookTransaction.findMany({
        where: {
          status: { in: ['ACTIVE', 'OVERDUE'] },
          due_date: { lt: currentDate },
          return_date: null
        },
        include: {
          user: { select: userSelect },
          book: { select: { title: true } }
        }
      })
      for (const tx of bookTxns) {
        if (!tx.user) continue
        const daysOverdue = Math.max(0, Math.floor(
          (currentDate.getTime() - new Date(tx.due_date!).getTime()) / (1000 * 60 * 60 * 24)
        ))
        const calculatedPenalty = Math.min(
          Math.max(Number(tx.penalty), daysOverdue * bookFinePerDay),
          maxBookFine
        )
        if (calculatedPenalty <= 0) continue

        // Check if a settlement already exists for this transaction
        const hasSettlement = settlements.some(
          s => s.transaction_type === 'BOOK' && s.transaction_id === tx.transaction_id
        )
        if (hasSettlement) continue

        activeOverdueBooks.push({
          user_id: tx.user_id,
          user: tx.user,
          transaction_type: 'BOOK',
          transaction_id: tx.transaction_id,
          penalty_amount: calculatedPenalty,
          amount_paid: 0,
          remaining_balance: calculatedPenalty,
          status: 'PENDING',
          created_at: tx.created_at,
          updated_at: tx.updated_at
        })
      }
    }

    // ── 3. Active overdue locker transactions ──────────────
    const activeOverdueLockers: any[] = []
    if (type === 'locker' || type === 'combined') {
      const lockerTxns = await prisma.lockerTransaction.findMany({
        where: {
          status: { in: ['ACTIVE', 'OVERDUE'] },
          due_time: { lt: currentDate },
          return_time: null
        },
        include: {
          user: { select: userSelect }
        }
      })
      for (const tx of lockerTxns) {
        if (!tx.user) continue
        const hoursOverdue = Math.max(0, Math.ceil(
          (currentDate.getTime() - new Date(tx.due_time!).getTime()) / (1000 * 60 * 60)
        ))
        const calculatedPenalty = Math.min(
          Math.max(Number(tx.penalty), hoursOverdue * lockerFinePerHour),
          maxLockerFine
        )
        if (calculatedPenalty <= 0) continue

        const hasSettlement = settlements.some(
          s => s.transaction_type === 'LOCKER' && s.transaction_id === tx.transaction_id
        )
        if (hasSettlement) continue

        activeOverdueLockers.push({
          user_id: tx.user_id,
          user: tx.user,
          transaction_type: 'LOCKER',
          transaction_id: tx.transaction_id,
          penalty_amount: calculatedPenalty,
          amount_paid: 0,
          remaining_balance: calculatedPenalty,
          status: 'PENDING',
          created_at: tx.created_at,
          updated_at: tx.updated_at
        })
      }
    }

    // ── Merge all fine sources ─────────────────────────────
    const allFines = [...settlements, ...activeOverdueBooks, ...activeOverdueLockers]

    // Optional post-query user filter
    const filtered = allFines.filter((s) => {
      if (departmentId) {
        const did = s.user?.department_id
        if (did == null || String(did) !== String(departmentId)) return false
      }
      if (userType) {
        if (s.user?.user_type !== userType) return false
      }
      return true
    })

    // ── Group by user ──────────────────────────────────────
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
        transaction_type: s.transaction_type,
        transaction_id: s.transaction_id,
        penalty_amount: total,
        amount_paid: paid,
        remaining_balance: remaining,
        status: s.status,
        created_at: s.created_at,
        updated_at: s.updated_at
      })
    }

    // Round to 2 decimals
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

    // Sort by remaining (descending)
    rows.sort(
      (a, b) =>
        b.combined.remaining - a.combined.remaining ||
        a.user.full_name?.localeCompare(b.user.full_name || '') || 0
    )

    // Grand totals
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
