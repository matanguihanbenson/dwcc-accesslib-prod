import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(
  async (req: NextRequest, session) => {
    try {
      // Extract account_id from the URL path
      const url = new URL(req.url)
      const pathSegments = url.pathname.split('/')
      const accountId = pathSegments[pathSegments.length - 1] // Last segment is the account_id
      
      console.log('Staff user lookup by account_id:', accountId)
      console.log('Full URL path:', url.pathname)
      
      if (!accountId || accountId === '[account_id]') {
        throw new Error('Account ID is required')
      }
      
      const user = await prisma.user.findFirst({
        where: {
          account_id: accountId
        },
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
      
      console.log('User lookup result:', user ? 'Found' : 'Not found')
      
      if (!user) {
        return createSuccessResponse({ 
          user: null, 
          found: false,
          message: `No user found with account ID: ${accountId}`,
          account_id: accountId
        })
      }
      
      // Format the response for better usability
      const formattedUser = {
        ...user,
        department_name: user.department_ref?.name || null,
        department_code: user.department_ref?.code || null,
        program_name: user.program?.name || null,
        program_code: user.program?.code || null,
        has_rfid: !!user.rfid_code,
        display_name: `${user.full_name} (${user.account_id})`,
        type_display: user.user_type.charAt(0) + user.user_type.slice(1).toLowerCase(),
        status_display: user.status.charAt(0) + user.status.slice(1).toLowerCase()
      }
      
      console.log('User found successfully:', { account_id: user.account_id, full_name: user.full_name, status: user.status })
      
      return createSuccessResponse({ 
        user: formattedUser,
        found: true,
        message: 'User found successfully',
        account_id: accountId
      })
    } catch (error) {
      console.error('Error in staff user lookup by account_id:', error)
      throw new Error('Failed to lookup user by account ID')
    }
  },
  [UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN]
)
