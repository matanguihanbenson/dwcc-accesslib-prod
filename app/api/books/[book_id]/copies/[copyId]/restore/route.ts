import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

// PATCH - Restore archived copy
export const PATCH = withAuth(
  async (req: NextRequest, session, context) => {
    try {
      const { book_id, copyId } = await context.params
      const bookId = parseInt(book_id)
      const copyIdNum = parseInt(copyId)

      if (isNaN(bookId) || isNaN(copyIdNum)) {
        return createErrorResponse('Invalid book ID or copy ID', 400)
      }

      const copy = await prisma.bookCopy.findUnique({
        where: { copy_id: copyIdNum }
      })

      if (!copy || copy.book_id !== bookId) {
        return createErrorResponse('Copy not found', 404)
      }

      if (!copy.archived_at) {
        return createErrorResponse('Copy is not archived', 400)
      }

      // Restore copy
      await prisma.$transaction(async (tx) => {
        await tx.bookCopy.update({
          where: { copy_id: copyIdNum },
          data: {
            archived_at: null
          }
        })

        // Update book counts
        await tx.book.update({
          where: { book_id: bookId },
          data: {
            copies_total: { increment: 1 },
            ...(copy.status === 'AVAILABLE' && { copies_available: { increment: 1 } })
          }
        })
      })

      return createSuccessResponse(null, 'Copy restored successfully')
    } catch (error) {
      console.error('Error restoring copy:', error)
      return createErrorResponse('Failed to restore copy', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
