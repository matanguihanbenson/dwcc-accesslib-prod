import { NextRequest } from 'next/server'
import { UserRole, UserType, NotificationType } from '@/types'
import { withAuth, createSuccessResponse, getSearchParams, createErrorResponse, getUserIdFromSession } from '@/lib/api-utils'
import { bookService } from '@/lib/services/book.service'
import { prisma } from '@/lib/prisma'
import { NotificationService } from '@/lib/services/notification.service'
import BookStatusManager from '@/lib/book-status-manager'
import { withDuplicatePreventionByBody, withDatabaseDuplicateCheck } from '@/lib/duplicate-prevention'

export const GET = withAuth(
  async (req: NextRequest, session) => {
    const filters = getSearchParams(req)
    const typedFilters = {
      ...filters,
      userType: filters.userType as UserType | undefined,
      query: (filters as any).search || (filters as any).query
    }
    
    // Handle user_id filtering for individual user transaction history
    if (filters.user_id) {
      const userId = parseInt(filters.user_id as string)
      if (!isNaN(userId)) {
        // Custom query for specific user transactions
        const result = await bookService.getUserBookTransactions(userId, typedFilters)
        if (!result.success) {
          throw new Error(result.error)
        }
        return createSuccessResponse(result.data)
      }
    }
    
    // Map optional status query used by UI (PENDING) to underlying filter if needed
    const result = await bookService.getBookTransactions(typedFilters)
    
    if (!result.success) {
      throw new Error(result.error)
    }
    
    return createSuccessResponse(result.data)
  },
  [UserRole.ADMIN, UserRole.STAFF]
)

