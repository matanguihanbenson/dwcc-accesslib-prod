import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Always re-run this handler on every request so newly
// added books show up immediately on the public /browse
// page (otherwise the route could be cached by the CDN /
// Next.js data cache and the catalogue would look stale).
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") || ""
  const category = searchParams.get("category") || ""
  const section = searchParams.get("section") || ""
  const materialType = searchParams.get("materialType") || ""
  const language = searchParams.get("language") || ""
  const yearFrom = searchParams.get("yearFrom") || ""
  const yearTo = searchParams.get("yearTo") || ""
  const availableOnly = searchParams.get("availableOnly") === "true"
  const sortBy = searchParams.get("sortBy") || "title" // title, year_desc, year_asc, recent
  const limit = parseInt(searchParams.get("limit") || "10", 10)
  const page = parseInt(searchParams.get("page") || "1", 10)

  try {
    // Build where conditions - show books that are available or have copies available
    const whereConditions: any = {
      AND: [
        { archived_at: null } // Exclude archived books
      ]
    }

    // Availability filter
    if (availableOnly) {
      whereConditions.AND.push({
        AND: [
          { copies_available: { gt: 0 } },
          { status: 'AVAILABLE' }
        ]
      })
    }

    // Category filter (by category name)
    if (category) {
      whereConditions.AND.push({
        category: {
          name: {
            contains: category
          }
        }
      })
    }

    // Section filter
    if (section) {
      whereConditions.AND.push({
        section: {
          name: {
            contains: section
          }
        }
      })
    }

    // Material Type filter
    if (materialType) {
      whereConditions.AND.push({
        material_type: materialType
      })
    }

    // Language filter
    if (language) {
      whereConditions.AND.push({
        language: {
          contains: language
        }
      })
    }

    // Year range filter
    if (yearFrom || yearTo) {
      const yearFilter: any = {}
      if (yearFrom) yearFilter.gte = parseInt(yearFrom)
      if (yearTo) yearFilter.lte = parseInt(yearTo)
      whereConditions.AND.push({
        year_published: yearFilter
      })
    }

    // Search functionality (search in title, authors, category, publisher, isbn)
    if (search) {
      whereConditions.AND.push({
        OR: [
          {
            title: {
              contains: search
            }
          },
          {
            subtitle: {
              contains: search
            }
          },
          {
            authors: {
              some: {
                name: {
                  contains: search
                }
              }
            }
          },
          {
            category: {
              name: {
                contains: search
              }
            }
          },
          {
            publisher: {
              contains: search
            }
          },
          {
            isbn: {
              contains: search
            }
          }
        ]
      })
    }

    // Calculate skip for pagination
    const skip = (page - 1) * limit

    // Determine sort order
    let orderBy: any = { title: 'asc' }
    switch (sortBy) {
      case 'year_desc':
        orderBy = { year_published: 'desc' }
        break
      case 'year_asc':
        orderBy = { year_published: 'asc' }
        break
      case 'recent':
        orderBy = { created_at: 'desc' }
        break
      default:
        orderBy = { title: 'asc' }
    }

    console.log('Public books query conditions:', JSON.stringify(whereConditions, null, 2))

    // Fetch available books from the book table
    const booksRaw = await prisma.book.findMany({
      where: whereConditions,
      select: {
        book_id: true,
        title: true,
        subtitle: true,
        status: true,
        isbn: true,
        publisher: true,
        year_published: true,
        copies_available: true,
        copies_total: true,
        description: true,
        summary: true,
        notes: true,
        material_type: true,
        location: true,
        language: true,
        authors: {
          select: {
            name: true
          },
          orderBy: {
            display_order: 'asc'
          }
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
      orderBy: orderBy,
      skip: skip,
      take: limit
    })

    // Map to expected format
    const books = booksRaw.map(book => {
      // Fall back to the first Summary-type note if the
      // dedicated `summary` column is empty. This way
      // books added before the summary-column sync still
      // surface a description on the public /browse page.
      let summary = book.summary || ''
      if (!summary) summary = extractSummaryFromNotes(book.notes)
      return {
        book_id: book.book_id,
        title: book.title,
        subtitle: book.subtitle,
        book_author: book.authors.map(a => a.name).join(', ') || 'Unknown Author',
        authors: book.authors.map(a => a.name),
        category: book.category?.name || 'Uncategorized',
        section: book.section?.name,
        status: book.copies_available === 0 ? 'UNAVAILABLE' : book.status,
        isbn: book.isbn,
        publisher: book.publisher,
        year_published: book.year_published,
        copies_available: book.copies_available,
        copies_total: book.copies_total,
        description: book.description,
        summary,
        material_type: book.material_type,
        location: book.location,
        language: book.language
      }
    })

    // Get total count for pagination
    const totalCount = await prisma.book.count({
      where: whereConditions
    })

    // Get available categories for filtering
    const categoriesData = await prisma.bookCategory.findMany({
      where: {
        books: {
          some: {
            archived_at: null
          }
        }
      },
      select: {
        name: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Get available sections for filtering
    const sectionsData = await prisma.bookSection.findMany({
      where: {
        is_active: true,
        books: {
          some: {
            archived_at: null
          }
        }
      },
      select: {
        name: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Get available material types
    const materialTypesData = await prisma.book.findMany({
      where: {
        archived_at: null
      },
      select: {
        material_type: true
      },
      distinct: ['material_type']
    })

    // Get available languages
    const languagesData = await prisma.book.findMany({
      where: {
        archived_at: null,
        language: {
          not: null
        }
      },
      select: {
        language: true
      },
      distinct: ['language']
    })

    // Get year range
    const yearRange = await prisma.book.aggregate({
      where: {
        archived_at: null,
        year_published: {
          not: null
        }
      },
      _min: {
        year_published: true
      },
      _max: {
        year_published: true
      }
    })

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit)
    const hasMore = page < totalPages

    

    return NextResponse.json({
      success: true,
      books: books,
      categories: categoriesData.map(c => c.name),
      sections: sectionsData.map(s => s.name),
      materialTypes: materialTypesData.map(m => m.material_type),
      languages: languagesData.map(l => l.language).filter(Boolean),
      yearRange: {
        min: yearRange._min.year_published || new Date().getFullYear() - 100,
        max: yearRange._max.year_published || new Date().getFullYear()
      },
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore
      }
    }, {
      // Bypass the Next.js data cache + CDN so newly added
      // books are visible to the public catalogue on the
      // very next request.
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Public books API error:', error)
    return NextResponse.json(
      { 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// Look through the `notes` JSON column (an array of
// `{ type, content }` entries) for the first note whose
// type is "Summary" and return its content. Used as a
// fallback when the dedicated `summary` column is empty.
function extractSummaryFromNotes(notesJson: any): string {
  if (!notesJson) return ''
  let parsed: any
  if (typeof notesJson === 'string') {
    try {
      parsed = JSON.parse(notesJson)
    } catch {
      return ''
    }
  } else if (Array.isArray(notesJson)) {
    parsed = notesJson
  } else {
    return ''
  }
  if (!Array.isArray(parsed)) return ''
  const summaryNote = parsed.find(
    (n: any) => n && n.type === 'Summary' && typeof n.content === 'string' && n.content.trim()
  )
  return summaryNote ? summaryNote.content.trim() : ''
}
