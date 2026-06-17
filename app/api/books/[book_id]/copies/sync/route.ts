import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

// POST - Sync book copies_available count with actual BookCopy records
export const POST = withAuth(
  async (req: NextRequest, session, context) => {
    try {
      const { book_id } = await context.params
      const bookId = parseInt(book_id)

      if (isNaN(bookId)) {
        return createErrorResponse('Invalid book ID', 400)
      }

      // Verify book exists
      const book = await prisma.book.findUnique({
        where: { book_id: bookId }
      })

      if (!book) {
        return createErrorResponse('Book not found', 404)
      }

      // Count actual available copies (excluding archived)
      const actualAvailableCount = await prisma.bookCopy.count({
        where: {
          book_id: bookId,
          status: 'AVAILABLE',
          archived_at: null
        }
      })

      // Count total copies (excluding archived)
      const actualTotalCount = await prisma.bookCopy.count({
        where: {
          book_id: bookId,
          archived_at: null
        }
      })

      // Update book record if counts don't match
      const needsUpdate = 
        book.copies_available !== actualAvailableCount || 
        book.copies_total !== actualTotalCount

      if (needsUpdate) {
        await prisma.book.update({
          where: { book_id: bookId },
          data: {
            copies_available: actualAvailableCount,
            copies_total: actualTotalCount
          }
        })

        return createSuccessResponse(
          {
            previous: {
              copies_total: book.copies_total,
              copies_available: book.copies_available
            },
            updated: {
              copies_total: actualTotalCount,
              copies_available: actualAvailableCount
            }
          },
          'Book copy counts synchronized successfully'
        )
      }

      return createSuccessResponse(
        {
          copies_total: actualTotalCount,
          copies_available: actualAvailableCount
        },
        'Book copy counts are already in sync'
      )
    } catch (error) {
      console.error('Error syncing book copies:', error)
      return createErrorResponse('Failed to sync book copies', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
