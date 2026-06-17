import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(
  async (req: NextRequest, session) => {
    try {
      const { searchParams } = new URL(req.url)
      const query = searchParams.get('q') || searchParams.get('query') || ''
      const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50) // Max 50 results
      const userType = searchParams.get('userType')
      const department = searchParams.get('department')
      
      if (!query || query.trim().length < 2) {
        return createSuccessResponse({
          users: [],
          message: 'Search query must be at least 2 characters long'
        })
      }
      
      const searchTerm = query.trim()
      
      // Build where clause
      const where: any = {
        // Fetch all users regardless of status (ACTIVE, INACTIVE, SUSPENDED, ARCHIVED)
          OR: [
            { full_name: { contains: searchTerm } },
            { account_id: { contains: searchTerm } },
            { email: { contains: searchTerm } }
          ]
      }
      
      // Add filters
      if (userType) {
        where.user_type = userType
      }
      
      if (department) {
          where.department_ref = {
            name: { contains: department }
          }
      }
      
      console.log('Staff user search query:', searchTerm, 'filters:', { userType, department })
      
      const users = await prisma.user.findMany({
        where,
        select: {
          user_id: true,
          account_id: true,
          full_name: true,
          user_type: true,
          year_level: true,
          email: true,
          status: true,
          department_ref: {
            select: {
              name: true
            }
          },
          program: {
            select: {
              name: true
            }
          }
        },
        orderBy: [
          { full_name: 'asc' }
        ],
        take: limit
      })
      
      // Format results for easy display
      const formattedUsers = users.map(user => ({
        ...user,
        display_name: `${user.full_name} (${user.account_id})`,
        department_name: user.department_ref?.name || 'N/A',
        program_name: user.program?.name || 'N/A',
        type_display: user.user_type.charAt(0) + user.user_type.slice(1).toLowerCase()
      }))
      
      return createSuccessResponse({
        users: formattedUsers,
        count: formattedUsers.length,
        query: searchTerm,
        limit,
        message: `Found ${formattedUsers.length} users matching "${searchTerm}"`
      })
    } catch (error) {
      console.error('Error in staff user search:', error)
      throw new Error('Failed to search users')
    }
  },
  [UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN]
)
