import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UserRole, UpdateBookData, MaterialType } from '@/types'
import { createSuccessResponse, validateId, withValidation } from '@/lib/api-utils'
import { bookService } from '@/lib/services/book.service'

function normalizeMaterialType(v?: string): MaterialType | undefined {
  if (!v) return undefined
  const map: Record<string, MaterialType> = {
    'book': MaterialType.BOOK,
    'ebook': MaterialType.EBOOK,
    'audiobook': MaterialType.AUDIOBOOK,
    'dvd': MaterialType.DVD,
    'magazine': MaterialType.MAGAZINE,
    'periodical': MaterialType.PERIODICAL,
    'journal': MaterialType.JOURNAL,
    'reference': MaterialType.REFERENCE,
    'thesis': MaterialType.THESIS,
    'cd': MaterialType.CD,
    'other': MaterialType.OTHER,
  }
  const key = v.toString().trim().toLowerCase()
  return map[key] ?? undefined
}

function transformUpdateBookPayload(input: any): UpdateBookData {
  const copies_total = input.copies_total != null
    ? Number(input.copies_total)
    : (input.copies ? parseInt(String(input.copies), 10) : undefined)

  const year_published = input.year_published != null
    ? Number(input.year_published)
    : (input.publication_year ? parseInt(String(input.publication_year).replace(/[^\d]/g, ''), 10) : undefined)

  // Authors: prefer explicit authors array; else derive from primary author/coAuthors
  let authors = Array.isArray(input.authors) && input.authors.length > 0
    ? input.authors
    : (() => {
        const main = (input.book_author?.toString().trim() || input.authorName?.toString().trim() || '')
        const arr: any[] = []
        if (main) arr.push({ name: main, dates: input.authorDates || undefined, display_order: 1 })
        return arr.length ? arr : undefined
      })()

  if ((!authors || authors.length === 0) && Array.isArray(input.coAuthors)) {
    const first = input.coAuthors.find((c: any) => c?.name && String(c.name).trim())
    if (first) {
      authors = [{ name: String(first.name).trim(), dates: first.dates, display_order: 1 }]
    }
  }

  const contributors = Array.isArray(input.contributors) && input.contributors.length > 0
    ? input.contributors
    : (Array.isArray(input.coAuthors)
        ? input.coAuthors
            .filter((c: any) => c?.name && String(c.name).trim())
            .map((c: any, i: number) => ({
              name: c.name,
              role: c.role || 'Contributor',
              dates: c.dates,
              display_order: i + 1,
            }))
        : undefined)

  const alternate_titles = Array.isArray(input.alternate_titles) && input.alternate_titles.length > 0
    ? input.alternate_titles
    : (input.alternateTitle ? [{ title: input.alternateTitle }] : undefined)

  const digital_content = Array.isArray(input.digital_content) && input.digital_content.length > 0
    ? input.digital_content
    : (Array.isArray(input.digitalContent)
        ? input.digitalContent.map((d: any) => ({
            title: d.title,
            url: d.url,
            description: d.description,
            file_type: d.type,
            file_size: d.file_size,
          }))
        : undefined)

  // Normalize notes to string (DB expects TEXT)
  const notes = Array.isArray(input.notes)
    ? JSON.stringify(input.notes)
    : (typeof input.notes === 'string' ? input.notes : undefined)

  // Build clean update object — only include known fields
  const out: UpdateBookData = {
    // Title information
    title: input.title || undefined,
    subtitle: input.subtitle || undefined,
    uniform_title: input.uniform_title || input.uniformTitle || undefined,
    varying_form: input.varying_form || input.varyingForm || undefined,

    // Standard numbers
    isbn: input.isbn || undefined,
    issn: input.issn || undefined,
    lccn: input.lccn || undefined,

    // Material & series
    material_type: normalizeMaterialType(input.material_type || input.materialType) || undefined,
    subtype: input.subtype || undefined,
    series_title: input.series_title || input.seriesTitle || undefined,
    volume_number: input.volume_number || input.volumeNumber || undefined,

    // Reading levels
    interest_level: input.interest_level || input.interestLevel || undefined,
    lexile_code: input.lexile_code || input.lexile || undefined,
    fountas_pinnell: input.fountas_pinnell || input.fountasPinnell || undefined,

    // Publication
    publisher: input.publisher || undefined,
    publication_place: input.publication_place || input.publicationPlace || undefined,
    publication_date: input.publication_date || undefined,
    year_published,
    edition: input.edition || undefined,

    // Physical
    pages: input.pages != null && input.pages !== '' ? Number(input.pages) : undefined,
    extent: input.extent || undefined,
    size: input.size || undefined,
    other_details: input.other_details || input.otherDetails || undefined,

    // Content
    description: input.description || undefined,
    summary: input.summary || undefined,
    notes,
    language: input.language || undefined,

    // Library management
    category_id: input.category_id ? Number(input.category_id) : undefined,
    section_id: input.section_id ? Number(input.section_id) : undefined,
    location: input.location || undefined,
    copies_total,

    // Related entities
    authors,
    contributors,
    alternate_titles,
    links: Array.isArray(input.links) ? input.links : undefined,
    digital_content,

    // Legacy (ignored by prisma but kept for validation compatibility)
    book_author: input.book_author || undefined,
  }

  return out
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ book_id: string }> }) {
  // Public endpoint - no authentication required to view book details
  const resolvedParams = await params
  const bookId = validateId(resolvedParams.book_id, 'Book ID')
  const result = await bookService.getBookById(bookId)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return createSuccessResponse(result.data)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ book_id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = session.user.role as UserRole
  const allowedRoles: UserRole[] = [UserRole.ADMIN, UserRole.STAFF]
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const resolvedParams = await params
  const bookId = validateId(resolvedParams.book_id, 'Book ID')
  const handler = withValidation(
    req,
    () => ({ isValid: true, errors: [] }),
    async (req, data) => {
      const transformed = transformUpdateBookPayload(data)
      const result = await bookService.updateBook(
        bookId,
        transformed,
        parseInt(session.user.id),
        session.user.role as UserRole
      )
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }
      return createSuccessResponse(result.data, result.message)
    }
  )
  return await handler()
}
