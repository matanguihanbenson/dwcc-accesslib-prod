import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

// GET - Paginated borrowing history for a specific copy.
// Used by the "View Borrowing History" action on the manage-copies
// page so staff can see every transaction tied to one physical
// copy. Defaults to 10 per page, ordered most-recent-first by
// borrow date (then by transaction id as a tiebreaker for copies
// that were borrowed and returned the same day).
export const GET = withAuth(
  async (req: NextRequest, session, context) => {
    try {
      const { book_id, copyId } = await context.params
      const bookId = parseInt(book_id)
      const copyIdNum = parseInt(copyId)

      if (isNaN(bookId) || isNaN(copyIdNum)) {
        return createErrorResponse('Invalid book ID or copy ID', 400)
      }

      const { searchParams } = new URL(req.url)
      // Cap page size: the modal renders 10 rows by default, so
      // anything past 50 would just produce scrollbars.
      const limit = Math.min(
        parseInt(searchParams.get('limit') || '10'),
        50
      )
      const page = Math.max(parseInt(searchParams.get('page') || '1'), 1)
      const offset = (page - 1) * limit

      // Confirm the copy actually belongs to this book so we
      // never leak transactions from a different book via a
      // mismatched URL.
      const copy = await prisma.bookCopy.findUnique({
        where: { copy_id: copyIdNum },
        select: { copy_id: true, book_id: true }
      })

      if (!copy || copy.book_id !== bookId) {
        return createErrorResponse('Copy not found', 404)
      }

      const where = { copy_id: copyIdNum }

      const [transactions, total] = await Promise.all([
        prisma.bookTransaction.findMany({
          where,
          orderBy: [
            { borrow_date: 'desc' },
            { transaction_id: 'desc' }
          ],
          skip: offset,
          take: limit,
          select: {
            transaction_id: true,
            borrow_date: true,
            return_date: true,
            due_date: true,
            status: true,
            penalty: true,
            user: {
              select: {
                user_id: true,
                full_name: true,
                account_id: true,
                user_type: true
              }
            }
          }
        }),
        prisma.bookTransaction.count({ where })
      ])

      const totalPages = Math.max(1, Math.ceil(total / limit))

      return createSuccessResponse({
        transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      })
    } catch (error) {
      console.error('Error fetching copy borrow history:', error)
      return createErrorResponse('Failed to fetch borrowing history', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)

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
