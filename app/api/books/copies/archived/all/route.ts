import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

// GET all archived copies across all books
export const GET = withAuth(
  async (req: NextRequest, session) => {
    try {
      const archivedCopies = await prisma.bookCopy.findMany({
        where: {
          archived_at: { not: null }
        },
        include: {
          book: {
            select: {
              book_id: true,
              title: true,
              isbn: true,
              authors: {
                select: {
                  name: true
                },
                orderBy: {
                  display_order: 'asc'
                }
              },
              category: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        orderBy: {
          archived_at: 'desc'
        }
      })

      // Map to include book_author as a string
      const copiesWithAuthors = archivedCopies.map(copy => ({
        ...copy,
        book: {
          ...copy.book,
          book_author: copy.book.authors.map(a => a.name).join(', ') || 'Unknown Author',
          authors: copy.book.authors.map(a => a.name)
        }
      }))

      return createSuccessResponse(copiesWithAuthors)
    } catch (error) {
      console.error('Error fetching all archived copies:', error)
      return createErrorResponse('Failed to fetch archived copies', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
