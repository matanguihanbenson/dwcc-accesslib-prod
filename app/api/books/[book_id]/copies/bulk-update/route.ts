import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

// POST - Bulk update copy fields. Accepts either { copyIds, status }
// for a status change, { copyIds, location } for a location
// change, or { copyIds, archive: true } to archive them.
// Exactly one of `status` / `location` / `archive` must be set.
export const POST = withAuth(
  async (req: NextRequest, session, context) => {
    try {
      const { book_id } = await context.params
      const bookId = parseInt(book_id)

      if (isNaN(bookId)) {
        return createErrorResponse('Invalid book ID', 400)
      }

      const body = await req.json()
      const { copyIds, status, location, archive } = body

      if (!copyIds || !Array.isArray(copyIds) || copyIds.length === 0) {
        return createErrorResponse('Copy IDs are required', 400)
      }

      // Enforce exactly one operation per call so callers
      // can't accidentally mix-and-match fields.
      const ops = [status !== undefined, location !== undefined, archive === true].filter(Boolean).length
      if (ops === 0) {
        return createErrorResponse('Specify one of: status, location, or archive', 400)
      }
      if (ops > 1) {
        return createErrorResponse('Specify only one of: status, location, or archive', 400)
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

      // -------- status change --------
      if (status !== undefined) {
        if (!['AVAILABLE', 'BORROWED', 'LOST', 'DAMAGED', 'MAINTENANCE'].includes(status)) {
          return createErrorResponse('Invalid status', 400)
        }
        const borrowedCopies = copies.filter(c => c.status === 'BORROWED')
        if (borrowedCopies.length > 0 && status !== 'BORROWED') {
          return createErrorResponse(
            `Cannot change status of ${borrowedCopies.length} borrowed cop${borrowedCopies.length > 1 ? 'ies' : 'y'}`,
            400
          )
        }

        let availabilityChange = 0
        for (const copy of copies) {
          const wasAvailable = copy.status === 'AVAILABLE'
          const willBeAvailable = status === 'AVAILABLE'
          if (wasAvailable && !willBeAvailable) availabilityChange -= 1
          else if (!wasAvailable && willBeAvailable) availabilityChange += 1
        }

        await prisma.$transaction(async (tx) => {
          await tx.bookCopy.updateMany({
            where: { copy_id: { in: copyIds } },
            data: { status }
          })
          if (availabilityChange !== 0) {
            await tx.book.update({
              where: { book_id: bookId },
              data: {
                copies_available: { increment: availabilityChange }
              }
            })
          }
        })

        return createSuccessResponse(
          { updatedCount: copies.length, operation: 'status' },
          `Successfully updated status of ${copies.length} cop${copies.length > 1 ? 'ies' : 'y'}`
        )
      }

      // -------- location change --------
      if (location !== undefined) {
        if (typeof location !== 'string') {
          return createErrorResponse('Invalid location', 400)
        }
        const cleaned = location.trim()
        if (cleaned.length > 120) {
          return createErrorResponse('Location is too long (max 120 characters)', 400)
        }

        await prisma.bookCopy.updateMany({
          where: { copy_id: { in: copyIds } },
          data: { location: cleaned || null }
        })

        return createSuccessResponse(
          { updatedCount: copies.length, operation: 'location', location: cleaned },
          `Successfully updated location of ${copies.length} cop${copies.length > 1 ? 'ies' : 'y'}`
        )
      }

      // -------- archive --------
      if (archive === true) {
        const borrowedCopies = copies.filter(c => c.status === 'BORROWED')
        if (borrowedCopies.length > 0) {
          return createErrorResponse(
            `Cannot archive ${borrowedCopies.length} borrowed cop${borrowedCopies.length > 1 ? 'ies' : 'y'}`,
            400
          )
        }

        const affected = await prisma.$transaction(async (tx) => {
          await tx.bookCopy.updateMany({
            where: { copy_id: { in: copyIds } },
            data: { archived_at: new Date(), status: 'DAMAGED' }
          })
          // Decrement `copies_total` for every archived row
          // and `copies_available` for any that were available
          // at the time of archive.
          const wasAvailable = copies.filter(c => c.status === 'AVAILABLE').length
          await tx.book.update({
            where: { book_id: bookId },
            data: {
              copies_total: { decrement: copies.length },
              ...(wasAvailable > 0 && {
                copies_available: { decrement: wasAvailable }
              })
            }
          })
          return copies.length
        })

        return createSuccessResponse(
          { updatedCount: affected, operation: 'archive' },
          `Successfully archived ${affected} cop${affected > 1 ? 'ies' : 'y'}`
        )
      }

      return createErrorResponse('No operation performed', 400)
    } catch (error) {
      console.error('Error bulk updating copies:', error)
      return createErrorResponse('Failed to update copies', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
