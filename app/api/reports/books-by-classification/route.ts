import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/types'

/**
 * GET /api/reports/books-by-classification
 *
 * Returns all books under a given classification (and its
 * descendants) together with author names, edition info,
 * and per-copy accession numbers.
 *
 * Query params:
 *   - `classification_id` (required) : the root classification to report on
 *
 * Restricted to ADMIN and SUPER_ADMIN.
 */

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const role = token.role as string
    if (role !== UserRole.SUPER_ADMIN && role !== UserRole.ADMIN && role !== UserRole.STAFF) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const classificationId = parseInt(searchParams.get('classification_id') || '')
    if (!classificationId) {
      return NextResponse.json(
        { error: 'classification_id is required' },
        { status: 400 }
      )
    }

    // Sort param: "title", "call_number", "author", "year", "edition"
    // Optional suffix ":desc" for descending (default ascending).
    const sortParam = searchParams.get('sort') || 'call_number'
    const sortDesc = sortParam.endsWith(':desc')
    const sortField = sortParam.replace(':desc', '') as string

    // 1. Fetch the classification node and its name
    const classification = await prisma.bookClassification.findUnique({
      where: { id: classificationId }
    })
    if (!classification) {
      return NextResponse.json(
        { error: 'Classification not found' },
        { status: 404 }
      )
    }

    // 2. Collect all descendant classification IDs
    const classificationIds = await getDescendantIds(classificationId)

    // Optional category filter
    const categoryParam = searchParams.get('category') || ''

    // 3. Fetch all books under these classifications with their
    //    authors, copies, and classification info
    const bookWhere: any = {
      classification_id: { in: classificationIds },
      archived_at: null
    }
    if (categoryParam) {
      bookWhere.category = { name: categoryParam }
    }

    const books = await prisma.book.findMany({
      where: bookWhere,
      include: {
        authors: {
          orderBy: { display_order: 'asc' }
        },
        book_copies: {
          where: { archived_at: null },
          orderBy: { accession_number: 'asc' }
        },
        classification: true,
        section: true
      },
      orderBy: [
        { classification: { code: 'asc' } },
        { title: 'asc' }
      ]
    })

    // 4. Shape the response for the PDF generator
    const rows = books.map((book) => {
      // First copy's call number (without c.N suffix)
      const baseCallNumber = book.call_number || ''

      // All accession numbers, comma-separated
      const accessionNumbers = book.book_copies
        .map((c: any) => c.accession_number)
        .join('; ')

      // Primary author name
      const primaryAuthor = book.authors.length > 0
        ? book.authors[0].name
        : ''

      // Co-authors / contributors as string
      const coAuthors = book.authors.length > 1
        ? book.authors.slice(1).map((a: any) => a.name).join(', ')
        : ''

      // Classification code + section code for display
      const sectionCode = book.section?.code || ''
      const classCode = book.classification?.code || ''

      return {
        call_number: baseCallNumber,
        accession_numbers: accessionNumbers,
        title: book.title,
        author: coAuthors ? `${book.authors[0]?.name || ''} (${coAuthors})` : (book.authors[0]?.name || ''),
        edition: book.edition || '',
        year_published: book.year_published?.toString() || '',
        no_titles: '1',
        no_volumes: book.book_copies.length.toString(),
        section_code: sectionCode,
        classification_code: classCode
      }
    })

    // 5. Sort the rows
    const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })
    rows.sort((a, b) => {
      const av = (a as any)[sortField] ?? ''
      const bv = (b as any)[sortField] ?? ''
      const cmp = collator.compare(String(av), String(bv))
      return sortDesc ? -cmp : cmp
    })

    return NextResponse.json({
      classification: {
        id: classification.id,
        code: classification.code,
        name: classification.name
      },
      books: rows,
      total: rows.length
    })
  } catch (error) {
    console.error('Error generating books-by-classification report:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Recursively collect the IDs of a classification node and
 * all its descendants.
 */
async function getDescendantIds(id: number): Promise<number[]> {
  const node = await prisma.bookClassification.findUnique({
    where: { id },
    include: { children: true }
  })
  if (!node) return [id]
  const ids = [id]
  for (const child of node.children) {
    ids.push(...(await getDescendantIds(child.id)))
  }
  return ids
}
