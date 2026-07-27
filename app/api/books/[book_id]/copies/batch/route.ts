import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { generateAccessionNumbers } from '@/lib/accession-number'

/**
 * POST /api/books/[book_id]/copies/batch
 *
 * Create multiple copies for a book at once. The client
 * sends either:
 *   - `mode: 'auto'` + `count` — server generates sequential accession numbers
 *   - `mode: 'manual'` + `accession_numbers: string[]` — client provides each number
 *
 * Also updates the book's copies_total / copies_available
 * and sets the call_number if provided.
 */
export const POST = withAuth(
  async (req: NextRequest, session, context) => {
    try {
      const { book_id } = await context.params
      const bookId = parseInt(book_id)

      if (isNaN(bookId)) {
        return createErrorResponse('Invalid book ID', 400)
      }

      const body = await req.json()
      const { mode, count, accession_numbers, call_number } = body

      // Verify book exists
      const book = await prisma.book.findUnique({
        where: { book_id: bookId }
      })

      if (!book) {
        return createErrorResponse('Book not found', 404)
      }

      let numbers: string[] = []

      if (mode === 'auto') {
        if (!count || count < 1 || count > 100) {
          return createErrorResponse('Count must be between 1 and 100', 400)
        }
        numbers = await generateAccessionNumbers(count)
      } else if (mode === 'manual') {
        if (!Array.isArray(accession_numbers) || accession_numbers.length === 0) {
          return createErrorResponse('accession_numbers array is required', 400)
        }
        if (accession_numbers.length > 100) {
          return createErrorResponse('Maximum 100 copies at once', 400)
        }
        // Check for duplicates within the submitted list
        const seen = new Set<string>()
        for (const num of accession_numbers) {
          const upper = String(num).trim().toUpperCase()
          if (!upper) {
            return createErrorResponse('Accession numbers cannot be empty', 400)
          }
          if (seen.has(upper)) {
            return createErrorResponse(`Duplicate accession number: ${upper}`, 400)
          }
          seen.add(upper)
        }
        // Check for conflicts with existing copies
        const existing = await prisma.bookCopy.findMany({
          where: { accession_number: { in: Array.from(seen) } },
          select: { accession_number: true }
        })
        if (existing.length > 0) {
          const conflicts = existing.map((e) => e.accession_number).join(', ')
          return createErrorResponse(`Accession numbers already in use: ${conflicts}`, 400)
        }
        numbers = accession_numbers.map((n: string) => n.trim().toUpperCase())
      } else {
        return createErrorResponse('Invalid mode. Use "auto" or "manual".', 400)
      }

      // Create copies in a transaction
      const createdCopies = await prisma.$transaction(async (tx) => {
        const copies = await Promise.all(
          numbers.map((accessionNumber) =>
            tx.bookCopy.create({
              data: {
                book_id: bookId,
                accession_number: accessionNumber,
                status: 'AVAILABLE',
                condition: 'GOOD',
                acquisition_date: new Date()
              }
            })
          )
        )

        // Update book counts + optional call_number
        // For brand-new books (total = 0), SET the counts
        // instead of incrementing so we don't end up with
        // copies_total = N+1 after the first batch.
        const updateData: any = {}
        if (call_number !== undefined) {
          updateData.call_number = call_number || null
        }
        if (book.copies_total === 0) {
          updateData.copies_total = numbers.length
          updateData.copies_available = numbers.length
        } else {
          updateData.copies_total = { increment: numbers.length }
          updateData.copies_available = { increment: numbers.length }
        }

        await tx.book.update({
          where: { book_id: bookId },
          data: updateData
        })

        return copies
      })

      return createSuccessResponse(
        { copies: createdCopies, count: createdCopies.length },
        `Created ${createdCopies.length} cop${createdCopies.length > 1 ? 'ies' : 'y'}`
      )
    } catch (error) {
      console.error('Error batch-creating book copies:', error)
      return createErrorResponse('Failed to create book copies', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
