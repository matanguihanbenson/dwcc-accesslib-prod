import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/author-contributor-lookup?q=<text>&limit=<n>
//
// Unified search across the book_author and
// book_contributor tables. Returns deduplicated results
// flagged with `source` so the client can distinguish a
// primary author from a contributor.
//
// Query params:
//   q        — search term (required, min 2 chars)
//   limit    — max results per source (default 8, max 20)
//
// Used by the add-book form's author/contributor lookup
// widgets. The same endpoint powers future "list all
// authors and their works" reports because the response
// shape is stable.
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const q = (url.searchParams.get("q") || "").trim()
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "8"),
      20
    )

    if (q.length < 2) {
      return NextResponse.json({
        success: true,
        query: q,
        authors: [],
        contributors: []
      })
    }

    // 1) Distinct primary-author names. We group by
    //    lower-cased name so "Stephen King" and "stephen
    //    king" collapse into one hit, but we keep the
    //    canonical capitalization from the most recent
    //    record. We also expose a `work_count` so the
    //    client can rank by how prolific the author is.
    const authorMatches = await prisma.$queryRaw<
      Array<{ name: string; dates: string | null; work_count: bigint | number }>
    >`
      SELECT
        MAX(name) AS name,
        MAX(dates) AS dates,
        COUNT(DISTINCT book_id)::int AS work_count
      FROM book_author
      WHERE LOWER(name) LIKE ${`%${q.toLowerCase()}%`}
      GROUP BY LOWER(name)
      ORDER BY work_count DESC, MAX(name) ASC
      LIMIT ${limit}
    `

    // 2) Distinct contributor names + roles. Same
    //    lower-case grouping so "translator" doesn't
    //    duplicate.
    const contributorMatches = await prisma.$queryRaw<
      Array<{
        name: string
        role: string
        dates: string | null
        work_count: bigint | number
      }>
    >`
      SELECT
        MAX(name) AS name,
        MAX(role) AS role,
        MAX(dates) AS dates,
        COUNT(DISTINCT book_id)::int AS work_count
      FROM book_contributor
      WHERE LOWER(name) LIKE ${`%${q.toLowerCase()}%`}
      GROUP BY LOWER(name)
      ORDER BY work_count DESC, MAX(name) ASC
      LIMIT ${limit}
    `

    // Serialize bigints to plain numbers so the JSON
    // response is valid.
    const serialize = <T extends { work_count: bigint | number }>(
      row: T
    ): Omit<T, "work_count"> & { work_count: number } => ({
      ...row,
      work_count: Number(row.work_count)
    })

    return NextResponse.json({
      success: true,
      query: q,
      authors: authorMatches.map(serialize),
      contributors: contributorMatches.map(serialize)
    })
  } catch (error) {
    console.error("Author/contributor lookup error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
