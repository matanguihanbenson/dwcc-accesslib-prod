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

    // Only ADMIN and STAFF can process locker returns
    if (!['ADMIN', 'STAFF', 'SUPER_ADMIN'].includes(session.user.role)) {
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
    
    // Get fine settings from system config
    const fineSettings = await prisma.systemConfig.findMany({
      where: {
        key: { in: ['locker_fine_per_hour', 'max_locker_fine', 'grace_period_hours', 'grace_period_minutes'] }
      }
    })
    
    const lockerFinePerHour = parseFloat(fineSettings.find(s => s.key === 'locker_fine_per_hour')?.value || '20')
    const maxLockerFine = parseFloat(fineSettings.find(s => s.key === 'max_locker_fine')?.value || '500')
    const gracePeriodHours = parseInt(fineSettings.find(s => s.key === 'grace_period_hours')?.value || '2')
    const gracePeriodMinutes = parseInt(fineSettings.find(s => s.key === 'grace_period_minutes')?.value || '15')
    
    // Calculate penalty based on grace period + fine per hour exceeded
    let penalty = transaction.penalty
    const borrowTime = new Date(transaction.borrow_time)
    const dueTime = transaction.due_time ? new Date(transaction.due_time) : null
    
    // Calculate if overdue and penalty amount
    let calculatedPenalty = 0
    
    if (dueTime) {
      // If due_time exists (with extensions), add grace_period_minutes after due_time
      const gracePeriodMs = gracePeriodMinutes * 60 * 1000
      const fineStartTime = new Date(dueTime.getTime() + gracePeriodMs)

      if (returnTime > fineStartTime) {
        const exceededMs = returnTime.getTime() - fineStartTime.getTime()
        const exceededHours = exceededMs / (1000 * 60 * 60)
        // Immediate-fine policy: any overrun past the grace window is billed
        // as the first full hour, and each started hour after that adds
        // another fine. Math.ceil ensures a 1-second overrun still triggers
        // the first penalty right away.
        calculatedPenalty = Math.min(
          Math.ceil(exceededHours) * lockerFinePerHour,
          maxLockerFine
        )
      }
    } else {
      // No due_time, so apply grace_period (hours + minutes) from borrow_time
      const gracePeriodMs = (gracePeriodHours * 60 * 60 * 1000) + (gracePeriodMinutes * 60 * 1000)
      const implicitDueTime = new Date(borrowTime.getTime() + gracePeriodMs)

      if (returnTime > implicitDueTime) {
        const exceededMs = returnTime.getTime() - implicitDueTime.getTime()
        const exceededHours = exceededMs / (1000 * 60 * 60)
        // Same immediate-fine policy as above.
        calculatedPenalty = Math.min(
          Math.ceil(exceededHours) * lockerFinePerHour,
          maxLockerFine
        )
      }
    }
    
    // Use the greater of stored penalty or calculated penalty
    penalty = Math.max(Number(penalty), calculatedPenalty) as any

    // Update the transaction and locker status
    const updatedTransaction = await prisma.$transaction(async (tx) => {
      // Update the locker transaction
      const updated = await tx.lockerTransaction.update({
        where: { transaction_id: transactionId },
        data: {
          return_time: returnTime,
          penalty: penalty
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

      // Create OverdueSettlement record if there's a penalty
      if (Number(penalty) > 0) {
        await tx.overdueSettlement.create({
          data: {
            user_id: transaction.user_id,
            transaction_type: 'LOCKER',
            transaction_id: transactionId,
            penalty_amount: penalty,
            amount_paid: 0,
            remaining_balance: penalty,
            status: 'PENDING'
          }
        })
      }

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
        'LOCKER_RETURN',
        `Processed locker return: Locker ${transaction.locker.locker_number} returned by ${transaction.user.full_name} (${transaction.user.email})${Number(penalty) > 0 ? ` with penalty of ₱${penalty}` : ''}`
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Locker return processed successfully',
      transaction: updatedTransaction,
      penalty_applied: Number(penalty) > Number(transaction.penalty)
    })

  } catch (error) {
    console.error('Error processing locker return:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
