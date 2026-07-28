import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { interpolateShelflist, generateBaseWorkmark, generateFinalWorkmark, normalizeTitle } from '@/lib/cutter'
import { generateSpelledTitle } from '@/lib/spelled-title'
import { UserRole } from '@/types'

/**
 * POST /api/cutter
 *
 * Generates a Cutter number and work marks for an author within
 * a given classification, interpolating against existing shelflist.
 *
 * Body: { name: string, classification_id: number, title?: string, book_id?: number }
 *
 * Returns: { cutter_number, decimal_value, base_workmark, final_workmark, full_cutter }
 */
export const POST = withAuth(
  async (req: NextRequest, session, context) => {
    try {
      const body = await req.json()
      const { name, classification_id, section_id, title, book_id } = body

      if (!name || !classification_id) {
        return createErrorResponse('name and classification_id are required', 400)
      }

      // Get all classification IDs (this node + descendants)
      const classificationIds = await getDescendantIds(Number(classification_id))

      // Find all authors in books under this classification
      const whereClause: any = {
        book: {
          classification_id: { in: classificationIds },
          archived_at: null,
        }
      }
      if (book_id) {
        whereClause.book.book_id = { not: Number(book_id) }
      }

      const existingAuthors = await prisma.bookAuthor.findMany({
        where: whereClause,
        select: {
          name: true,
          cutter_number: true,
          final_workmark: true,
          book: {
            select: {
              title: true,
              classification_id: true,
              section_id: true
            }
          }
        },
        orderBy: { name: 'asc' }
      })

      // Build shelflist entries for the SAME classification
      const sameClassEntries = existingAuthors
        .filter((a) => a.book.classification_id === Number(classification_id) && a.cutter_number)
        .map((a) => {
          const parts = a.name.trim().split(/\s+/)
          const surname = (parts.pop() || a.name).replace(/[^A-Za-z]/g, '').toLowerCase()
          return {
            surname,
            fullName: a.name.trim(),
            cutter: a.cutter_number!,
          }
        })
        .sort((a, b) => a.surname.localeCompare(b.surname))

      // Check if this is a new edition of an existing work by the same author.
      // If so, reuse the existing cutter + workmark (editions share the same
      // call number stem — only the year differs).
      const existingSameAuthor = existingAuthors.filter(
        (a) =>
          a.name === name &&
          a.book.classification_id === Number(classification_id) &&
          (section_id ? a.book.section_id === Number(section_id) : true) &&
          a.cutter_number
      )

      const normalizedNew = normalizeTitle(title || '')
      const matchedEdition = existingSameAuthor.find((a) => {
        const normalizedExisting = normalizeTitle(a.book.title || '')
        return normalizedExisting && normalizedNew && normalizedExisting === normalizedNew
      })

      let cutter: string
      let finalWm: string
      let baseWm: string

      if (matchedEdition) {
        // Same work (different edition) — reuse everything, only year changes
        cutter = matchedEdition.cutter_number!
        finalWm = matchedEdition.final_workmark || ''
        baseWm = ''
      } else {
        // Different work — interpolate cutter and generate unique workmark
        cutter = interpolateShelflist(name.trim(), sameClassEntries)

        const spelledTitle = title ? generateSpelledTitle(title) : ''
        const workmarkTitle = spelledTitle || title || ''
        baseWm = workmarkTitle ? generateBaseWorkmark(workmarkTitle) : ''

        if (baseWm) {
          const existingMarks = existingSameAuthor
            .map((a) => a.final_workmark)
            .filter((m): m is string => !!m)

          finalWm = generateFinalWorkmark(baseWm, workmarkTitle, existingMarks)
        } else {
          finalWm = ''
        }
      }

      return createSuccessResponse({
        cutter_number: cutter,
        decimal_value: parseFloat(
          ('0.' + cutter.slice(1).padEnd(3, '0').slice(0, 3))
        ),
        base_workmark: baseWm,
        final_workmark: finalWm,
        full_cutter: cutter + finalWm
      })
    } catch (error) {
      console.error('Error generating cutter number:', error)
      return createErrorResponse('Failed to generate cutter number', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)

async function getDescendantIds(id: number): Promise<number[]> {
  const classification = await prisma.bookClassification.findUnique({
    where: { id },
    include: { children: true }
  })

  if (!classification) return [id]

  const ids = [id]
  if (classification.children && classification.children.length > 0) {
    for (const child of classification.children) {
      const childIds = await getDescendantIds(child.id)
      ids.push(...childIds)
    }
  }
  return ids
}
