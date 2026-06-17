import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

// DELETE - Permanently delete a copy (hard delete) - SUPER_ADMIN only
export const DELETE = withAuth(
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
        return createErrorResponse('Copy must be archived before permanent deletion', 400)
      }

      // Permanently delete the copy
      await prisma.bookCopy.delete({
        where: { copy_id: copyIdNum }
      })

      return createSuccessResponse(null, 'Copy permanently deleted')
    } catch (error) {
      console.error('Error permanently deleting copy:', error)
      return createErrorResponse('Failed to permanently delete copy', 500)
    }
  },
  [UserRole.SUPER_ADMIN] // Only SUPER_ADMIN can permanently delete
)