export const POST = withAuth(
  withDuplicatePreventionByBody(
    async (req: NextRequest, session: any) => {
      try {
        const body = await req.json()
        const { accession_number, user_id, department_id, office_id, borrower_representative, due_date, condition_on_borrow, notes } = body || {}

        // Validate that at least one borrower type is specified
        if (!user_id && !department_id && !office_id) {
          return createErrorResponse('At least one of user_id, department_id, or office_id is required', 400, 'VALIDATION_ERROR')
        }

        if (!accession_number) {
          return createErrorResponse('Accession number is required', 400, 'VALIDATION_ERROR')
        }

        // Find the book copy by accession number
        const bookCopy = await prisma.bookCopy.findUnique({
          where: { accession_number: accession_number.toUpperCase() },
          include: { book: true }
        })

        if (!bookCopy) {
          return createErrorResponse(`Book copy not found with this accession number`, 404, 'BOOK_COPY_NOT_FOUND')
        }

        // Check if this specific copy is already borrowed
        const existingCopyTransaction = await prisma.bookTransaction.findFirst({
          where: {
            copy_id: bookCopy.copy_id,
            status: {
              in: ['PENDING_APPROVAL', 'ACTIVE']
            }
          }
        })

        if (existingCopyTransaction) {
          return createErrorResponse('This book copy is already borrowed or reserved', 400, 'COPY_ALREADY_BORROWED')
        }

        const book = bookCopy.book

        // Check for existing pending or active transaction for this borrower and this book title
        const existingWhere: any = {
          book_id: book.book_id,
          status: {
            in: ['PENDING_APPROVAL', 'ACTIVE']
          }
        }

        if (user_id) {
          existingWhere.user_id = Number(user_id)
        } else if (department_id) {
          existingWhere.department_id = Number(department_id)
        } else if (office_id) {
          existingWhere.office_id = Number(office_id)
        }

        const existingTransaction = await prisma.bookTransaction.findFirst({
          where: existingWhere
        })

        if (existingTransaction) {
          const borrowerType = user_id ? 'User' : department_id ? 'Department' : 'Office'
          return createErrorResponse(`${borrowerType} already has a pending or active transaction for this book`, 400, 'DUPLICATE_TRANSACTION')
        }

        // Validate borrower exists
        if (user_id) {
          const userExists = await prisma.user.findUnique({
            where: { user_id: Number(user_id) }
          })

          if (!userExists) {
            return createErrorResponse(`User with ID ${user_id} not found`, 404, 'USER_NOT_FOUND')
          }

          if (userExists.status !== 'ACTIVE') {
            return createErrorResponse(`User account is not active (status: ${userExists.status})`, 400, 'USER_INACTIVE')
          }
        } else if (department_id) {
          const departmentExists = await prisma.department.findUnique({
            where: { department_id: Number(department_id) }
          })

          if (!departmentExists) {
            return createErrorResponse(`Department with ID ${department_id} not found`, 404, 'DEPARTMENT_NOT_FOUND')
          }

          if (!departmentExists.is_active) {
            return createErrorResponse(`Department is not active`, 400, 'DEPARTMENT_INACTIVE')
          }
        } else if (office_id) {
          const officeExists = await prisma.office.findUnique({
            where: { office_id: Number(office_id) }
          })

          if (!officeExists) {
            return createErrorResponse(`Office with ID ${office_id} not found`, 404, 'OFFICE_NOT_FOUND')
          }

          if (!officeExists.is_active) {
            return createErrorResponse(`Office is not active`, 400, 'OFFICE_INACTIVE')
          }
        }

        // Check if book copy is available
        if (bookCopy.status !== 'AVAILABLE') {
          return createErrorResponse(`Book copy is ${bookCopy.status.toLowerCase()} and cannot be borrowed`, 400, 'COPY_NOT_AVAILABLE')
        }

        // Check if book is available for borrowing using the status manager
        const availability = await BookStatusManager.isBookAvailableForBorrowing(book.book_id)
        
        if (!availability.available) {
          return createErrorResponse(availability.reason || 'Book is not available for borrowing', 400, 'BOOK_NOT_AVAILABLE')
        }

        // Get the correct user_id from session
        const requestedByUserId = await getUserIdFromSession(session)
        
        if (!requestedByUserId) {
          return createErrorResponse('Unable to identify user from session', 401, 'SESSION_ERROR')
        }

        // Create pending approval transaction
        const transactionData: any = {
          book_id: book.book_id,
          copy_id: bookCopy.copy_id,
          due_date: due_date ? new Date(due_date) : null,
          status: 'PENDING_APPROVAL',
          requested_by: requestedByUserId,
          condition_on_borrow: condition_on_borrow || null,
          notes: notes || null,
        }

        if (user_id) {
          transactionData.user_id = Number(user_id)
        }
        if (department_id) {
          transactionData.department_id = Number(department_id)
        }
        if (office_id) {
          transactionData.office_id = Number(office_id)
        }
        if (borrower_representative) {
          transactionData.borrower_representative = borrower_representative
        }

        const transaction = await prisma.bookTransaction.create({
          data: transactionData,
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
            user: user_id ? {
              select: {
                full_name: true,
                account_id: true
              }
            } : undefined,
            department: department_id ? {
              select: {
                name: true,
                code: true
              }
            } : undefined,
            office: office_id ? {
              select: {
                name: true,
                code: true
              }
            } : undefined
          }
        })

        // Send notifications to ADMIN users only. SUPER_ADMIN
        // oversees the whole system and doesn't approve book
        // borrows, so they are intentionally excluded.
        try {
          const adminUsers = await prisma.userAccount.findMany({
            where: {
              role: 'ADMIN',
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

          if (adminUsers.length > 0) {
            // Determine borrower info for notification
            let borrowerName = ''
            let borrowerIdentifier = ''
            
            if (transaction.user) {
              borrowerName = transaction.user.full_name || 'Unknown'
              borrowerIdentifier = transaction.user.account_id || 'N/A'
            } else if (transaction.department) {
              borrowerName = transaction.department.name
              borrowerIdentifier = transaction.department.code
              if (transaction.borrower_representative) {
                borrowerName += ` (Rep: ${transaction.borrower_representative})`
              }
            } else if (transaction.office) {
              borrowerName = transaction.office.name
              borrowerIdentifier = transaction.office.code
              if (transaction.borrower_representative) {
                borrowerName += ` (Rep: ${transaction.borrower_representative})`
              }
            }

            const notifications = adminUsers.map(admin => ({
              user_id: admin.user.user_id,
              type: NotificationType.PENDING_APPROVAL,
              title: 'New Borrow Request',
              message: `${borrowerName} (${borrowerIdentifier}) has requested to borrow "${transaction.book.title}"${transaction.book.authors && transaction.book.authors.length > 0 ? ` by ${transaction.book.authors[0].name}` : ''}. Click to review and approve.`,
              metadata: {
                transactionId: transaction.transaction_id,
                bookTitle: transaction.book.title,
                borrowerName: borrowerName,
                borrowerIdentifier: borrowerIdentifier,
                redirectUrl: '/books?tab=pending'
              }
            }))

            const result = await NotificationService.createBulkNotifications(notifications)
            console.log('Admin notifications result:', result)
          } else {
            console.log('No admin users found to notify')
          }
        } catch (notifError) {
          // Log notification error but don't fail the transaction
          console.error('Failed to send admin notifications:', notifError)
        }

        return createSuccessResponse(transaction, 'Borrow request created')
      } catch (error: any) {
        return createErrorResponse(error?.message || 'Failed to create borrow request', 500, 'INTERNAL_ERROR')
      }
    },
    {
      ttl: 15000, // 15 seconds prevention window for borrowing
      keyFields: ['accession_number', 'user_id', 'department_id', 'office_id'] // Key fields for duplicate detection
    }
  ),
  [UserRole.STAFF]
)
