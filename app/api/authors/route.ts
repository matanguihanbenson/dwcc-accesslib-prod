import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/types'

/**
 * GET /api/authors
 *
 * Returns a deduplicated list of all authors and co-authors across the system.
 * People who appear in both book_author and book_contributor are merged into
 * a single entry with multiple roles.
 *
 * Query params:
 *   ?search=NAME    — filter by name (case-insensitive contains)
 *   ?role=ROLE      — filter by role (Author, Contributor, Editor, etc.)
 *   ?category=NAME  — filter by category name
 */
export const GET = withAuth(
  async (req: NextRequest, session) => {
    try {
      const { searchParams } = new URL(req.url)
      const search = searchParams.get('search')?.trim() || ''
      const roleFilter = searchParams.get('role')?.trim() || ''
      const categoryFilter = searchParams.get('category')?.trim() || ''

      // Fetch all book authors
      const bookAuthors = await prisma.bookAuthor.findMany({
        where: search ? { name: { contains: search } } : undefined,
        select: {
          name: true,
          dates: true,
          cutter_number: true,
          decimal_value: true,
          book: {
            select: {
              book_id: true,
              title: true,
              classification_id: true,
              category: { select: { name: true } },
              classification: { select: { code: true, name: true } },
            }
          }
        },
        orderBy: { name: 'asc' }
      })

      // Fetch all book contributors
      const bookContributors = await prisma.bookContributor.findMany({
        where: search ? { name: { contains: search } } : undefined,
        select: {
          name: true,
          role: true,
          dates: true,
          cutter_number: true,
          decimal_value: true,
          book: {
            select: {
              book_id: true,
              title: true,
              classification_id: true,
              category: { select: { name: true } },
              classification: { select: { code: true, name: true } },
            }
          }
        },
        orderBy: { name: 'asc' }
      })

      // Merge into a deduplicated map keyed by normalized name
      const personMap = new Map<string, {
        name: string
        dates: string | null
        roles: string[]
        books: Array<{ book_id: number; title: string; role: string; category?: { name: string }; classification?: { code: string; name?: string } }>
        cutter_numbers: string[]
      }>()

      for (const a of bookAuthors) {
        const key = a.name.trim().toLowerCase()
        const existing = personMap.get(key)
        if (existing) {
          if (!existing.roles.includes('Author')) existing.roles.push('Author')
          if (a.dates && !existing.dates) existing.dates = a.dates
          if (a.cutter_number && !existing.cutter_numbers.includes(a.cutter_number)) {
            existing.cutter_numbers.push(a.cutter_number)
          }
          if (!existing.books.some((b) => b.book_id === a.book.book_id)) {
            existing.books.push({
              book_id: a.book.book_id,
              title: a.book.title,
              role: 'Author',
              category: a.book.category || undefined,
              classification: a.book.classification || undefined,
            })
          }
        } else {
          personMap.set(key, {
            name: a.name.trim(),
            dates: a.dates,
            roles: ['Author'],
            books: [{
              book_id: a.book.book_id,
              title: a.book.title,
              role: 'Author',
              category: a.book.category || undefined,
              classification: a.book.classification || undefined,
            }],
            cutter_numbers: a.cutter_number ? [a.cutter_number] : []
          })
        }
      }

      for (const c of bookContributors) {
        const key = c.name.trim().toLowerCase()
        const existing = personMap.get(key)
        const roleLabel = c.role || 'Contributor'
        if (existing) {
          if (!existing.roles.includes(roleLabel)) existing.roles.push(roleLabel)
          if (c.dates && !existing.dates) existing.dates = c.dates
          if (c.cutter_number && !existing.cutter_numbers.includes(c.cutter_number)) {
            existing.cutter_numbers.push(c.cutter_number)
          }
          if (!existing.books.some((b) => b.book_id === c.book.book_id)) {
            existing.books.push({
              book_id: c.book.book_id,
              title: c.book.title,
              role: roleLabel,
              category: c.book.category || undefined,
              classification: c.book.classification || undefined,
            })
          }
        } else {
          personMap.set(key, {
            name: c.name.trim(),
            dates: c.dates,
            roles: [roleLabel],
            books: [{
              book_id: c.book.book_id,
              title: c.book.title,
              role: roleLabel,
              category: c.book.category || undefined,
              classification: c.book.classification || undefined,
            }],
            cutter_numbers: c.cutter_number ? [c.cutter_number] : []
          })
        }
      }

      // Convert to sorted array
      let people = Array.from(personMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      )

      // Apply post-merge filters
      if (roleFilter) {
        people = people.filter((p) =>
          p.roles.some((r) => r.toLowerCase() === roleFilter.toLowerCase())
        )
      }
      if (categoryFilter) {
        people = people.filter((p) =>
          p.books.some((b) => b.category?.name?.toLowerCase() === categoryFilter.toLowerCase())
        )
      }

      return createSuccessResponse({
        people,
        total: people.length,
        categories: Array.from(new Set(
          people.flatMap((p) => p.books.map((b) => b.category?.name).filter(Boolean))
        )).sort() as string[],
        roles: Array.from(new Set(
          people.flatMap((p) => p.roles)
        )).sort() as string[],
      })
    } catch (error) {
      console.error('Error fetching authors:', error)
      return createErrorResponse('Failed to fetch authors', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
