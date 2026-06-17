import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditService } from '@/lib/services/audit.service'
import { UserRole } from '@/types'
import { OverdueSettlementStatus } from '@prisma/client'

// POST /api/overdue/bulk-payment - Process bulk payment for multiple penalties
export async function POST(request: NextRequest) {
  try {
    console.log('Bulk payment - Starting...')
    const session = await getServerSession(authOptions)
    
    console.log('Bulk payment - Session:', { 
      exists: !!session, 
      id: session?.user?.id, 
      role: session?.user?.role 
    })
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN and STAFF can process payments
    if (!['ADMIN', 'STAFF', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    console.log('Bulk payment - Request body:', { 
      user_id: body.user_id, 
      settlement_count: body.settlement_ids?.length,
      payment_amount: body.payment_amount 
    })
    const { 
      user_id, 
      settlement_ids, // Array of settlement IDs to pay
      payment_amount, // Total amount being paid
      payment_method = 'CASH',
      notes 
    } = body

    if (!user_id || !settlement_ids || !Array.isArray(settlement_ids) || settlement_ids.length === 0) {
      return NextResponse.json({ 
        error: 'user_id and settlement_ids are required' 
      }, { status: 400 })
    }

    if (!payment_amount || payment_amount <= 0) {
      return NextResponse.json({ 
        error: 'payment_amount must be greater than 0' 
      }, { status: 400 })
    }

    const currentDate = new Date()
    const numericIds = settlement_ids.map((id: any) => parseInt(id))

    // Fetch existing settlements
    const existingSettlements = await prisma.overdueSettlement.findMany({
      where: {
        settlement_id: { in: numericIds },
        user_id: parseInt(user_id),
        status: { in: ['PENDING', 'PARTIAL'] }
      },
      orderBy: {
        created_at: 'asc'
      }
    })

    console.log('Bulk payment - Existing settlements found:', existingSettlements.length)

    // Find IDs that are not settlements (these are transaction_ids for unreturned items)
    const foundSettlementIds = existingSettlements.map(s => s.settlement_id)
    const potentialTransactionIds = numericIds.filter(id => !foundSettlementIds.includes(id))

    console.log('Bulk payment - Potential transaction IDs:', potentialTransactionIds.length)

    // Create settlements for unreturned overdue books
    const unreturnedBooks = potentialTransactionIds.length > 0 ? await prisma.bookTransaction.findMany({
      where: {
        transaction_id: { in: potentialTransactionIds },
        user_id: parseInt(user_id),
        return_date: null,
        due_date: { lt: currentDate }
      }
    }) : []

    // Create settlements for unreturned overdue lockers
    const unreturnedLockers = potentialTransactionIds.length > 0 ? await prisma.lockerTransaction.findMany({
      where: {
        transaction_id: { in: potentialTransactionIds },
        user_id: parseInt(user_id),
        return_time: null
      }
    }) : []

    console.log('Bulk payment - Unreturned books found:', unreturnedBooks.length)
    console.log('Bulk payment - Unreturned lockers found:', unreturnedLockers.length)

    // Create settlements for unreturned items
    const newSettlements = []
    
    for (const book of unreturnedBooks) {
      if (!book.due_date) {
        console.warn(`Book transaction ${book.transaction_id} has no due date, skipping`)
        continue
      }
      
      const dueDate = new Date(book.due_date)
      const daysOverdue = Math.floor((currentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      const calculatedPenalty = Math.max(0, daysOverdue * 10)

      if (calculatedPenalty > 0) {
        const settlement = await prisma.overdueSettlement.create({
          data: {
            user_id: parseInt(user_id),
            transaction_type: 'BOOK',
            transaction_id: book.transaction_id,
            penalty_amount: calculatedPenalty,
            amount_paid: 0,
            remaining_balance: calculatedPenalty,
            status: 'PENDING',
            processed_by: session.user.id ? parseInt(session.user.id) : null
          }
        })
        newSettlements.push(settlement)
      }
    }

    for (const locker of unreturnedLockers) {
      const borrowTime = new Date(locker.borrow_time)
      const dueTime = locker.due_time ? new Date(locker.due_time) : null
      
      const timeUsedMs = currentDate.getTime() - borrowTime.getTime()
      const hoursUsed = timeUsedMs / (1000 * 60 * 60)
      
      let calculatedPenalty = 0
      
      if (dueTime) {
        const exceededMs = currentDate.getTime() - dueTime.getTime()
        if (exceededMs > 0) {
          const hoursOverdue = exceededMs / (1000 * 60 * 60)
          calculatedPenalty = Math.floor(hoursOverdue) * 20
        }
      } else {
        const freeHours = 2
        if (hoursUsed > freeHours) {
          const hoursOverdue = hoursUsed - freeHours
          calculatedPenalty = Math.floor(hoursOverdue) * 20
        }
      }

      if (calculatedPenalty > 0) {
        const settlement = await prisma.overdueSettlement.create({
          data: {
            user_id: parseInt(user_id),
            transaction_type: 'LOCKER',
            transaction_id: locker.transaction_id,
            penalty_amount: calculatedPenalty,
            amount_paid: 0,
            remaining_balance: calculatedPenalty,
            status: 'PENDING',
            processed_by: session.user.id ? parseInt(session.user.id) : null
          }
        })
        newSettlements.push(settlement)
      }
    }

    console.log('Bulk payment - New settlements created:', newSettlements.length)

    // Combine existing and new settlements
    const settlements = [...existingSettlements, ...newSettlements].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    if (settlements.length === 0) {
      return NextResponse.json({ 
        error: 'No valid pending penalties found for payment' 
      }, { status: 404 })
    }

    // Calculate total remaining balance
    const totalBalance = settlements.reduce((sum, s) => sum + Number(s.remaining_balance), 0)

    if (payment_amount > totalBalance) {
      return NextResponse.json({ 
        error: `Payment amount (₱${payment_amount}) exceeds total balance (₱${totalBalance})` 
      }, { status: 400 })
    }

    // Distribute payment across settlements (FIFO - oldest first)
    let remainingPayment = Number(payment_amount)
    const updates: Array<{
      settlement_id: number
      amount_paid: number
      remaining_balance: number
      status: OverdueSettlementStatus
      transaction_type: string
      transaction_id: number
    }> = []

    for (const settlement of settlements) {
      if (remainingPayment <= 0) break

      const remainingBalance = Number(settlement.remaining_balance)
      const paymentForThis = Math.min(remainingPayment, remainingBalance)
      const newAmountPaid = Number(settlement.amount_paid) + paymentForThis
      const newRemainingBalance = remainingBalance - paymentForThis
      const newStatus: OverdueSettlementStatus = newRemainingBalance === 0 ? OverdueSettlementStatus.SETTLED : OverdueSettlementStatus.PARTIAL

      updates.push({
        settlement_id: settlement.settlement_id,
        amount_paid: newAmountPaid,
        remaining_balance: newRemainingBalance,
        status: newStatus,
        transaction_type: settlement.transaction_type,
        transaction_id: settlement.transaction_id
      })

      remainingPayment -= paymentForThis
    }

    // Execute all updates in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedSettlements = []

      for (const update of updates) {
        const updated = await tx.overdueSettlement.update({
          where: { settlement_id: update.settlement_id },
          data: {
            amount_paid: update.amount_paid,
            remaining_balance: update.remaining_balance,
            status: update.status,
            updated_at: new Date()
          },
          include: {
            user: {
              select: {
                full_name: true,
                account_id: true
              }
            }
          }
        })

        updatedSettlements.push(updated)
      }

      return updatedSettlements
    })

    // Get user info for audit log
    const user = await prisma.user.findUnique({
      where: { user_id: parseInt(user_id) },
      select: { full_name: true, account_id: true }
    })

    // Log the action
    const currentUserAccount = await prisma.userAccount.findUnique({
      where: { username: session.user.username },
      include: { user: true }
    })

    if (currentUserAccount?.user) {
      const settledCount = updates.filter(u => u.status === OverdueSettlementStatus.SETTLED).length
      const partialCount = updates.filter(u => u.status === OverdueSettlementStatus.PARTIAL).length
      
      await AuditService.logAction(
        currentUserAccount.id,
        currentUserAccount.role as UserRole,
        'BULK_PAYMENT',
        `Processed bulk payment of ₱${payment_amount} for ${user?.full_name} (${user?.account_id}). ${settledCount} fully paid, ${partialCount} partial. Method: ${payment_method}`
      )
    }

    return NextResponse.json({
      success: true,
      message: `Payment of ₱${payment_amount} processed successfully`,
      data: {
        payment_amount: Number(payment_amount),
        settlements_updated: result.length,
        fully_paid_count: updates.filter(u => u.status === OverdueSettlementStatus.SETTLED).length,
        partial_paid_count: updates.filter(u => u.status === OverdueSettlementStatus.PARTIAL).length,
        remaining_payment: remainingPayment,
        updated_settlements: result.map(s => ({
          settlement_id: s.settlement_id,
          transaction_type: s.transaction_type,
          transaction_id: s.transaction_id,
          amount_paid: Number(s.amount_paid),
          remaining_balance: Number(s.remaining_balance),
          status: s.status
        }))
      }
    })
  } catch (error) {
    console.error('Error processing bulk payment:', error)
    console.error('Error details:', error instanceof Error ? error.message : String(error))
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

