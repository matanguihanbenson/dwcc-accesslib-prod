import { NextRequest, NextResponse } from 'next/server'
import { withAuth, createSuccessResponse, createErrorResponse, validateId } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/types'
import { AuditService } from '@/lib/services/audit.service'

// PATCH /api/locker-transactions/[transaction_id]/extend - Extend locker time
export const PATCH = withAuth(
  async (req: NextRequest, session: any, { params }: { params: Promise<{ transaction_id: string }> }) => {
    try {
      const resolvedParams = await params
      const transactionId = validateId(resolvedParams.transaction_id, 'Transaction ID')
      const body = await req.json()
      const { hours = 2 } = body // Default 2 hours extension

      // Find transaction
      const transaction = await prisma.lockerTransaction.findUnique({
        where: { transaction_id: transactionId },
        include: {
          locker: true,
          user: {
            select: {
              full_name: true,
              account_id: true
            }
          }
        }
      })

      if (!transaction) {
        return createErrorResponse('Transaction not found', 404)
      }

      if (transaction.return_time) {
        return createErrorResponse('Locker has already been returned', 400)
      }

      // Get fine, grace period, and extension settings
      const fineSettings = await prisma.systemConfig.findMany({
        where: {
          key: { in: ['locker_fine_per_hour', 'max_locker_fine', 'grace_period_hours', 'grace_period_minutes', 'max_locker_extensions'] }
        }
      })
      
      const lockerFinePerHour = parseFloat(fineSettings.find(s => s.key === 'locker_fine_per_hour')?.value || '20')
      const maxLockerFine = parseFloat(fineSettings.find(s => s.key === 'max_locker_fine')?.value || '500')
      const gracePeriodHours = parseInt(fineSettings.find(s => s.key === 'grace_period_hours')?.value || '2')
      const gracePeriodMinutes = parseInt(fineSettings.find(s => s.key === 'grace_period_minutes')?.value || '15')
      const maxLockerExtensions = parseInt(fineSettings.find(s => s.key === 'max_locker_extensions')?.value || '1')

      // Enforce per-transaction extension limit
      if (transaction.extension_count >= maxLockerExtensions) {
        return createErrorResponse(`Maximum of ${maxLockerExtensions} extension(s) reached for this locker transaction`, 400)
      }

      // Extend due time
      const borrowTime = new Date(transaction.borrow_time)
      const existingDueTime = transaction.due_time ? new Date(transaction.due_time) : null
      const gracePeriodMs = (gracePeriodHours * 60 * 60 * 1000) + (gracePeriodMinutes * 60 * 1000)

      // If no due_time exists yet, base it on borrow_time + grace period
      const currentDueTime = existingDueTime || new Date(borrowTime.getTime() + gracePeriodMs)
      const newDueTime = new Date(currentDueTime.getTime() + hours * 60 * 60 * 1000)

      const now = new Date()

      // Determine if we are still within the 15-minute grace window AFTER due_time
      // If there is an explicit due_time, grace window starts from there.
      // If not, implicit due_time is borrow_time + grace period.
      const effectiveDueTime = existingDueTime || new Date(borrowTime.getTime() + gracePeriodMs)
      const fineStartTime = new Date(effectiveDueTime.getTime() + gracePeriodMinutes * 60 * 1000)
      const withinGraceWindow = now <= fineStartTime

      // Calculate up-to-now penalty (without changing transaction yet)
      let recalculatedPenalty = 0
      if (!withinGraceWindow) {
        if (existingDueTime) {
          // Use same logic as return: fines start after due_time + grace minutes
          if (now > fineStartTime) {
            const exceededMs = now.getTime() - fineStartTime.getTime()
            const exceededHours = exceededMs / (1000 * 60 * 60)
            // Immediate-fine policy: any overrun (even 1 second) is billed
            // as the first full hour, and each started hour after that
            // adds another fine. Math.ceil matches the return/force-return
            // behavior so the extend penalty stays consistent.
            recalculatedPenalty = Math.min(
              Math.ceil(exceededHours) * lockerFinePerHour,
              maxLockerFine
            )
          }
        } else {
          // No explicit due_time yet, so fines start after borrow_time + grace period + grace minutes
          const implicitDueTime = new Date(borrowTime.getTime() + gracePeriodMs)
          const implicitFineStart = new Date(implicitDueTime.getTime() + gracePeriodMinutes * 60 * 1000)
          if (now > implicitFineStart) {
            const exceededMs = now.getTime() - implicitFineStart.getTime()
            const exceededHours = exceededMs / (1000 * 60 * 60)
            // Same immediate-fine policy as above.
            recalculatedPenalty = Math.min(
              Math.ceil(exceededHours) * lockerFinePerHour,
              maxLockerFine
            )
          }
        }
      }

      // Use transaction to update both locker_transaction and (optionally) settlements
      const updated = await prisma.$transaction(async (tx) => {
        // Decide final penalty value:
        // - If within grace window, allow reset to 0
        // - Otherwise, never reduce penalty: keep the max of existing and recalculated
        const newPenalty = withinGraceWindow
          ? 0
          : Math.max(Number(transaction.penalty || 0), recalculatedPenalty)

        // Update the locker transaction with new due time
        const updatedTransaction = await tx.lockerTransaction.update({
          where: { transaction_id: transactionId },
          data: {
            due_time: newDueTime,
            penalty: newPenalty,
            extension_count: {
              increment: 1
            }
          },
          include: {
            locker: true,
            user: {
              select: {
                full_name: true,
                account_id: true
              }
            }
          }
        })

        // Delete any pending overdue settlements only if penalty is fully reset
        if (withinGraceWindow) {
          await tx.overdueSettlement.deleteMany({
            where: {
              transaction_type: 'LOCKER',
              transaction_id: transactionId,
              status: { in: ['PENDING', 'PARTIAL'] }
            }
          })
        }

        return updatedTransaction
      })

      // Log the action
      await AuditService.logAction(
        parseInt(session.user.id),
        session.user.role as UserRole,
        'EXTEND_LOCKER',
        `Extended locker ${transaction.locker.locker_number} for ${transaction.user.full_name} by ${hours} hours`
      )

      return createSuccessResponse(
        updated,
        `Locker time extended by ${hours} hour(s). New due time: ${newDueTime.toLocaleString()}`
      )
    } catch (error) {
      console.error('Error extending locker time:', error)
      return createErrorResponse('Failed to extend locker time', 500)
    }
  },
  [UserRole.ADMIN, UserRole.STAFF, UserRole.SUPER_ADMIN]
)

