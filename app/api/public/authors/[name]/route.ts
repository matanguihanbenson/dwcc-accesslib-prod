import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/public/authors/[name]
//
// Public endpoint: returns every book (non-archived) that
// credits the given name as either a primary author (in
// book_author) or a contributor (in book_contributor).
//
// Path param:
//   name — URL-encoded full name, e.g. "stephen-king"
//
// Response:
//   {
//     name: "Stephen King",
//     roles: ["author"],   // union of roles across all hits
//     works: [
//       { id, title, isbn, copies_total, copies_available,
//         publication_year, material_type, year_published,
//         contribution_role, contribution_dates }
//     ]
//   }
//
// The result is sorted newest-first by `publication_year`,
// falling back to `created_at`. Used by the
// `/authors/[name]` public page.
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

    // 1) Find the canonical name + the union of roles
    //    across both tables. Pull the "best" display name
    //    by ordering the most recent hit first.
    const canonicalRows = await prisma.$queryRaw<
      Array<{ canonical_name: string; role: string }>
    >`
      SELECT MAX(name) AS canonical_name, 'author' AS role
      FROM book_author
      WHERE LOWER(TRIM(name)) = LOWER(${normalized})
      UNION
      SELECT MAX(name) AS canonical_name, 'contributor' AS role
      FROM book_contributor
      WHERE LOWER(TRIM(name)) = LOWER(${normalized})
    `

    if (canonicalRows.length === 0) {
      return NextResponse.json(
        { error: "No works found for this author" },
        { status: 404 }
      )
    }

    const canonicalName =
      canonicalRows.find((r) => r.canonical_name)?.canonical_name ||
      slug
    const roles = Array.from(
      new Set(canonicalRows.map((r) => r.role))
    )

    // 2) Pull the books. We UNION the two tables, dedupe
    //    by book_id, and keep the strongest contribution
    //    metadata we have (contributor role wins because
    //    it's usually more specific than "Author").
    //
    // Note: `book_author` has no `role` column — only
    // `book_contributor` does. The author branch hard-codes
    // `contribution_role` to NULL (the public page renders
    // it as "Author" via the roleLabel fallback) and uses
    // `ba.dates` directly.
    const workRows = await prisma.$queryRaw<
      Array<{
        book_id: number
        title: string
        isbn: string | null
        copies_total: number
        copies_available: number
        publication_year: number | null
        year_published: number | null
        material_type: string | null
        contribution_role: string | null
        contribution_dates: string | null
        via: string
      }>
    >`
      SELECT
        b.book_id,
        b.title,
        b.isbn,
        b.copies_total,
        b.copies_available,
        b.publication_date AS publication_year,
        b.year_published,
        b.material_type,
        CAST(NULL AS CHAR) AS contribution_role,
        ba.dates AS contribution_dates,
        'author' AS via
      FROM book_author ba
      JOIN book b ON b.book_id = ba.book_id
      WHERE LOWER(TRIM(ba.name)) = LOWER(${normalized})
        AND b.archived_at IS NULL

      UNION

      SELECT
        b.book_id,
        b.title,
        b.isbn,
        b.copies_total,
        b.copies_available,
        b.publication_date AS publication_year,
        b.year_published,
        b.material_type,
        bc.role AS contribution_role,
        bc.dates AS contribution_dates,
        'contributor' AS via
      FROM book_contributor bc
      JOIN book b ON b.book_id = bc.book_id
      WHERE LOWER(TRIM(bc.name)) = LOWER(${normalized})
        AND b.archived_at IS NULL

      ORDER BY
        COALESCE(year_published, 0) DESC,
        COALESCE(publication_year, 0) DESC,
        book_id DESC
    `

    // Dedupe by book_id, preferring the contributor row
    // because it carries a role (translator / editor / etc.)
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
      via: 'author' | 'contributor'
    }> = []

    // First pass: collect contributor rows
    for (const row of workRows.filter((r) => r.via === "contributor")) {
      if (seen.has(row.book_id)) continue
      seen.add(row.book_id)
      works.push({
        book_id: row.book_id,
        title: row.title,
        isbn: row.isbn,
        copies_total: Number(row.copies_total),
        copies_available: Number(row.copies_available),
        year_published: row.year_published,
        material_type: row.material_type,
        contribution_role: row.contribution_role,
        contribution_dates: row.contribution_dates,
        via: "contributor"
      })
    }
    // Second pass: author rows for any book not already seen
    for (const row of workRows.filter((r) => r.via === "author")) {
      if (seen.has(row.book_id)) continue
      seen.add(row.book_id)
      works.push({
        book_id: row.book_id,
        title: row.title,
        isbn: row.isbn,
        copies_total: Number(row.copies_total),
        copies_available: Number(row.copies_available),
        year_published: row.year_published,
        material_type: row.material_type,
        contribution_role: row.contribution_role,
        contribution_dates: row.contribution_dates,
        via: "author"
      })
    }

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
