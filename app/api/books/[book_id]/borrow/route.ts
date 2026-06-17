import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse, validateId, getUserIdFromSession } from '@/lib/api-utils'
import { bookService } from '@/lib/services/book.service'
import { validateDate } from '@/lib/validations'

interface RouteParams {
  params: { book_id: string }
}

export const POST = withAuth(
  async (req: NextRequest, session) => {
    // Extract book_id from the URL
    const url = new URL(req.url)
    const bookIdParam = url.pathname.split('/')[3] // /api/books/[book_id]/borrow
    const bookId = validateId(bookIdParam, 'Book ID')
    
    const body = await req.json()
    const errors: string[] = []
    
    if (!body.user_id) {
      errors.push('User ID is required')
    } else if (isNaN(parseInt(body.user_id))) {
      errors.push('Invalid User ID')
    }
    
    if (!body.due_date) {
      errors.push('Due date is required')
    } else {
      const dateError = validateDate(body.due_date)
      if (dateError) errors.push(dateError)
    }
    
    if (errors.length > 0) {
      return createErrorResponse(errors.join(', '), 400, 'VALIDATION_ERROR')
    }

    // Validate copy availability if copy_id is provided
    if (body.copy_id) {
      const copyId = parseInt(body.copy_id)
      if (!isNaN(copyId)) {
        const { prisma } = await import('@/lib/prisma')
        
        const copy = await prisma.bookCopy.findUnique({
          where: { copy_id: copyId }
        })

        if (!copy) {
          return createErrorResponse('Book copy not found', 404, 'COPY_NOT_FOUND')
        }

        if (copy.book_id !== bookId) {
          return createErrorResponse('Copy does not belong to this book', 400, 'INVALID_COPY')
        }

        if (copy.archived_at) {
          return createErrorResponse(
            'This copy has been archived and cannot be borrowed. Please select another copy.',
            400,
            'COPY_ARCHIVED'
          )
        }

        if (copy.status === 'BORROWED') {
          return createErrorResponse(
            'This copy is currently borrowed by another user. Please select a different copy.',
            400,
            'COPY_BORROWED'
          )
        }

        if (copy.status === 'LOST') {
          return createErrorResponse(
            'This copy is marked as missing and cannot be borrowed. Please select another copy.',
            400,
            'COPY_MISSING'
          )
        }

        if (copy.status === 'DAMAGED') {
          return createErrorResponse(
            'This copy is damaged and cannot be borrowed. Please select another copy.',
            400,
            'COPY_DAMAGED'
          )
        }

        if (copy.status === 'MAINTENANCE') {
          return createErrorResponse(
            'This copy is under maintenance and cannot be borrowed at this time. Please select another copy.',
            400,
            'COPY_MAINTENANCE'
          )
        }

        if (copy.status !== 'AVAILABLE') {
          return createErrorResponse(
            'This copy is not available for borrowing. Please select another copy.',
            400,
            'COPY_NOT_AVAILABLE'
          )
        }
      }
    }

    // Get the correct user_id from session
    const processedByUserId = await getUserIdFromSession(session)
    
    if (!processedByUserId) {
      return createErrorResponse('Unable to identify user from session', 401, 'SESSION_ERROR')
    }

    const result = await bookService.borrowBook(
      bookId,
      parseInt(body.user_id),
      new Date(body.due_date),
      processedByUserId,
      session.user.role
    )
    
    if (!result.success) {
      throw new Error(result.error)
    }
    
    return createSuccessResponse(result.data, result.message, 201)
  },
  [UserRole.ADMIN, UserRole.STAFF]
)
