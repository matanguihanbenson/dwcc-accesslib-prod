import { NextRequest, NextResponse } from 'next/server'
import {
  withAuth,
  createSuccessResponse
} from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/types'

/**
 * GET /api/book-classifications/[id]/books
 *
 * Returns every book whose `classification_id` is the
 * classification node OR any descendant of it. This is
 * what the cataloging-setup "View Books" button calls.
 * A click on a Main Class lists every book under every
 * Division → Section → Decimal Subdivision → Deeper
 * Subdivision beneath it; a click on a deeper level
 * narrows the result to its own subtree.
 *
 * Implementation: a recursive CTE that materialises
 * the descendant id set, then a regular join on
 * `book.classification_id`. Done in a single round-trip
 * to keep the cataloging UI snappy even on a deep tree.
 */
export const GET = withAuth(
  async (
    req: NextRequest,
    _session,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const resolvedParams = await params
    const rootId = parseInt(resolvedParams.id)
    if (!Number.isFinite(rootId) || rootId <= 0) {
      return NextResponse.json({ error: 'Invalid classification id' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 1000)
    const offset = parseInt(searchParams.get('offset') || '0') || 0
    const search = (searchParams.get('search') || '').trim()

    // Recursive CTE: start from the node, walk down to
    // every descendant via parent_id, then join book on
    // classification_id IN that set.
    //
    // MySQL 8 supports recursive CTEs natively; the
    // raw SQL is parameterised so Prisma's parameter
    // binding escapes the id safely.
    const ids: { id: number }[] = await prisma.$queryRaw`
      WITH RECURSIVE subtree (id) AS (
        SELECT id FROM book_classification WHERE id = ${rootId}
        UNION ALL
        SELECT bc.id
        FROM book_classification bc
        INNER JOIN subtree s ON bc.parent_id = s.id
      )
      SELECT id FROM subtree
    `

    if (ids.length === 0) {
      return createSuccessResponse({ books: [], total: 0 })
    }
    const idList = ids.map((r) => r.id)

    const where: any = {
      classification_id: { in: idList },
      archived_at: null
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { isbn: { contains: search } },
        { publisher: { contains: search } }
      ]
    }

    const [books, total] = await Promise.all([
      prisma.book.findMany({
        where,
        include: {
          category: { select: { category_id: true, name: true } },
          section: { select: { section_id: true, name: true } },
          classification: { select: { id: true, code: true, name: true, level: true } }
        },
        orderBy: { title: 'asc' },
        take: limit,
        skip: offset
      }),
      prisma.book.count({ where })
    ])

    return createSuccessResponse({ books, total })
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
