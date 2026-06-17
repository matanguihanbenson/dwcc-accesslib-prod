import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

// GET - Look up book copy by accession number
export const GET = withAuth(
  async (req: NextRequest, session, context) => {
    try {
      const { accessionNumber } = await context.params

      if (!accessionNumber) {
        return createErrorResponse('Accession number is required', 400)
      }

      // Find the book copy
      const bookCopy = await prisma.bookCopy.findFirst({
        where: {
          accession_number: accessionNumber,
          archived_at: null
        },
        include: {
          book: {
            include: {
              category: true,
              authors: true
            }
          }
        }
      })

      if (!bookCopy) {
        return createErrorResponse('Book copy not found', 404)
      }

      // Return both the copy and the book information
      return createSuccessResponse({
        copy: bookCopy,
        book: bookCopy.book,
        copy_id: bookCopy.copy_id,
        book_id: bookCopy.book_id,
        accession_number: bookCopy.accession_number,
        status: bookCopy.status,
        condition: bookCopy.condition,
        location: bookCopy.location,
        barcode: bookCopy.barcode
      })
    } catch (error) {
      console.error('Error looking up accession number:', error)
      return createErrorResponse('Failed to lookup accession number', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
