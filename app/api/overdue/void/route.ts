import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import jwt from 'jsonwebtoken'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    const reason: string | undefined = typeof body?.reason === 'string' ? body.reason.trim() : undefined

    const transaction_id = Number(transaction_id_raw)

    if (!transaction_type || !['BOOK', 'LOCKER'].includes(transaction_type)) {
      return NextResponse.json({ error: 'Invalid transaction_type. Must be BOOK or LOCKER' }, { status: 400 })
    }

    if (!Number.isFinite(transaction_id) || transaction_id <= 0) {
      return NextResponse.json({ error: 'Invalid transaction_id' }, { status: 400 })
    }

    // Load transaction to get user_id
    const transactionData =
      transaction_type === 'BOOK'
        ? await prisma.bookTransaction.findUnique({
            where: { transaction_id },
            select: { transaction_id: true, user_id: true },
          })
        : await prisma.lockerTransaction.findUnique({
            where: { transaction_id },
            select: { transaction_id: true, user_id: true },
          })

    if (!transactionData) {
      return NextResponse.json({ error: `${transaction_type === 'BOOK' ? 'Book' : 'Locker'} transaction not found` }, { status: 404 })
    }

    const existingSettlement = await prisma.overdueSettlement.findFirst({
      where: {
        transaction_type,
        transaction_id,
      },
    })

    if (existingSettlement && Number(existingSettlement.amount_paid) > 0) {
      return NextResponse.json(
        {
          error: 'Cannot void a penalty that already has payments recorded',
          details: 'This transaction has payment history. Consider handling as a refund/adjustment instead.',
        },
        { status: 400 }
      )
    }

    const updated = await prisma.$transaction(async (tx) => {
      const notes = reason ? `VOIDED: ${reason}` : 'VOIDED'

      if (existingSettlement) {
        return tx.overdueSettlement.update({
          where: { settlement_id: existingSettlement.settlement_id },
          data: {
            penalty_amount: 0,
            amount_paid: 0,
            remaining_balance: 0,
            status: 'SETTLED',
            settled_at: new Date(),
            processed_by: auth.userId,
            notes,
            updated_at: new Date(),
          },
        })
      }

      return tx.overdueSettlement.create({
        data: {
          user_id: transactionData.user_id ?? 0,
          transaction_type,
          transaction_id,
          penalty_amount: 0,
          amount_paid: 0,
          remaining_balance: 0,
          status: 'SETTLED',
          settled_at: new Date(),
          processed_by: auth.userId,
          notes,
        },
      })
    })

    return NextResponse.json({
      message: 'Penalty voided successfully',
      settlement_id: updated.settlement_id,
      status: updated.status,
      penalty_amount: Number(updated.penalty_amount),
      remaining_balance: Number(updated.remaining_balance),
    })
  } catch (error) {
    console.error('Error voiding overdue penalty:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
