import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(
  async (req: NextRequest, session) => {
    try {
      const { searchParams } = new URL(req.url)
      const id = searchParams.get('id')
      const rfid = searchParams.get('rfid')
      
      if (!id && !rfid) {
        throw new Error('Either ID or RFID parameter is required')
      }
      
      let user
      
      if (rfid) {
        // Look up by RFID - would need to extend user model to include RFID
        user = await prisma.user.findFirst({
          where: {
            rfid_code: rfid,
            status: 'ACTIVE'
          },
          select: {
            user_id: true,
            full_name: true,
            account_id: true,
            user_type: true,
            year_level: true,
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
          }
        })
      } else {
        // Look up by ID (account_id)
        user = await prisma.user.findFirst({
          where: {
            account_id: id || '',
            status: 'ACTIVE'
          },
          select: {
            user_id: true,
            full_name: true,
            account_id: true,
            user_type: true,
            year_level: true,
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
          }
        })
      }
      
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
      console.error('Error looking up user:', error)
      throw new Error('Failed to lookup user')
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
