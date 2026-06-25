import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { bookHref } from "@/lib/utils"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")?.trim() || ""
    const limit = parseInt(searchParams.get("limit") || "8", 10)

    // Return empty results if query is too short
    if (query.length < 2) {
      return NextResponse.json({ suggestions: [] })
    }

    // Search for books by title and author - show available books or those with copies
    const booksRaw = await prisma.book.findMany({
      where: {
        AND: [
          {
            OR: [
              { status: 'AVAILABLE' },
              { copies_available: { gt: 0 } }
            ]
          },
          { archived_at: null },
          {
            OR: [
              {
                title: {
                  contains: query
                }
              },
              {
                authors: {
                  some: {
                    name: {
                      contains: query
                    }
                  }
                }
              }
            ]
          }
        ]
      },
      select: {
        book_id: true,
        title: true,
        location: true,
        authors: {
          select: {
            name: true
          },
          orderBy: {
            display_order: 'asc'
          },
          take: 1
        },
        category: {
          select: {
            name: true
          }
        },
        section: {
          select: {
            name: true
          }
        }
      },
      orderBy: [
        {
          title: 'asc'
        }
      ],
      take: limit
    })

    // Format suggestions for autocomplete dropdown
    const suggestions = booksRaw.map(book => ({
      id: book.book_id,
      title: book.title,
      author: book.authors[0]?.name || 'Unknown Author',
      category: book.category?.name || 'Uncategorized',
      section: book.section?.name,
      location: book.location,
      url: bookHref(book)
    }))

    return NextResponse.json({ suggestions })

  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
