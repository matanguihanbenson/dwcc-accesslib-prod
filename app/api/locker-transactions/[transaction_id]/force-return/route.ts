import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditService } from '@/lib/services/audit.service'
import { UserRole } from '@/types'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ transaction_id: string }> }
) {
  try {
    // Check authentication and authorization
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN and SUPER_ADMIN can force return lockers
    if (!['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const resolvedParams = await params
    const transactionId = parseInt(resolvedParams.transaction_id)

    // Get the transaction with related data
    const transaction = await prisma.lockerTransaction.findUnique({
      where: { transaction_id: transactionId },
      include: {
        locker: true,
        user: true
      }
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    if (transaction.return_time) {
      return NextResponse.json({ 
        error: 'Locker has already been returned' 
      }, { status: 400 })
    }

    const returnTime = new Date()
    
    // Calculate penalty based on 2 hours free use + 20 pesos per hour exceeded
    const borrowTime = new Date(transaction.borrow_time)
    const dueTime = transaction.due_time ? new Date(transaction.due_time) : null
    
    // Calculate if overdue and penalty amount
    let calculatedPenalty = 0
    
    if (dueTime) {
      // If due_time exists (with extensions), check if exceeded
      if (returnTime > dueTime) {
        const exceededMs = returnTime.getTime() - dueTime.getTime()
        const exceededHours = exceededMs / (1000 * 60 * 60)
        // Immediate-fine policy: any overrun (even 1 second) is billed as
        // the first full hour, and each started hour after that adds
        // another fine. Math.ceil ensures the first penalty applies
        // right away, matching the locker return/extend behavior.
        calculatedPenalty = Math.ceil(exceededHours) * 20
      }
    } else {
      // No due_time, check if exceeded 2 hours free use
      const timeUsedMs = returnTime.getTime() - borrowTime.getTime()
      const hoursUsed = timeUsedMs / (1000 * 60 * 60)

      if (hoursUsed > 2) {
        const exceededHours = hoursUsed - 2
        // Same immediate-fine policy as above.
        calculatedPenalty = Math.ceil(exceededHours) * 20
      }
    }
    
    // Force return applies 2x penalty or minimum 100 pesos
    const forcePenalty = Math.max(calculatedPenalty * 2, 100) as any

    // Update the transaction and locker status
    const updatedTransaction = await prisma.$transaction(async (tx) => {
      // Update the locker transaction. Status must be flipped to 'COMPLETED'
      // here too — otherwise force-returned rentals remain 'ACTIVE' in the
      // database and skew every report that reads the status column.
      const updated = await tx.lockerTransaction.update({
        where: { transaction_id: transactionId },
        data: {
          return_time: returnTime,
          penalty: forcePenalty,
          status: 'COMPLETED'
        },
        include: {
          locker: true,
          user: true
        }
      })

      // Update locker status to AVAILABLE
      await tx.locker.update({
        where: { locker_id: transaction.locker_id },
        data: { status: 'AVAILABLE' }
      })

      // Create OverdueSettlement record for the penalty
      await tx.overdueSettlement.create({
        data: {
          user_id: transaction.user_id,
          transaction_type: 'LOCKER',
          transaction_id: transactionId,
          penalty_amount: forcePenalty,
          amount_paid: 0,
          remaining_balance: forcePenalty,
          status: 'PENDING'
        }
      })

      return updated
    })

    // Log the audit activity
    const currentUserAccount = await prisma.userAccount.findUnique({
      where: { username: session.user.username },
      include: { user: true }
    })

    if (currentUserAccount?.user) {
      await AuditService.logAction(
        currentUserAccount.id,
        currentUserAccount.role as UserRole,
        'LOCKER_FORCE_RETURN',
        `FORCE RETURNED locker: Locker ${transaction.locker.locker_number} forcibly returned from ${transaction.user.full_name} (${transaction.user.email}) - Penalty: ₱${forcePenalty}`
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Locker force return processed successfully',
      transaction: updatedTransaction,
      penalty_applied: true,
      penalty_amount: forcePenalty
    })

  } catch (error) {
    console.error('Error processing locker force return:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
