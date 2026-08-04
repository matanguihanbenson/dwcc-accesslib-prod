import { NextRequest } from 'next/server'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/types'

/**
 * PATCH /api/authors/toggle-active
 *
 * Toggles the is_active flag on all book_author and book_contributor
 * records matching the given name.  When a person appears in both
 * tables, both are toggled together so the author list stays consistent.
 *
 * Body: { name: string }
 */
export const PATCH = withAuth(
  async (req: NextRequest, session) => {
    try {
      const { name } = await req.json()

      if (!name || typeof name !== 'string') {
        return createErrorResponse('name is required', 400)
      }

      const trimmed = name.trim()
      if (!trimmed) {
        return createErrorResponse('name cannot be empty', 400)
      }

      // Determine the current active state from the first matching record
      const sample = await prisma.bookAuthor.findFirst({
        where: { name: trimmed },
        select: { is_active: true }
      })

      const sampleContrib = !sample
        ? await prisma.bookContributor.findFirst({
            where: { name: trimmed },
            select: { is_active: true }
          })
        : null

      const currentActive = sample?.is_active ?? sampleContrib?.is_active ?? true
      const newActive = !currentActive

      // Toggle all matching records in both tables
      const [authorResult, contributorResult] = await Promise.all([
        prisma.bookAuthor.updateMany({
          where: { name: trimmed },
          data: { is_active: newActive }
        }),
        prisma.bookContributor.updateMany({
          where: { name: trimmed },
          data: { is_active: newActive }
        })
      ])

      return createSuccessResponse({
        name: trimmed,
        is_active: newActive,
        author_records_updated: authorResult.count,
        contributor_records_updated: contributorResult.count,
      }, `Author ${newActive ? 'activated' : 'deactivated'} successfully`)
    } catch (error) {
      console.error('Error toggling author active state:', error)
      return createErrorResponse('Failed to toggle author state', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
