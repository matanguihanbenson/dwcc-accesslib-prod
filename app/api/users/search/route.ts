import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(
  async (req: NextRequest, session) => {
    try {
      const searchParams = req.nextUrl.searchParams
      const query = searchParams.get('q') || ''
      const limit = parseInt(searchParams.get('limit') || '10')

      if (!query || query.trim().length < 2) {
        return createSuccessResponse([])
      }

      const users = await prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            {
              account_id: {
                contains: query
              }
            },
            {
              full_name: {
                contains: query
              }
            },
            {
              email: {
                contains: query
              }
            }
          ]
        },
        include: {
          department_ref: {
            select: {
              name: true,
              code: true
            }
          },
          program: {
            select: {
              name: true,
              code: true
            }
          },
          office_ref: {
            select: {
              name: true
            }
          }
        },
        take: limit,
        orderBy: {
          account_id: 'asc'
        }
      })

      const results = users.map(user => ({
        user_id: user.user_id,
        account_id: user.account_id,
        full_name: user.full_name,
        email: user.email,
        user_type: user.user_type,
        department: user.department_ref?.name || null,
        program: user.program?.name || null,
        office: user.office_ref?.name || null,
        label: `${user.account_id} - ${user.full_name} (${user.user_type})`
      }))

      return createSuccessResponse(results)
    } catch (error) {
      console.error('Error searching users:', error)
      return createErrorResponse('Failed to search users', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
