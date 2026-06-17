import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AuditService } from "@/lib/services/audit.service"
import { UserRole } from "@/types"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ book_id: string }> }
) {
  try {
    // Check authentication and authorization
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only ADMIN and SUPER_ADMIN can issue books
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const resolvedParams = await params
    const bookId = parseInt(resolvedParams.book_id)
    const body = await request.json()
    const { user_id, days_to_borrow = 14 } = body

    if (!user_id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Check if book exists and is available
    const book = await prisma.book.findUnique({
      where: { book_id: bookId }
    })

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 })
    }

    if (book.status !== "AVAILABLE") {
      return NextResponse.json({ 
        error: `Book is not available (current status: ${book.status})` 
      }, { status: 400 })
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { user_id: parseInt(user_id) }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json({ 
        error: `User account is not active (current status: ${user.status})` 
      }, { status: 400 })
    }

    const borrowDate = new Date()
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + days_to_borrow)

    // Create transaction and update book status
    const transaction = await prisma.$transaction(async (tx) => {
      // Create book transaction
      const newTransaction = await tx.bookTransaction.create({
        data: {
          book_id: bookId,
          user_id: parseInt(user_id),
          borrow_date: borrowDate,
          due_date: dueDate,
          penalty: 0
        },
        include: {
          book: true,
          user: true
        }
      })

      // Update book status to BORROWED
      await tx.book.update({
        where: { book_id: bookId },
        data: { status: "BORROWED" }
      })

      return newTransaction
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
        'BOOK_ISSUE',
        `Issued book: "${book.title}" to user ${user.full_name} (${user.email}). Due date: ${dueDate.toLocaleDateString()}`
      )
    }

    return NextResponse.json({
      success: true,
      message: "Book issued successfully",
      transaction: transaction
    })

  } catch (error) {
    console.error("Error issuing book:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
