import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import jwt from 'jsonwebtoken'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditService } from '@/lib/services/audit.service'
import { calculateActiveHoursOverdue } from '@/lib/timezone'
import { UserRole } from '@/types'

type TransactionType = 'BOOK' | 'LOCKER'

async function getAuthContext(request: NextRequest): Promise<{
  isAuthenticated: boolean
  role: string | null
  userId: number | null
}> {
  let role: string | null = null
  let userId: number | null = null
  let isAuthenticated = false

  const session = await getServerSession(authOptions)

  if (session?.user?.username) {
    try {
      const userAccount = await prisma.userAccount.findFirst({
        where: {
          username: session.user.username,
          is_active: true,
        },
        include: {
          user: true,
        },
      })

      if (userAccount) {
        role = userAccount.role
        userId = userAccount.user_id
        isAuthenticated = true
      }
    } catch (error) {
      console.error('Database error during session lookup:', error)
    }
  }

  if (!isAuthenticated) {
    const token = request.cookies.get('token')?.value

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
        const accountId = decoded.userId

        const userAccount = await prisma.userAccount.findFirst({
          where: { id: accountId, is_active: true },
          include: { user: true },
        })

        if (userAccount) {
          role = userAccount.role
          userId = userAccount.user_id
          isAuthenticated = true
        }
      } catch (error) {
        console.warn('JWT verification failed:', error)
      }
    }
  }

  return { isAuthenticated, role, userId }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request)

    if (!auth.isAuthenticated || !auth.role || !auth.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (!['ADMIN', 'STAFF', 'SUPER_ADMIN'].includes(auth.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const transaction_type: TransactionType | undefined = body?.transaction_type
    const transaction_id_raw: unknown = body?.transaction_id
    const overridden_return_date: string | undefined = body?.overridden_return_date
    const reason: string | undefined = typeof body?.reason === 'string' ? body.reason.trim() : undefined

    const transaction_id = Number(transaction_id_raw)

    if (!transaction_type || !['BOOK', 'LOCKER'].includes(transaction_type)) {
      return NextResponse.json({ error: 'Invalid transaction_type. Must be BOOK or LOCKER' }, { status: 400 })
    }

    if (!Number.isFinite(transaction_id) || transaction_id <= 0) {
      return NextResponse.json({ error: 'Invalid transaction_id' }, { status: 400 })
    }

    if (!overridden_return_date) {
      return NextResponse.json({ error: 'overridden_return_date is required' }, { status: 400 })
    }

    if (!reason) {
      return NextResponse.json({ error: 'reason is required for return override' }, { status: 400 })
    }

    const overrideDate = new Date(overridden_return_date)
    if (isNaN(overrideDate.getTime())) {
      return NextResponse.json({ error: 'Invalid overridden_return_date' }, { status: 400 })
    }

    // Load the actor's user account
    const actorAccount = await prisma.userAccount.findFirst({
      where: { user_id: auth.userId, is_active: true },
      include: { user: { select: { full_name: true, account_id: true } } }
    })

    if (!actorAccount) {
      return NextResponse.json({ error: 'Actor account not found' }, { status: 404 })
    }

    // Load transaction
    const transaction =
      transaction_type === 'BOOK'
        ? await prisma.bookTransaction.findUnique({
            where: { transaction_id },
            include: { user: { select: { full_name: true, account_id: true } } },
          })
        : await prisma.lockerTransaction.findUnique({
            where: { transaction_id },
            include: { user: { select: { full_name: true, account_id: true } } },
          })

    if (!transaction) {
      return NextResponse.json({ error: `${transaction_type === 'BOOK' ? 'Book' : 'Locker'} transaction not found` }, { status: 404 })
    }

    // Cannot override if the item has not been returned yet
    const isReturned = transaction_type === 'BOOK'
      ? !!(transaction as any).return_date
      : !!(transaction as any).return_time

    if (!isReturned) {
      return NextResponse.json(
        { error: 'Cannot override return date for an item that has not been returned yet. Return the item first before overriding.' },
        { status: 400 }
      )
    }

    // Cannot override if there is already a partial payment
    const existingSettlement = await prisma.overdueSettlement.findFirst({
      where: { transaction_type, transaction_id },
    })

    if (existingSettlement && Number(existingSettlement.amount_paid) > 0) {
      return NextResponse.json(
        { error: 'Cannot override return date when a partial payment has already been made. Process a refund or adjustment instead.' },
        { status: 400 }
      )
    }

    // Must be overdue to override
    const dueDate = transaction_type === 'BOOK'
      ? (transaction as any).due_date
      : (transaction as any).due_time

    if (!dueDate) {
      return NextResponse.json({ error: 'Transaction has no due date/time set' }, { status: 400 })
    }

    // Load fine settings
    const settingsRecord = await prisma.systemConfig.findUnique({ where: { key: 'fines' } })
    const fines = settingsRecord ? JSON.parse(settingsRecord.value) : {}

    // Calculate new penalty based on overridden return date
    let newPenalty = 0

    if (transaction_type === 'BOOK') {
      const dueDateObj = new Date((transaction as any).due_date)
      const overrideDateOnly = new Date(overrideDate.getFullYear(), overrideDate.getMonth(), overrideDate.getDate())
      const dueDateOnly = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), dueDateObj.getDate())

      if (overrideDateOnly > dueDateOnly) {
        const daysOverdue = Math.ceil((overrideDateOnly.getTime() - dueDateOnly.getTime()) / (1000 * 60 * 60 * 24))
        const penaltyPerDay = fines.penalty_per_day || 5
        const maxBookFine = fines.max_book_fine || 500
        newPenalty = Math.min(daysOverdue * penaltyPerDay, maxBookFine)
      }
    } else {
      // Locker: recalculate using library active hours
      const borrowTime = new Date((transaction as any).borrow_time)
      const dueTimeObj = new Date((transaction as any).due_time)
      const gracePeriodMinutes = fines.grace_period_minutes || 15
      const fineStartTime = new Date(dueTimeObj.getTime() + gracePeriodMinutes * 60_000)

      if (overrideDate > fineStartTime) {
        const activeHours = calculateActiveHoursOverdue(fineStartTime, overrideDate)
        const roundedHours = Math.ceil(activeHours)
        const rate = fines.locker_fine_per_hour || 20
        const maxFine = fines.max_locker_fine || 500
        newPenalty = Math.min(roundedHours * rate, maxFine)
      }

      // Suppress unused variable warning
      void borrowTime
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Update the transaction with overridden return date and new penalty
      if (transaction_type === 'BOOK') {
        await tx.bookTransaction.update({
          where: { transaction_id },
          data: {
            return_date: overrideDate,
            penalty: newPenalty,
            status: newPenalty === 0 ? 'COMPLETED' : 'COMPLETED',
            return_override_reason: reason,
            return_overridden_by: auth.userId,
            return_overridden_at: new Date(),
          },
        })
      } else {
        await tx.lockerTransaction.update({
          where: { transaction_id },
          data: {
            return_time: overrideDate,
            penalty: newPenalty,
            status: 'COMPLETED',
            return_override_reason: reason,
            return_overridden_by: auth.userId,
            return_overridden_at: new Date(),
          },
        })

        // Also free the locker
        const lockerTx = transaction as any
        if (lockerTx.locker_id) {
          await tx.locker.update({
            where: { locker_id: lockerTx.locker_id },
            data: { status: 'AVAILABLE' },
          })
        }
      }

      // Handle settlement: if penalty is now 0, void any existing settlement
      const existingSettlement = await tx.overdueSettlement.findFirst({
        where: { transaction_type, transaction_id },
      })

      if (newPenalty === 0 && existingSettlement) {
        // Void the settlement since there's no longer a penalty
        await tx.overdueSettlement.update({
          where: { settlement_id: existingSettlement.settlement_id },
          data: {
            penalty_amount: 0,
            amount_paid: existingSettlement.amount_paid,
            remaining_balance: 0,
            status: Number(existingSettlement.amount_paid) > 0 ? 'SETTLED' : 'SETTLED',
            settled_at: new Date(),
            processed_by: auth.userId,
            notes: `OVERRIDE: Return date overridden. ${reason}`,
            updated_at: new Date(),
          },
        })
      } else if (newPenalty > 0 && existingSettlement) {
        // Update existing settlement with new penalty
        await tx.overdueSettlement.update({
          where: { settlement_id: existingSettlement.settlement_id },
          data: {
            penalty_amount: newPenalty,
            remaining_balance: Math.max(newPenalty - Number(existingSettlement.amount_paid), 0),
            status: Number(existingSettlement.amount_paid) >= newPenalty ? 'SETTLED' : 'PENDING',
            updated_at: new Date(),
            notes: `OVERRIDE: Return date overridden. ${reason}`,
          },
        })
      } else if (newPenalty > 0 && !existingSettlement) {
        // Create new settlement
        await tx.overdueSettlement.create({
          data: {
            user_id: (transaction as any).user_id,
            transaction_type,
            transaction_id,
            penalty_amount: newPenalty,
            amount_paid: 0,
            remaining_balance: newPenalty,
            status: 'PENDING',
            processed_by: auth.userId,
            notes: `OVERRIDE: Return date overridden. ${reason}`,
          },
        })
      }

      return { success: true }
    })

    // Audit log
    try {
      const actorName = actorAccount.user?.full_name || actorAccount.username
      const actorLogin = actorAccount.user?.account_id || actorAccount.username
      const borrowerLabel = transaction.user
        ? `${transaction.user.full_name} (${transaction.user.account_id})`
        : `user_id=${(transaction as any).user_id ?? 'n/a'}`
      const priorPenalty = Number((transaction as any).penalty)
      await AuditService.logAction(
        actorAccount.id,
        actorAccount.role as UserRole,
        'OVERRIDE_RETURN_DATE',
        `Overrode return date for ${transaction_type} transaction #${transaction_id} (borrower: ${borrowerLabel}). New penalty: ₱${newPenalty.toFixed(2)} (was ₱${priorPenalty.toFixed(2)}). Reason: ${reason}. Overridden by ${actorName} (${actorLogin}).`
      )
    } catch (auditError) {
      console.error('Failed to write override audit log:', auditError)
    }

    return NextResponse.json({
      message: 'Return date overridden successfully',
      new_penalty: newPenalty,
      transaction_id,
      transaction_type,
    })
  } catch (error) {
    console.error('Error overriding return date:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
