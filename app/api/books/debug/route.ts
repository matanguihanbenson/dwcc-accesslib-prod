import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    console.log('Debug: Starting to fetch books...')
    
    // Test direct database connection
    const bookCount = await prisma.book.count()
    console.log(`Debug: Total books in database: ${bookCount}`)
    
    // Fetch all books without any conditions
    const books = await prisma.book.findMany({
      take: 10, // Limit to 10 for debugging
      orderBy: {
        book_id: 'desc' // Get latest books first
      }
    })
    
    console.log(`Debug: Found ${books.length} books`)
    console.log('Debug: Sample book data:', books[0])
    
    return NextResponse.json({
      success: true,
      debug: true,
      totalCount: bookCount,
      books: books,
      message: `Found ${books.length} books out of ${bookCount} total`
    })

  } catch (error) {
    console.error("Debug: Error fetching books:", error)
    return NextResponse.json(
      { 
        error: "Database error", 
        details: error instanceof Error ? error.message : 'Unknown error',
        debug: true 
      },
      { status: 500 }
    )
  }
}
