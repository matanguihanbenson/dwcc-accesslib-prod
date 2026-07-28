import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/public/authors/[name]
//
// Public endpoint: returns every book (non-archived) that
// credits the given name as either a primary author (in
// book_author) or a contributor (in book_contributor).
//
// Path param:
//   name — URL-encoded full name, e.g. "stephen%20king"
//
// Response:
//   {
//     success: true,
//     name: "Stephen King",
//     roles: ["author"],   // union of roles across all hits
//     works: [
//       { book_id, title, isbn, copies_total, copies_available,
//         year_published, material_type,
//         contribution_role, contribution_dates, via }
//     ]
//   }

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const resolvedParams = await params
    const slug = decodeURIComponent(resolvedParams.name || "").trim()
    if (!slug) {
      return NextResponse.json({ error: "Missing name" }, { status: 400 })
    }

    // Match the canonical "name" string the way we stored
    // it. The search is case-insensitive so that
    // "Stephen King" and "stephen king" collapse to one
    // record, and we return the original spelling from the
    // most-recent row.
    const normalized = slug.replace(/\s+/g, " ")

    // 1) Find author rows — case-insensitive match via
    //    Prisma's `mode: 'insensitive'` (uses LOWER() in
    //    the generated SQL, avoids collation mismatches).
    const authorRows = await prisma.bookAuthor.findMany({
      where: { name: normalized },
      select: { name: true },
      take: 1
    })

    // 2) Find contributor rows — same approach.
    const contributorRows = await prisma.bookContributor.findMany({
      where: { name: normalized },
      select: { name: true },
      take: 1
    })

    if (authorRows.length === 0 && contributorRows.length === 0) {
      return NextResponse.json(
        { error: "No works found for this author" },
        { status: 404 }
      )
    }

    // Canonical name: prefer the author-table spelling,
    // fall back to contributor, then the raw slug.
    const canonicalName =
      authorRows[0]?.name ||
      contributorRows[0]?.name ||
      slug

    const roles: string[] = []
    if (authorRows.length > 0) roles.push("author")
    if (contributorRows.length > 0) roles.push("contributor")

    // 3) Pull books via author relation
    const authorBooks = await prisma.bookAuthor.findMany({
      where: { name: normalized },
      select: {
        dates: true,
        book: {
          select: {
            book_id: true,
            title: true,
            isbn: true,
            copies_total: true,
            copies_available: true,
            year_published: true,
            material_type: true,
            archived_at: true
          }
        }
      }
    })

    // 4) Pull books via contributor relation
    const contributorBooks = await prisma.bookContributor.findMany({
      where: { name: normalized },
      select: {
        role: true,
        dates: true,
        book: {
          select: {
            book_id: true,
            title: true,
            isbn: true,
            copies_total: true,
            copies_available: true,
            year_published: true,
            material_type: true,
            archived_at: true
          }
        }
      }
    })

    // Dedupe by book_id, preferring contributor rows
    // because they carry a role (translator / editor / etc.)
    // while the author row is always role = "Author".
    const seen = new Set<number>()
    const works: Array<{
      book_id: number
      title: string
      isbn: string | null
      copies_total: number
      copies_available: number
      year_published: number | null
      material_type: string | null
      contribution_role: string | null
      contribution_dates: string | null
      via: "author" | "contributor"
    }> = []

    // First pass: contributor rows
    for (const row of contributorBooks) {
      const { archived_at, ...b } = row.book
      if (archived_at) continue
      if (seen.has(b.book_id)) continue
      seen.add(b.book_id)
      works.push({
        ...b,
        copies_total: Number(b.copies_total),
        copies_available: Number(b.copies_available),
        contribution_role: row.role,
        contribution_dates: row.dates,
        via: "contributor"
      })
    }

    // Second pass: author rows for any book not already seen
    for (const row of authorBooks) {
      const { archived_at, ...b } = row.book
      if (archived_at) continue
      if (seen.has(b.book_id)) continue
      seen.add(b.book_id)
      works.push({
        ...b,
        copies_total: Number(b.copies_total),
        copies_available: Number(b.copies_available),
        contribution_role: null,
        contribution_dates: row.dates,
        via: "author"
      })
    }

    // Sort newest-first by year_published, then book_id
    works.sort((a, b) => {
      const ya = a.year_published ?? 0
      const yb = b.year_published ?? 0
      if (yb !== ya) return yb - ya
      return b.book_id - a.book_id
    })

    return NextResponse.json({
      success: true,
      name: canonicalName,
      roles,
      works
    })
  } catch (error) {
    console.error("Public author works error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
