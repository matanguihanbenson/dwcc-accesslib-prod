import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AuditService } from "@/lib/services/audit.service"
import { UserRole } from "@/types"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ transaction_id: string }> }
) {
  try {
    // Check authentication and authorization
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only ADMIN and SUPER_ADMIN can reject transactions
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { transaction_id } = await context.params
    const transactionId = parseInt(transaction_id)
    const body = await request.json().catch(() => ({}))
    const { reason } = body || {}

    // Get the transaction with related data
    const transaction = await prisma.bookTransaction.findUnique({
      where: { transaction_id: transactionId },
      include: {
        book: true,
        user: true
      }
    })

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    // Check if this transaction is already processed
    if (transaction.return_date) {
      return NextResponse.json({ 
        error: "Transaction has already been returned" 
      }, { status: 400 })
    }

    // Mark as rejected and add optional reason in notes
    const updatedTransaction = await prisma.bookTransaction.update({
      where: { transaction_id: transactionId },
      data: {
        status: 'REJECTED',
        notes: reason ? `${transaction.notes ? transaction.notes + ' | ' : ''}Rejected: ${reason}` : transaction.notes
      },
      include: {
        book: true,
        user: true
      }
    })

    // Determine the transaction type for audit log
    const transactionType = transaction.borrow_date ? "return" : "borrow"
    const auditDescription = `Rejected ${transactionType} request: "${transaction.book.title}" for user ${transaction.user?.full_name || 'Unknown'} (${transaction.user?.email || 'N/A'})${reason ? ` - Reason: ${reason}` : ""}`

    // Log the audit activity
    const currentUserAccount = await prisma.userAccount.findUnique({
      where: { username: session.user.username },
      include: { user: true }
    })

    if (currentUserAccount?.user) {
      await AuditService.logAction(
        currentUserAccount.id,
        currentUserAccount.role as UserRole,
        'BOOK_REJECTION',
        auditDescription
      )
    }

    return NextResponse.json({
      success: true,
      message: "Transaction rejected successfully",
      transaction: updatedTransaction
    })

  } catch (error) {
    console.error("Error rejecting transaction:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
