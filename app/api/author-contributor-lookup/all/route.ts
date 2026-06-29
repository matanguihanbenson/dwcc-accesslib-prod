import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/author-contributor-lookup/all
//
// Returns every distinct primary-author name with the
// number of distinct books they authored. Used by future
// "list all authors and their works" reports. Staff-only
// (called from the dashboard / reports area).
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500)

    const authorRows = await prisma.$queryRaw<
      Array<{ name: string; dates: string | null; work_count: bigint | number }>
    >`
      SELECT
        MAX(name) AS name,
        MAX(dates) AS dates,
        COUNT(DISTINCT book_id)::int AS work_count
      FROM book_author
      GROUP BY LOWER(name)
      ORDER BY work_count DESC, MAX(name) ASC
      LIMIT ${limit}
    `

    return NextResponse.json({
      success: true,
      authors: authorRows.map((r) => ({
        ...r,
        work_count: Number(r.work_count)
      }))
    })
  } catch (error) {
    console.error("Author list error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
