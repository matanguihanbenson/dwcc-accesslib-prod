import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AuditService } from "@/lib/services/audit.service"
import { UserRole } from "@/types"
import BookStatusManager from "@/lib/book-status-manager"
import { withDuplicatePreventionByBody } from "@/lib/duplicate-prevention"

export const PATCH = withDuplicatePreventionByBody(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ transaction_id: string }> }
  ) => {
  try {
    // Check authentication and authorization
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only ADMIN and SUPER_ADMIN can approve transactions
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const resolvedParams = await params
    const transactionId = parseInt(resolvedParams.transaction_id)

    // Get the transaction with optimized query (select only needed fields)
    const transaction = await prisma.bookTransaction.findUnique({
      where: { transaction_id: transactionId },
      select: {
        transaction_id: true,
        status: true,
        borrow_date: true,
        return_date: true,
        due_date: true,
        book_id: true,
        copy_id: true,
        user_id: true,
        book: {
          select: {
            book_id: true,
            title: true,
            status: true,
            copies_available: true
          }
        },
        user: {
          select: {
            user_id: true,
            full_name: true,
            account_id: true
          }
        }
      }
    })

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    console.log('Transaction found:', {
      id: transaction.transaction_id,
      status: transaction.status,
      borrow_date: transaction.borrow_date,
      return_date: transaction.return_date,
      due_date: transaction.due_date
    })

    // Check if this transaction is already processed
    if (transaction.return_date) {
      return NextResponse.json({ 
        error: "Transaction has already been returned" 
      }, { status: 400 })
    }

    // Check if transaction is in correct status for approval
    if (transaction.status !== 'PENDING_APPROVAL') {
      return NextResponse.json({ 
        error: `Transaction cannot be approved. Current status: ${transaction.status}` 
      }, { status: 400 })
    }

    // For borrow requests, check if book is available and has copies
    if (!transaction.borrow_date) {
      const availability = await BookStatusManager.isBookAvailableForBorrowing(transaction.book_id)
      
      if (!availability.available) {
        return NextResponse.json({ 
          error: `Book is not available for borrowing. ${availability.reason}` 
        }, { status: 400 })
      }
    }

    let updatedTransaction
    let auditDescription = ""

    // Get the user_id from the current user account (optimized query)
    const currentUserAccount = await prisma.userAccount.findUnique({
      where: { username: session.user.username },
      select: {
        id: true,
        role: true,
        user: {
          select: {
            user_id: true
          }
        }
      }
    })

    // Determine if this is a borrow or return request
    if (transaction.status === 'PENDING_APPROVAL' && !transaction.borrow_date) {
      // This is a borrow request
      // Get grace period from system settings
      const gracePeriodSetting = await prisma.systemConfig.findUnique({
        where: { key: 'grace_period_days' }
      })
      const gracePeriodDays = gracePeriodSetting ? parseInt(gracePeriodSetting.value) || 3 : 3
      
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + gracePeriodDays)

      updatedTransaction = await prisma.$transaction(async (tx) => {
        // Update the borrowing transaction
        const updated = await tx.bookTransaction.update({
          where: { transaction_id: transactionId },
          data: {
            borrow_date: new Date(),
            due_date: transaction.due_date || dueDate,
            status: 'ACTIVE',
            approved_by: currentUserAccount?.user.user_id
          },
          include: {
            book: true,
            user: true
          }
        })

        // Update the specific book copy status to BORROWED
        if (transaction.copy_id) {
          await tx.bookCopy.update({
            where: { copy_id: transaction.copy_id },
            data: { status: 'BORROWED' }
          })
        }

        // Update book status and decrement available copies using status manager
        await BookStatusManager.updateBookStatusAfterBorrow(transaction.book_id, tx)

        return updated
      })

      auditDescription = `Approved borrow request: "${transaction.book.title}" for user ${transaction.user?.full_name || 'Unknown'} (${transaction.user?.account_id || 'N/A'})`

    } else {
      // This is a return request
      updatedTransaction = await prisma.$transaction(async (tx) => {
        // Update the borrowing transaction
        const updated = await tx.bookTransaction.update({
          where: { transaction_id: transactionId },
          data: {
            return_date: new Date(),
            status: 'COMPLETED',
            returned_by: currentUserAccount?.user.user_id
          },
          include: {
            book: true,
            user: true
          }
        })

        // Update the specific book copy status back to AVAILABLE
        if (transaction.copy_id) {
          await tx.bookCopy.update({
            where: { copy_id: transaction.copy_id },
            data: { status: 'AVAILABLE' }
          })
        }

        // Update book status and increment available copies using status manager
        await BookStatusManager.updateBookStatusAfterReturn(transaction.book_id, tx)

        return updated
      })

      auditDescription = `Approved return request: "${transaction.book.title}" from user ${transaction.user?.full_name || 'Unknown'} (${transaction.user?.account_id || 'N/A'})`
    }

    // Log the transaction update for debugging
    console.log('Transaction approved successfully:', {
      transactionId: updatedTransaction.transaction_id,
      previousStatus: transaction.status,
      newStatus: updatedTransaction.status,
      borrowDate: updatedTransaction.borrow_date,
      returnDate: updatedTransaction.return_date,
      userId: updatedTransaction.user_id,
      bookId: updatedTransaction.book_id
    })

    // Clear relevant caches after successful transaction
    try {
      const { cache } = await import('@/lib/cache')
      // Clear all cache to ensure fresh data
      cache.clear()
      
      // Also log successful cache clear
      console.log('Cache cleared after transaction approval')
    } catch (cacheError) {
      console.warn('Cache clearing failed:', cacheError)
    }

    // Log the audit activity asynchronously for better performance
    if (currentUserAccount?.user) {
      // Don't await this to improve response time
      AuditService.logAction(
        currentUserAccount.id,
        currentUserAccount.role as UserRole,
        transaction.return_date === null ? 'BOOK_APPROVAL' : 'BOOK_RETURN',
        auditDescription
      ).catch(error => {
        console.error('Failed to log audit action:', error)
      })
    }

    return NextResponse.json({
      success: true,
      message: "Transaction approved successfully",
      transaction: updatedTransaction
    })

  } catch (error) {
    console.error("Error approving transaction:", error)
    
    // Return more specific error information
    const errorMessage = error instanceof Error ? error.message : "Internal server error"
    
    return NextResponse.json(
      { 
        error: "Failed to approve transaction", 
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      },
      { status: 500 }
    )
  }
},
{
  ttl: 10000, // 10 seconds prevention window for transaction approval
  keyFields: [] // Use full request body for duplicate detection
}
)
