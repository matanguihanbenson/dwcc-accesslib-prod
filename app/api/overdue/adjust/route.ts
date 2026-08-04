import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import jwt from 'jsonwebtoken'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditService } from '@/lib/services/audit.service'
import { UserRole } from '@/types'

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
    const settlement_id: number | undefined = body?.settlement_id
    const corrected_amount: number | undefined = body?.corrected_amount
    const reason: string | undefined = typeof body?.reason === 'string' ? body.reason.trim() : undefined

    if (!settlement_id || settlement_id <= 0) {
      return NextResponse.json({ error: 'settlement_id is required' }, { status: 400 })
    }

    if (corrected_amount === undefined || corrected_amount < 0) {
      return NextResponse.json({ error: 'corrected_amount is required and must be >= 0' }, { status: 400 })
    }

    if (!reason) {
      return NextResponse.json({ error: 'reason is required for adjustment' }, { status: 400 })
    }

    // Load settlement
    const settlement = await prisma.overdueSettlement.findUnique({
      where: { settlement_id },
      include: {
        user: { select: { full_name: true, account_id: true } },
        processedByUser: { select: { full_name: true, account_id: true } },
      },
    })

    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 })
    }

    // Can only adjust if settlement is PENDING or PARTIAL (not yet fully settled)
    if (settlement.status === 'SETTLED') {
      return NextResponse.json(
        { error: 'Cannot adjust a fully settled payment. Use refund to reverse the payment first.' },
        { status: 400 }
      )
    }

    // corrected_amount must be <= penalty_amount
    if (corrected_amount > Number(settlement.penalty_amount)) {
      return NextResponse.json(
        { error: `Corrected amount (₱${corrected_amount.toFixed(2)}) cannot exceed the penalty amount (₱${Number(settlement.penalty_amount).toFixed(2)})` },
        { status: 400 }
      )
    }

    const previousAmount = Number(settlement.amount_paid)

    // Load the actor's user account
    const actorAccount = await prisma.userAccount.findFirst({
      where: { user_id: auth.userId, is_active: true },
      include: { user: { select: { full_name: true, account_id: true } } }
    })

    if (!actorAccount) {
      return NextResponse.json({ error: 'Actor account not found' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      // Update settlement with corrected amount
      const newRemaining = Math.max(0, Number(settlement.penalty_amount) - corrected_amount)
      const newStatus = newRemaining === 0 ? 'SETTLED' :
                       corrected_amount > 0 ? 'PARTIAL' : 'PENDING'

      await tx.overdueSettlement.update({
        where: { settlement_id },
        data: {
          amount_paid: corrected_amount,
          remaining_balance: newRemaining,
          status: newStatus,
          settled_at: newStatus === 'SETTLED' ? new Date() : null,
          processed_by: auth.userId,
          notes: `${settlement.notes ? settlement.notes + ' | ' : ''}ADJUSTMENT: ₱${previousAmount.toFixed(2)} adjusted to ₱${corrected_amount.toFixed(2)}. Reason: ${reason}`,
          updated_at: new Date(),
        },
      })

      // Create payment record for adjustment
      await tx.paymentRecord.create({
        data: {
          settlement_id,
          type: 'ADJUSTMENT',
          amount: corrected_amount,
          notes: `Adjusted from ₱${previousAmount.toFixed(2)} to ₱${corrected_amount.toFixed(2)}. Reason: ${reason}`,
          processed_by: auth.userId,
        }
      })
    })

    // Audit log
    try {
      const actorName = actorAccount.user?.full_name || actorAccount.username
      const actorLogin = actorAccount.user?.account_id || actorAccount.username
      const borrowerLabel = (settlement as any).user
        ? `${(settlement as any).user.full_name} (${(settlement as any).user.account_id})`
        : `user_id=${settlement.user_id}`

      await AuditService.logAction(
        actorAccount.id,
        actorAccount.role as UserRole,
        'ADJUST_PAYMENT',
        `Adjusted payment for ${settlement.transaction_type} settlement #${settlement_id} (borrower: ${borrowerLabel}). ₱${previousAmount.toFixed(2)} → ₱${corrected_amount.toFixed(2)}. Reason: ${reason}. Processed by ${actorName} (${actorLogin}).`
      )
    } catch (auditError) {
      console.error('Failed to write adjustment audit log:', auditError)
    }

    return NextResponse.json({
      message: 'Payment adjusted successfully',
      settlement_id,
      previous_amount: previousAmount,
      corrected_amount,
      remaining_balance: Math.max(0, Number(settlement.penalty_amount) - corrected_amount),
      status: corrected_amount >= Number(settlement.penalty_amount) ? 'SETTLED' :
              corrected_amount > 0 ? 'PARTIAL' : 'PENDING',
    })

  } catch (error) {
    console.error('Error processing adjustment:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
