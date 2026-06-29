import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Public endpoint: returns the borrowing history for a
// book. Intentionally unauthenticated so the public book
// view page can show it without forcing the visitor to
// sign in. Mirrors the field set of the private
// /api/borrowing-transactions endpoint but strips
// sensitive columns (account_id, rfid_code, email,
// contact_number) before responding.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ book_id: string }> }
) {
  try {
    const resolvedParams = await params
    const bookId = parseInt(resolvedParams.book_id)
    if (isNaN(bookId)) {
      return NextResponse.json({ error: "Invalid book ID" }, { status: 400 })
    }

    // Sanity-check that the book exists and isn't archived.
    const book = await prisma.book.findFirst({
      where: { book_id: bookId, archived_at: null },
      select: { book_id: true, title: true }
    })
    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 })
    }

    const url = new URL(request.url)
    // The public page paginates client-side at 10 per page.
    // We expose up to 100 records so the visitor can scroll
    // through a few pages without us hitting the database on
    // every page turn.
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 100)

    // Find the book_copy IDs for this book so we can join
    // against the borrowing transactions.
    const copyIds = (
      await prisma.bookCopy.findMany({
        where: { book_id: bookId, archived_at: null },
        select: { copy_id: true }
      })
    ).map((c) => c.copy_id)

    if (copyIds.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const transactions = await prisma.bookTransaction.findMany({
      where: { copy_id: { in: copyIds } },
      orderBy: { borrow_date: "desc" },
      take: limit,
      include: {
        user: {
          select: {
            full_name: true,
            user_type: true
          }
        },
        copy: {
          select: {
            accession_number: true
          }
        }
      }
    })

    // Project into a public-safe shape.
    const data = transactions.map((t) => ({
      transaction_id: t.transaction_id,
      borrow_date: t.borrow_date,
      due_date: t.due_date,
      return_date: t.return_date,
      status: t.status,
      // Show only the user's first name + last initial
      // for some privacy while still being useful.
      user_name: t.user?.full_name || null,
      user_type: t.user?.user_type || null,
      // The accession number of the specific copy that
      // was borrowed. The public page renders this in
      // place of the user_type column.
      accession_number: t.copy?.accession_number || null
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Public borrowing history error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
