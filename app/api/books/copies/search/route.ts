import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/types'

/**
 * GET /api/books/copies/search?q=<text>&limit=<n>&recent=1
 *
 * Lightweight search used by the "Lookup" modal on the borrow
 * page. The user is supposed to scan or type an accession number
 * into the regular Search field, but in practice staff often
 * don't know the accession number and want to find a book by
 * title / author / ISBN. This endpoint returns a flat list of
 * book copies (with book info) matching the query so the staff
 * can pick one and have the form auto-populated.
 *
 * Searches across:
 *   - `BookCopy.accession_number`
 *   - `BookCopy.barcode`
 *   - `Book.title`
 *   - `Book.isbn`
 *   - `Book.authors[].name`
 *   - `Book.publisher`
 *
 * Optimized for realtime use:
 *   - Empty `q` returns `{ results: [] }` so the client never
 *     auto-loads data on first open.
 *   - Queries shorter than `MIN_QUERY_LENGTH` (2 chars) return
 *     `{ results: [] }` so we don't burn DB cycles on single
 *     keystrokes that would match too much.
 *   - `?recent=1` returns the most recently catalogued copies
 *     for an opt-in "show recent" toggle in the modal.
 *   - `limit` defaults to 20 (was 30) and is capped at 50 to
 *     keep the payload small for realtime polling.
 *
 * Restricted to STAFF and ADMIN — regular users can't issue
 * borrow transactions.
 */

const MIN_QUERY_LENGTH = 2
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

// Shared include clause so the search & recent lookups return
// the same shape. Selected fields are kept to the minimum the
// modal needs so the payload stays small for realtime polling.
const BOOK_COPY_INCLUDE = {
  book: {
    select: {
      book_id: true,
      title: true,
      isbn: true,
      publisher: true,
      year_published: true,
      status: true,
      category: { select: { name: true } },
      section: { select: { name: true } },
      authors: {
        select: { name: true },
        orderBy: { display_order: 'asc' },
        take: 1
      }
    }
  }
} as const

function shapeResult(c: any) {
  return {
    copy_id: c.copy_id,
    book_id: c.book_id,
    accession_number: c.accession_number,
    barcode: c.barcode,
    condition: c.condition,
    status: c.status,
    location: c.location,
    book: {
      ...c.book,
      book_author:
        c.book.authors && c.book.authors.length > 0
          ? c.book.authors[0].name
          : 'Unknown'
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })

    if (!token?.role) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    if (
      token.role !== UserRole.STAFF &&
      token.role !== UserRole.ADMIN &&
      token.role !== UserRole.SUPER_ADMIN
    ) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const url = new URL(req.url)
    const q = (url.searchParams.get('q') || '').trim()
    const recentFlag = url.searchParams.get('recent') === '1'
    const limitRaw = parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT))
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, MAX_LIMIT)
        : DEFAULT_LIMIT

    // Empty / too-short query: don't run a DB query. The client
    // is expected to render a "start typing" empty state. We
    // still return a 200 with an empty `results` array so the
    // SWR response shape stays consistent and the loading
    // spinner logic doesn't get stuck.
    if (!q && !recentFlag) {
      return NextResponse.json({ query: '', count: 0, results: [] })
    }
    if (q.length < MIN_QUERY_LENGTH && !recentFlag) {
      return NextResponse.json({
        query: q,
        count: 0,
        results: [],
        minLength: MIN_QUERY_LENGTH
      })
    }

    // Opt-in "show recent" mode. Distinct from the search path
    // so an empty search box never triggers this.
    if (recentFlag) {
      const recent = await prisma.bookCopy.findMany({
        where: { archived_at: null },
        orderBy: { created_at: 'desc' },
        take: limit,
        include: BOOK_COPY_INCLUDE
      })
      return NextResponse.json({
        query: '',
        recent: true,
        count: recent.length,
        results: recent.map(shapeResult)
      })
    }

    // Search: two parallel lookups (accession/barcode direct
    // matches + book title/ISBN/publisher/author indirect
    // matches). The direct hits are returned first since
    // they're likely the more specific intent.
    const [byCopy, byBook] = await Promise.all([
      prisma.bookCopy.findMany({
        where: {
          archived_at: null,
          OR: [
            { accession_number: { contains: q } },
            { barcode: { contains: q } }
          ]
        },
        take: limit,
        orderBy: { accession_number: 'asc' },
        include: BOOK_COPY_INCLUDE
      }),
      prisma.bookCopy.findMany({
        where: {
          archived_at: null,
          book: {
            OR: [
              { title: { contains: q } },
              { isbn: { contains: q } },
              { publisher: { contains: q } },
              { authors: { some: { name: { contains: q } } } }
            ]
          }
        },
        take: limit,
        orderBy: { copy_id: 'asc' },
        include: BOOK_COPY_INCLUDE
      })
    ])

    // Merge & de-duplicate by copy_id, preserving the order of
    // direct accession/barcode matches first.
    const seen = new Set<number>()
    const merged: typeof byCopy = []
    for (const row of [...byCopy, ...byBook]) {
      if (seen.has(row.copy_id)) continue
      seen.add(row.copy_id)
      merged.push(row)
      if (merged.length >= limit) break
    }

    return NextResponse.json({
      query: q,
      count: merged.length,
      results: merged.map(shapeResult)
    })
  } catch (error) {
    console.error('Error searching book copies:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
