import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

// GET archived copies for a book
export const GET = withAuth(
  async (req: NextRequest, session, context) => {
    try {
      const { book_id } = await context.params
      const bookId = parseInt(book_id)

      if (isNaN(bookId)) {
        return createErrorResponse('Invalid book ID', 400)
      }

      const archivedCopies = await prisma.bookCopy.findMany({
        where: {
          book_id: bookId,
          archived_at: {
            not: null
          }
        },
        orderBy: {
          archived_at: 'desc'
        }
      })

      return createSuccessResponse(archivedCopies)
    } catch (error) {
      console.error('Error fetching archived copies:', error)
      return createErrorResponse('Failed to fetch archived copies', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
