import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

// POST - Bulk update copy status
export const POST = withAuth(
  async (req: NextRequest, session, context) => {
    try {
      const { book_id } = await context.params
      const bookId = parseInt(book_id)

      if (isNaN(bookId)) {
        return createErrorResponse('Invalid book ID', 400)
      }

      const body = await req.json()
      const { copyIds, status } = body

      if (!copyIds || !Array.isArray(copyIds) || copyIds.length === 0) {
        return createErrorResponse('Copy IDs are required', 400)
      }

      if (!status || !['AVAILABLE', 'BORROWED', 'LOST', 'DAMAGED', 'MAINTENANCE'].includes(status)) {
        return createErrorResponse('Invalid status', 400)
      }

      // Fetch all copies to validate
      const copies = await prisma.bookCopy.findMany({
        where: {
          copy_id: { in: copyIds },
          book_id: bookId,
          archived_at: null
        }
      })

      if (copies.length !== copyIds.length) {
        return createErrorResponse('Some copies not found or already archived', 404)
      }

      // Check if any copy is currently borrowed and trying to change status
      const borrowedCopies = copies.filter(c => c.status === 'BORROWED')
      if (borrowedCopies.length > 0 && status !== 'BORROWED') {
        return createErrorResponse(
          `Cannot change status of ${borrowedCopies.length} borrowed cop${borrowedCopies.length > 1 ? 'ies' : 'y'}`,
          400
        )
      }

      // Calculate availability changes
      let availabilityChange = 0
      for (const copy of copies) {
        const wasAvailable = copy.status === 'AVAILABLE'
        const willBeAvailable = status === 'AVAILABLE'

        if (wasAvailable && !willBeAvailable) {
          availabilityChange -= 1
        } else if (!wasAvailable && willBeAvailable) {
          availabilityChange += 1
        }
      }

      // Update all copies in a transaction
      await prisma.$transaction(async (tx) => {
        // Update copies
        await tx.bookCopy.updateMany({
          where: {
            copy_id: { in: copyIds }
          },
          data: {
            status
          }
        })

        // Update book availability if needed
        if (availabilityChange !== 0) {
          await tx.book.update({
            where: { book_id: bookId },
            data: {
              copies_available: {
                increment: availabilityChange
              }
            }
          })
        }
      })

      return createSuccessResponse(
        { updatedCount: copies.length },
        `Successfully updated ${copies.length} cop${copies.length > 1 ? 'ies' : 'y'}`
      )
    } catch (error) {
      console.error('Error bulk updating copies:', error)
      return createErrorResponse('Failed to update copies', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
