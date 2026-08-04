import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { interpolateShelflist, generateBaseWorkmark, generateFinalWorkmark, normalizeTitle } from '@/lib/cutter'
import { generateSpelledTitle } from '@/lib/spelled-title'
import { UserRole } from '@/types'

/**
 * POST /api/cutter
 *
 * Generates a Cutter number and workmark for an author within
 * a given classification, interpolating against the existing shelflist.
 *
 * The workmark is scoped by the primary author's cutter_number, not by name.
 *
 * Body: { name: string, classification_id: number, title?: string, book_id?: number }
 *
 * Returns: { cutter_number, decimal_value, workmark, full_cutter }
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

      // ── Query: existing authors for shelflist interpolation ──
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

      // ── Query: existing books for workmark scope ──
      const existingBooks = await prisma.book.findMany({
        where: {
          classification_id: Number(classification_id),
          archived_at: null,
          ...(book_id ? { book_id: { not: Number(book_id) } } : {}),
        },
        select: {
          book_id: true,
          title: true,
          workmark: true,
          section_id: true,
          authors: {
            select: { name: true, cutter_number: true }
          }
        }
      })

      const normalizedNew = normalizeTitle(title || '')

      // ── Step 1: Determine the cutter number ──
      // Edition match uses author name (same person writing different editions)
      const cutterMatchedEdition = existingBooks.find((b: any) =>
        b.authors.some((a: any) => a.name === name && a.cutter_number) &&
        (section_id ? b.section_id === Number(section_id) : true) &&
        normalizeTitle(b.title || '') === normalizedNew &&
        normalizedNew !== ''
      )

      let cutter: string
      if (cutterMatchedEdition) {
        const matchedAuthor = cutterMatchedEdition.authors.find((a: any) => a.name === name)
        cutter = matchedAuthor!.cutter_number!
      } else {
        cutter = interpolateShelflist(name.trim(), sameClassEntries)
      }

      // ── Step 2: Determine the workmark, scoped by cutter_number ──
      // Workmark edition match uses cutter_number (same author block, same title)
      const workmarkMatchedEdition = existingBooks.find((b: any) =>
        b.authors.some((a: any) => a.cutter_number === cutter) &&
        (section_id ? b.section_id === Number(section_id) : true) &&
        normalizeTitle(b.title || '') === normalizedNew &&
        normalizedNew !== ''
      )

      let workmark: string
      if (workmarkMatchedEdition) {
        workmark = workmarkMatchedEdition.workmark || ''
      } else {
        const spelledTitle = title ? generateSpelledTitle(title) : ''
        const workmarkTitle = spelledTitle || title || ''
        const baseWm = workmarkTitle ? generateBaseWorkmark(workmarkTitle) : ''

        if (baseWm) {
          const existingMarks = existingBooks
            .filter((b: any) =>
              b.authors.some((a: any) => a.cutter_number === cutter) &&
              (section_id ? b.section_id === Number(section_id) : true)
            )
            .map((b: any) => b.workmark)
            .filter((m: any): m is string => !!m)

          workmark = generateFinalWorkmark(baseWm, workmarkTitle, existingMarks)
        } else {
          workmark = ''
        }
      }

      return createSuccessResponse({
        cutter_number: cutter,
        decimal_value: parseFloat(
          ('0.' + cutter.slice(1).padEnd(3, '0').slice(0, 3))
        ),
        workmark,
        full_cutter: cutter + workmark
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
