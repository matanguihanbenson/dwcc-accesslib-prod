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
    const reason: string | undefined = typeof body?.reason === 'string' ? body.reason.trim() : undefined

    if (!settlement_id || settlement_id <= 0) {
      return NextResponse.json({ error: 'settlement_id is required' }, { status: 400 })
    }

    if (!reason) {
      return NextResponse.json({ error: 'reason is required for refund' }, { status: 400 })
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

    // Can only refund if there's something paid
    if (Number(settlement.amount_paid) <= 0) {
      return NextResponse.json(
        { error: 'No payment has been made on this settlement. Nothing to refund.' },
        { status: 400 }
      )
    }

    // Load the actor's user account
    const actorAccount = await prisma.userAccount.findFirst({
      where: { user_id: auth.userId, is_active: true },
      include: { user: { select: { full_name: true, account_id: true } } }
    })

    if (!actorAccount) {
      return NextResponse.json({ error: 'Actor account not found' }, { status: 404 })
    }

    const refundAmount = Number(settlement.amount_paid)

    await prisma.$transaction(async (tx) => {
      // Update settlement: zero out amount_paid, restore remaining_balance, reactivate
      await tx.overdueSettlement.update({
        where: { settlement_id },
        data: {
          amount_paid: 0,
          remaining_balance: settlement.penalty_amount,
          status: 'PENDING',
          settled_at: null,
          processed_by: auth.userId,
          notes: `${settlement.notes ? settlement.notes + ' | ' : ''}REFUND: ₱${refundAmount.toFixed(2)} refunded. Reason: ${reason}`,
          updated_at: new Date(),
        },
      })

      // Create payment record for refund
      await tx.paymentRecord.create({
        data: {
          settlement_id,
          type: 'REFUND',
          amount: refundAmount,
          notes: `Refund of ₱${refundAmount.toFixed(2)}. Reason: ${reason}`,
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
        'REFUND_PAYMENT',
        `Refunded ₱${refundAmount.toFixed(2)} for ${settlement.transaction_type} settlement #${settlement_id} (borrower: ${borrowerLabel}). Fine of ₱${Number(settlement.penalty_amount).toFixed(2)} reactivated. Reason: ${reason}. Processed by ${actorName} (${actorLogin}).`
      )
    } catch (auditError) {
      console.error('Failed to write refund audit log:', auditError)
    }

    return NextResponse.json({
      message: 'Refund processed successfully',
      settlement_id,
      refund_amount: refundAmount,
      remaining_balance: Number(settlement.penalty_amount),
      status: 'PENDING',
    })

  } catch (error) {
    console.error('Error processing refund:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
