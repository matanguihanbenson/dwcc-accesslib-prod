import { NextRequest } from 'next/server'
import { UserRole, UserType, CreateBookData, MaterialType } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse, getSearchParams, withValidation } from '@/lib/api-utils'
import { bookService } from '@/lib/services/book.service'
import { validateCreateBook } from '@/lib/validations'
import { withDuplicatePreventionByBody, withDatabaseDuplicateCheck } from '@/lib/duplicate-prevention'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(
  async (req: NextRequest, session) => {
    const filters = getSearchParams(req)
    // Cast userType to correct enum type  
    const typedFilters = {
      ...filters,
      userType: filters.userType as UserType | undefined
    }
    const result = await bookService.getBooks(typedFilters)
    
    if (!result.success) {
      const status = mapCodeToStatus(result.code)
      return createErrorResponse(result.error || 'Failed to fetch books', status, result.code)
    }
    
    return createSuccessResponse(result.data)
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF, UserRole.USER]
)

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

function mapCodeToStatus(code?: string) {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 400
    case 'DUPLICATE_ENTRY':
      return 409
    case 'NOT_FOUND':
      return 404
    case 'FORBIDDEN':
      return 403
    default:
      return 500
  }
}

function transformCreateBookPayload(input: any): CreateBookData {
  const copies_total = input.copies_total != null
    ? Number(input.copies_total)
    : (input.copies ? parseInt(String(input.copies), 10) : 1)

  const year_published = input.year_published != null
    ? Number(input.year_published)
    : (input.publication_year ? parseInt(String(input.publication_year).replace(/[^\d]/g, ''), 10) : undefined)

  let authors = Array.isArray(input.authors) && input.authors.length > 0
    ? input.authors
    : (() => {
        const main = (input.book_author?.toString().trim() || input.authorName?.toString().trim() || '')
        const arr: any[] = []
        if (main) arr.push({ name: main, dates: input.authorDates || undefined, display_order: 1 })
        return arr.length ? arr : undefined
      })()

  // If still no primary author, use first co-author as fallback primary author
  if ((!authors || authors.length === 0) && Array.isArray(input.coAuthors)) {
    const first = input.coAuthors.find((c: any) => c?.name && String(c.name).trim())
    if (first) {
      authors = [{ name: String(first.name).trim(), dates: first.dates, display_order: 1 }]
    }
  }

  const contributors = Array.isArray(input.contributors) && input.contributors.length > 0
    ? input.contributors
    : (Array.isArray(input.coAuthors) && input.coAuthors.length > 0
        ? input.coAuthors.map((c: any, i: number) => ({
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
    : (Array.isArray(input.digitalContent) && input.digitalContent.length > 0
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

  return {
    title: input.title,
    subtitle: input.subtitle || undefined,
    uniform_title: input.uniform_title || input.uniformTitle || undefined,
    varying_form: input.varying_form || input.varyingForm || undefined,

    isbn: input.isbn || undefined,
    issn: input.issn || undefined,
    lccn: input.lccn || undefined,

    material_type: normalizeMaterialType(input.material_type || input.materialType) || undefined,
    subtype: input.subtype || undefined,

    series_title: input.series_title || input.seriesTitle || undefined,
    volume_number: input.volume_number || input.volumeNumber || undefined,

    interest_level: input.interest_level || input.interestLevel || undefined,
    lexile_code: input.lexile_code || input.lexile || undefined,
    fountas_pinnell: input.fountas_pinnell || input.fountasPinnell || undefined,

    publisher: input.publisher || undefined,
    publication_place: input.publication_place || input.publicationPlace || undefined,
    publication_date: input.publication_date || undefined,
    year_published,
    edition: input.edition || undefined,

    pages: input.pages != null ? Number(input.pages) : undefined,
    extent: input.extent || undefined,
    size: input.size || undefined,
    other_details: input.other_details || input.otherDetails || undefined,

    description: input.description || undefined,
    summary: input.summary || undefined,
    notes,
    language: input.language || undefined,

    category_id: Number(input.category_id),
    section_id: input.section_id ? Number(input.section_id) : undefined,
    location: input.location || undefined,
    copies_total,

    // related entities
    authors,
    contributors,
    alternate_titles,
    links: input.links || undefined,
    digital_content,
  }
}

export const POST = withAuth(
  withDuplicatePreventionByBody(
    async (req: NextRequest, session: any) => {
      try {
        // Parse once, then transform and validate the transformed payload
        const raw = await req.json()
        const transformed = transformCreateBookPayload(raw)

        const validation = validateCreateBook({
          // Feed validator the fields it expects
          title: transformed.title,
          book_author: raw.book_author || transformed.book_author || (transformed.authors?.[0]?.name ?? ''),
          category_id: transformed.category_id,
          isbn: transformed.isbn,
          year_published: transformed.year_published,
          copies_total: transformed.copies_total,
        } as any)

        if (!validation.isValid) {
          return createErrorResponse(validation.errors.join(', '), 400, 'VALIDATION_ERROR')
        }

        // Additional database-level duplicate check for ISBN
        if (transformed.isbn) {
          const existingBook = await prisma.book.findFirst({ where: { isbn: transformed.isbn } })
          if (existingBook) {
            return createErrorResponse('A book with this ISBN already exists', 409, 'DUPLICATE_ENTRY')
          }
        }

        const result = await bookService.createBook(
          transformed,
          parseInt(session.user.id),
          session.user.role as UserRole
        )

        if (!result.success) {
          const status = mapCodeToStatus(result.code)
          return createErrorResponse(result.error || 'Failed to create book', status, result.code)
        }

        return createSuccessResponse(result.data, result.message, 201)
      } catch (error) {
        console.error('POST /api/books error:', error)
        return createErrorResponse('Internal server error', 500, 'INTERNAL_ERROR')
      }
    },
    {
      ttl: 10000, // 10 seconds prevention window for book creation
      keyFields: ['title', 'book_author', 'isbn'] // Key fields for duplicate detection
    }
  ),
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
