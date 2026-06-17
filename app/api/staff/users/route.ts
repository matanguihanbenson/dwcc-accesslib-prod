import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, getSearchParams } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(
  async (req: NextRequest, session) => {
    try {
      const filters = getSearchParams(req)
      console.log('Staff users API called with filters:', filters)
      
      // Build where clause for filtering
      const where: any = {
        // Fetch all users regardless of status (ACTIVE, INACTIVE, SUSPENDED, ARCHIVED)
      }
      
      // Search filter
      if (filters.search) {
        where.OR = [
          { full_name: { contains: filters.search } },
          { account_id: { contains: filters.search } },
          { email: { contains: filters.search } },
          { department_ref: { name: { contains: filters.search } } }
        ]
      }
      
      // User type filter
      if (filters.userType) {
        where.user_type = filters.userType
      }
      
      // Department filter
      if (filters.department) {
        where.department_ref = {
          name: { contains: filters.department }
        }
      }
      
      // Year level filter
      if (filters.year_level || filters.yearLevel) {
        const yearLevel = filters.year_level || filters.yearLevel
        where.year_level = { contains: yearLevel }
      }
      
      // Pagination
      const page = typeof filters.page === 'string' ? parseInt(filters.page) : (filters.page || 1)
      const limit = Math.min(typeof filters.limit === 'string' ? parseInt(filters.limit) : (filters.limit || 20), 100) // Max 100 records
      const skip = (page - 1) * limit
      
      // Execute query with proper relationships
      const [users, totalCount] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            user_id: true,
            account_id: true,
            full_name: true,
            user_type: true,
            year_level: true,
            email: true,
            contact_number: true,
            status: true,
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
            created_at: true
          },
          orderBy: [
            { full_name: 'asc' }
          ],
          skip,
          take: limit
        }),
        prisma.user.count({ where })
      ])
      
      // Calculate pagination info
      const totalPages = Math.ceil(totalCount / limit)
      
      return createSuccessResponse({
        users,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        }
      })
    } catch (error) {
      console.error('Error fetching users for staff:', error)
      throw new Error('Failed to fetch users data')
    }
  },
  [UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN] // Staff users can access this
)

// Optional: Add a specific user lookup by ID for staff
export const POST = withAuth(
  async (req: NextRequest, session) => {
    try {
      const body = await req.json()
      const { user_id, account_id, rfid_code } = body
      
      if (!user_id && !account_id && !rfid_code) {
        throw new Error('Either user_id, account_id, or rfid_code is required')
      }
      
      const whereClause: any = {
        // Fetch all users regardless of status
      }
      
      if (user_id) {
        whereClause.user_id = parseInt(user_id)
      } else if (account_id) {
        whereClause.account_id = account_id
      } else if (rfid_code) {
        whereClause.rfid_code = rfid_code
      }
      
      const user = await prisma.user.findFirst({
        where: whereClause,
        select: {
          user_id: true,
          account_id: true,
          full_name: true,
          user_type: true,
          year_level: true,
          email: true,
          contact_number: true,
          status: true,
          rfid_code: true,
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
          created_at: true
        }
      })
      
      if (!user) {
        return createSuccessResponse({
          user: null,
          message: 'User not found or inactive'
        })
      }
      
      return createSuccessResponse({
        user,
        message: 'User found successfully'
      })
    } catch (error) {
      console.error('Error looking up specific user for staff:', error)
      throw new Error('Failed to lookup user')
    }
  },
  [UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN]
)
