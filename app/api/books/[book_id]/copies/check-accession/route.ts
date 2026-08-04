import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(
  async (req: NextRequest, session, context) => {
    try {
      const { book_id } = await context.params
      const bookId = parseInt(book_id)

      if (isNaN(bookId)) {
        return createErrorResponse('Invalid book ID', 400)
      }

      const { searchParams } = new URL(req.url)
      const accessionNumber = searchParams.get('accession_number')?.trim().toUpperCase()
      const excludeCopyId = searchParams.get('exclude_copy_id')

      if (!accessionNumber) {
        return createErrorResponse('accession_number is required', 400)
      }

      const where: any = { accession_number: accessionNumber }
      if (excludeCopyId) {
        const excludeId = parseInt(excludeCopyId)
        if (!isNaN(excludeId)) {
          where.copy_id = { not: excludeId }
        }
      }

      const existing = await prisma.bookCopy.findFirst({
        where,
        select: { copy_id: true, accession_number: true, book_id: true }
      })

      return createSuccessResponse({
        exists: !!existing,
        conflicting: existing
          ? { copy_id: existing.copy_id, book_id: existing.book_id }
          : null
      })
    } catch (error) {
      console.error('Error checking accession number:', error)
      return createErrorResponse('Failed to check accession number', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
