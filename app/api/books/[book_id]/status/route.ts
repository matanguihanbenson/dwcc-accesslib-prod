import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AuditService } from "@/lib/services/audit.service"
import { UserRole } from "@/types"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ book_id: string }> }
) {
  try {
    // Check authentication and authorization
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only ADMIN and SUPER_ADMIN can update book status
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const resolvedParams = await params
    const bookId = parseInt(resolvedParams.book_id)
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 })
    }

    // Validate status value (align with schema BookStatus)
    const validStatuses = ["AVAILABLE", "BORROWED", "LOST", "DAMAGED"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ 
        error: "Invalid status value", 
        validStatuses 
      }, { status: 400 })
    }

    // Check if book exists
    const existingBook = await prisma.book.findUnique({
      where: { book_id: bookId }
    })

    if (!existingBook) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 })
    }

    // Update book status
    const updatedBook = await prisma.book.update({
      where: { book_id: bookId },
      data: { status }
    })

    // Log the audit activity
    await AuditService.logAction(
      parseInt(session.user.id),
      session.user.role as UserRole,
      'UPDATE_BOOK_STATUS',
      `Updated book status: "${existingBook.title}" changed from ${existingBook.status} to ${status}`
    )

    return NextResponse.json({
      success: true,
      message: "Book status updated successfully",
      book: updatedBook
    })

  } catch (error) {
    console.error("Error updating book status:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
