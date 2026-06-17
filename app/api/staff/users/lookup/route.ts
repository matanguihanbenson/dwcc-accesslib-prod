import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(
  async (req: NextRequest, session, context?: any) => {
    try {
      console.log('Staff users lookup - Session:', { id: session?.user?.id, role: session?.user?.role })
      console.log('Staff users lookup - URL:', req.url)
      
      const { searchParams } = new URL(req.url)
      const id = searchParams.get('id') || searchParams.get('account_id') // account_id (support both param names)
      const userId = searchParams.get('user_id')  // user_id (numeric)
      const rfid = searchParams.get('rfid')       // rfid_code
      const email = searchParams.get('email')     // email lookup
      
      console.log('Staff users lookup - Params:', { id, userId, rfid, email })
      
      if (!id && !userId && !rfid && !email) {
        throw new Error('At least one identifier (id, user_id, rfid, or email) is required')
      }
      
      const whereClause: any = {
        // Fetch all users regardless of status (ACTIVE, INACTIVE, SUSPENDED, ARCHIVED)
      }
      
      // Determine lookup method
      if (userId) {
        whereClause.user_id = parseInt(userId)
      } else if (id) {
        whereClause.account_id = id
      } else if (rfid) {
        whereClause.rfid_code = rfid
      } else if (email) {
        whereClause.email = email
      }
      
      console.log('Staff user lookup with criteria:', whereClause)
      console.log('Looking up user with account_id:', id, 'user_id:', userId, 'rfid:', rfid, 'email:', email)
      
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
          purpose: true,
          department_id: true,
          program_id: true,
          department_ref: {
            select: {
              department_id: true,
              name: true,
              code: true
            }
          },
          program: {
            select: {
              program_id: true,
              name: true,
              code: true
            }
          },
          created_at: true,
          updated_at: true
        }
      })
      
      console.log('Query result:', user ? 'Found user' : 'No user found')
      if (user) {
        console.log('Found user details:', { account_id: user.account_id, full_name: user.full_name, status: user.status })
      }
      
      if (!user) {
        return createSuccessResponse({ 
          user: null, 
          found: false,
          message: 'User not found',
          searchCriteria: whereClause
        })
      }
      
      // Format the response for better usability
      const formattedUser = {
        ...user,
        department_name: user.department_ref?.name || null,
        program_name: user.program?.name || null,
        has_rfid: !!user.rfid_code,
        display_name: `${user.full_name} (${user.account_id})`,
        type_display: user.user_type.charAt(0) + user.user_type.slice(1).toLowerCase()
      }
      
      console.log('Staff user lookup successful:', formattedUser.account_id)
      
      return createSuccessResponse({ 
        user: formattedUser,
        found: true,
        message: 'User found successfully',
        searchCriteria: whereClause
      })
    } catch (error) {
      console.error('Error in staff user lookup:', error)
      console.error('Error details:', error instanceof Error ? error.message : String(error))
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
      throw new Error('Failed to lookup user')
    }
  },
  [UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN] // Accessible to staff and above
)

// POST method for batch lookup (multiple users at once)
export const POST = withAuth(
  async (req: NextRequest, session, context?: any) => {
    try {
      console.log('Staff users batch lookup - Session:', { id: session?.user?.id, role: session?.user?.role })
      
      const body = await req.json()
      const { identifiers, type = 'account_id' } = body
      
      console.log('Staff users batch lookup - Type:', type, 'Count:', identifiers?.length)
      
      if (!identifiers || !Array.isArray(identifiers) || identifiers.length === 0) {
        throw new Error('Array of identifiers is required')
      }
      
      if (identifiers.length > 50) {
        throw new Error('Maximum 50 identifiers allowed per request')
      }
      
      const whereClause: any = {
        // Fetch all users regardless of status
      }
      
      // Build where clause based on identifier type
      switch (type) {
        case 'account_id':
          whereClause.account_id = { in: identifiers }
          break
        case 'user_id':
          whereClause.user_id = { in: identifiers.map(id => parseInt(id)).filter(id => !isNaN(id)) }
          break
        case 'rfid_code':
          whereClause.rfid_code = { in: identifiers }
          break
        case 'email':
          whereClause.email = { in: identifiers }
          break
        default:
          throw new Error('Invalid identifier type. Use: account_id, user_id, rfid_code, or email')
      }
      
      const users = await prisma.user.findMany({
        where: whereClause,
        select: {
          user_id: true,
          account_id: true,
          full_name: true,
          user_type: true,
          year_level: true,
          email: true,
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
          }
        },
        orderBy: { full_name: 'asc' }
      })
      
      // Format results and identify missing users
      const foundIdentifiers = users.map(user => {
        switch (type) {
          case 'account_id': return user.account_id
          case 'user_id': return user.user_id.toString()
          case 'rfid_code': return user.rfid_code
          case 'email': return user.email
          default: return user.account_id
        }
      })
      
      const missingIdentifiers = identifiers.filter(id => !foundIdentifiers.includes(id))
      
      return createSuccessResponse({
        users,
        found_count: users.length,
        missing_identifiers: missingIdentifiers,
        total_requested: identifiers.length,
        identifier_type: type
      })
    } catch (error) {
      console.error('Error in staff batch user lookup:', error)
      console.error('Error details:', error instanceof Error ? error.message : String(error))
      throw new Error('Failed to perform batch user lookup')
    }
  },
  [UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN]
)
