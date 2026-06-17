import { NextRequest, NextResponse } from 'next/server'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/types'
import { AuditService } from '@/lib/services/audit.service'

// GET /api/lockers - Get all lockers with their current status
export const GET = withAuth(
  async (req: NextRequest, session: any) => {
    try {
      const { searchParams } = new URL(req.url)
      const status = searchParams.get('status') // 'AVAILABLE', 'OCCUPIED', 'DAMAGED', 'MAINTENANCE', 'ARCHIVED'
      const includeTransactions = searchParams.get('include_transactions') === 'true'

      const whereClause: any = {}

      // If status is ARCHIVED, show only archived lockers
      if (status === 'ARCHIVED') {
        whereClause.archived_at = { not: null }
        whereClause.status = 'ARCHIVED'
      } else {
        // Otherwise, exclude archived lockers
        whereClause.archived_at = null
        
        if (status) {
          whereClause.status = status
        }
      }

      const lockers = await prisma.locker.findMany({
        where: whereClause,
        include: includeTransactions ? {
          locker_transactions: {
            where: {
              return_time: null // Only active transactions
            },
            include: {
              user: {
                select: {
                  user_id: true,
                  full_name: true,
                  account_id: true,
                  user_type: true,
                  email: true,
                  contact_number: true
                }
              }
            },
            orderBy: {
              borrow_time: 'desc'
            },
            take: 1
          }
        } : undefined,
        orderBy: {
          locker_number: 'asc'
        }
      })

      // Transform data to include computed fields
      const lockersWithStatus = lockers.map((locker: any) => {
        const activeTransaction = locker.locker_transactions?.[0]
        const now = new Date()
        
        let timeInfo = null
        if (activeTransaction) {
          const borrowTime = new Date(activeTransaction.borrow_time)
          const dueTime = activeTransaction.due_time ? new Date(activeTransaction.due_time) : null
          const hoursUsed = (now.getTime() - borrowTime.getTime()) / (1000 * 60 * 60)
          const isOvertime = dueTime ? now > dueTime : false
          
          timeInfo = {
            hoursUsed: hoursUsed.toFixed(1),
            borrowTime: activeTransaction.borrow_time,
            dueTime: activeTransaction.due_time,
            isOvertime,
            penalty: Number(activeTransaction.penalty)
          }
        }

        return {
          ...locker,
          activeTransaction: activeTransaction || null,
          timeInfo,
          locker_transactions: undefined // Remove from response to keep it clean
        }
      })

      return createSuccessResponse(lockersWithStatus)
    } catch (error) {
      return createErrorResponse('Failed to fetch lockers', 500)
    }
  },
  [UserRole.ADMIN, UserRole.STAFF, UserRole.SUPER_ADMIN]
)

// POST /api/lockers - Add a new locker (Admin only)
export const POST = withAuth(
  async (req: NextRequest, session: any) => {
    try {
      const body = await req.json()
      const { locker_number, location, rfid_code } = body

      if (!locker_number || !location) {
        return createErrorResponse('Locker number and location are required', 400)
      }

      // Check if locker number already exists (non-archived)
      const existing = await prisma.locker.findFirst({
        where: {
          locker_number,
          archived_at: null
        }
      })

      if (existing) {
        return createErrorResponse('Locker number already exists', 409)
      }

      // Check if there's an archived locker with this number
      const archivedLocker = await prisma.locker.findFirst({
        where: {
          locker_number,
          archived_at: { not: null }
        }
      })

      if (archivedLocker) {
        return NextResponse.json({
          success: false,
          error: 'ARCHIVED_LOCKER_EXISTS',
          message: `Locker ${locker_number} exists in archive`,
          data: {
            locker_id: archivedLocker.locker_id,
            locker_number: archivedLocker.locker_number,
            location: archivedLocker.location
          }
        }, { status: 409 })
      }

      const locker = await prisma.locker.create({
        data: {
          locker_number,
          location,
          status: 'AVAILABLE'
        }
      })

      // Log the action
      await AuditService.logAction(
        parseInt(session.user.id),
        session.user.role as UserRole,
        'CREATE_LOCKER',
        `Created locker ${locker_number} at ${location}`
      )

      return createSuccessResponse(locker, 'Locker created successfully')
    } catch (error) {
      return createErrorResponse('Failed to create locker', 500)
    }
  },
  [UserRole.ADMIN, UserRole.SUPER_ADMIN]
)

