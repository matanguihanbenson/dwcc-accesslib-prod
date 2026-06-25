import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Public endpoint: returns the list of non-archived copies
// for a book. Intentionally unauthenticated so the public
// book view page can show "View copies" without forcing
// the visitor to sign in.
//
// Returns only safe, public-safe fields per copy:
//   - copy_id, accession_number, barcode (optional)
//   - status, condition, location
//   - acquisition_date, notes
//
// Sensitive fields like rfid_code and audit data are
// stripped before responding.
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

    const copies = await prisma.bookCopy.findMany({
      where: { book_id: bookId, archived_at: null },
      select: {
        copy_id: true,
        accession_number: true,
        barcode: true,
        status: true,
        condition: true,
        location: true,
        acquisition_date: true,
        notes: true
      },
      orderBy: { accession_number: "asc" }
    })

    return NextResponse.json({ success: true, data: copies })
  } catch (error) {
    console.error("Public book copies error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
