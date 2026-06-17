import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

// PATCH - Update copy status, condition, location, etc.
export const PATCH = withAuth(
  async (req: NextRequest, session, context) => {
    try {
      const { book_id, copyId } = await context.params
      const bookId = parseInt(book_id)
      const copyIdNum = parseInt(copyId)

      if (isNaN(bookId) || isNaN(copyIdNum)) {
        return createErrorResponse('Invalid book ID or copy ID', 400)
      }

      const body = await req.json()
      const { status, condition, location, notes, barcode } = body

      const copy = await prisma.bookCopy.findUnique({
        where: { copy_id: copyIdNum },
        include: { book: true }
      })

      if (!copy || copy.book_id !== bookId) {
        return createErrorResponse('Copy not found', 404)
      }

      // Prevent status change if currently borrowed
      if (copy.status === 'BORROWED' && status && status !== 'BORROWED') {
        return createErrorResponse('Cannot change status of borrowed copy. Please return the book first.', 400)
      }

      const updateData: any = {}
      if (status !== undefined) updateData.status = status
      if (condition !== undefined) updateData.condition = condition
      if (location !== undefined) updateData.location = location
      if (notes !== undefined) updateData.notes = notes
      if (barcode !== undefined) updateData.barcode = barcode

      const updatedCopy = await prisma.bookCopy.update({
        where: { copy_id: copyIdNum },
        data: updateData
      })

      // Update book availability count if status changed
      if (status && status !== copy.status) {
        const wasAvailable = copy.status === 'AVAILABLE'
        const isNowAvailable = status === 'AVAILABLE'

        if (wasAvailable && !isNowAvailable) {
          // Copy became unavailable
          await prisma.book.update({
            where: { book_id: bookId },
            data: { copies_available: { decrement: 1 } }
          })
        } else if (!wasAvailable && isNowAvailable) {
          // Copy became available
          await prisma.book.update({
            where: { book_id: bookId },
            data: { copies_available: { increment: 1 } }
          })
        }
      }

      return createSuccessResponse(updatedCopy, 'Copy updated successfully')
    } catch (error) {
      console.error('Error updating copy:', error)
      return createErrorResponse('Failed to update copy', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)

// DELETE - Archive a copy (soft delete)
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

      // Prevent deletion if currently borrowed
      if (copy.status === 'BORROWED') {
        return createErrorResponse('Cannot delete a borrowed copy', 400)
      }

      // Soft delete
      await prisma.bookCopy.update({
        where: { copy_id: copyIdNum },
        data: { 
          archived_at: new Date(),
          status: 'DAMAGED' // Mark as damaged when archived
        }
      })

      // Update book counts
      await prisma.book.update({
        where: { book_id: bookId },
        data: {
          copies_total: { decrement: 1 },
          ...(copy.status === 'AVAILABLE' && { copies_available: { decrement: 1 } })
        }
      })

      return createSuccessResponse(null, 'Copy archived successfully')
    } catch (error) {
      console.error('Error deleting copy:', error)
      return createErrorResponse('Failed to delete copy', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
