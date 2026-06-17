import { NextRequest } from 'next/server'
import { UserRole, NotificationType } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { NotificationService } from '@/lib/services/notification.service'

export const POST = withAuth(
  async (req: NextRequest, session) => {
    try {
      const body = await req.json()
      const { transactionId, type, message } = body

      if (!transactionId || !type || !message) {
        return createErrorResponse('transactionId, type, and message are required', 400)
      }

      // Get transaction details
      const transaction = await prisma.bookTransaction.findUnique({
        where: { transaction_id: Number(transactionId) },
        include: {
          book: {
            select: {
              title: true,
              authors: {
                select: { name: true },
                orderBy: { display_order: 'asc' },
                take: 1
              }
            }
          },
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

      // Get all ADMIN and SUPER_ADMIN users
      const adminUsers = await prisma.userAccount.findMany({
        where: {
          role: { in: ['ADMIN', 'SUPER_ADMIN'] },
          is_active: true
        },
        include: {
          user: {
            select: {
              user_id: true
            }
          }
        }
      })

      if (adminUsers.length === 0) {
        return createErrorResponse('No active admin users found', 404)
      }

      // Create notifications for all admins
      const borrowerName = transaction.user?.full_name || 'Unknown'
      const borrowerAccountId = transaction.user?.account_id || 'N/A'

      const notifications = adminUsers.map(admin => ({
        user_id: admin.user.user_id,
        type: NotificationType.PENDING_APPROVAL,
        title: 'Pending Borrow Request',
        message: `${borrowerName} (${borrowerAccountId}) has requested to borrow "${transaction.book.title}"${transaction.book.authors && transaction.book.authors.length > 0 ? ` by ${transaction.book.authors[0].name}` : ''}. Please review and approve.`,
        metadata: {
          transactionId: transaction.transaction_id,
          bookTitle: transaction.book.title,
          borrowerName,
          borrowerAccountId,
          redirectUrl: '/books?tab=pending'
        }
      }))

      const result = await NotificationService.createBulkNotifications(notifications)

      if (!result.success) {
        return createErrorResponse(result.error || 'Failed to create notifications', 500)
      }

      return createSuccessResponse({
        notificationsSent: result.count,
        message: `Notifications sent to ${result.count} admin(s)`
      })

    } catch (error: any) {
      console.error('Error sending admin notifications:', error)
      return createErrorResponse(error?.message || 'Failed to send notifications', 500)
    }
  },
  [UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN]
)
