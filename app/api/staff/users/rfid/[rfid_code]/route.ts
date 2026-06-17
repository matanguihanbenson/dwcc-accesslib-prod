import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(
  async (req: NextRequest, session) => {
    try {
      // Extract rfid_code from the URL path
      const url = new URL(req.url)
      const pathSegments = url.pathname.split('/')
      const rfidCode = pathSegments[pathSegments.length - 1] // Last segment is the rfid_code
      
      if (!rfidCode) {
        throw new Error('RFID code is required')
      }
      
      console.log('Staff user lookup by RFID:', rfidCode)
      
      const user = await prisma.user.findFirst({
        where: {
          rfid_code: rfidCode
          // No status filter - fetch all users regardless of status
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
      
      if (!user) {
        console.log('User not found with RFID:', rfidCode)
        return createSuccessResponse({ 
          user: null, 
          found: false,
          message: `No user found with RFID code: ${rfidCode}`,
          rfid_code: rfidCode
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
      
      console.log('User found by RFID:', { account_id: user.account_id, full_name: user.full_name, status: user.status })
      
      return createSuccessResponse({ 
        user: formattedUser,
        found: true,
        message: 'User found successfully',
        rfid_code: rfidCode
      })
    } catch (error) {
      console.error('Error in staff user lookup by RFID:', error)
      throw new Error('Failed to lookup user by RFID code')
    }
  },
  [UserRole.STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN]
)
