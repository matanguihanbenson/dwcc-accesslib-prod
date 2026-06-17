import { NextRequest, NextResponse } from 'next/server'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/types'
import { AuditService } from '@/lib/services/audit.service'

// GET /api/locker-transactions - Get all locker transactions
export const GET = withAuth(
  async (req: NextRequest, session: any, context?: any) => {
    try {
      console.log('GET /api/locker-transactions - Starting...')
      console.log('GET /api/locker-transactions - Session:', { 
        id: session?.user?.id, 
        role: session?.user?.role,
        username: session?.user?.username 
      })
      console.log('GET /api/locker-transactions - Context:', context)
      
      const { searchParams } = new URL(req.url)
      const status = searchParams.get('status') // 'active', 'completed', 'all'
      const userId = searchParams.get('user_id')
      const limit = parseInt(searchParams.get('limit') || '100')
      
      console.log('GET /api/locker-transactions - Params:', { status, userId, limit })

      const whereClause: any = {}

      if (status === 'active') {
        whereClause.return_time = null
      } else if (status === 'completed') {
        whereClause.return_time = { not: null }
      }

      if (userId) {
        whereClause.user_id = parseInt(userId)
      }

      const transactions = await prisma.lockerTransaction.findMany({
        where: whereClause,
        include: {
          locker: {
            select: {
              locker_id: true,
              locker_number: true,
              location: true,
              status: true
            }
          },
          user: {
            select: {
              user_id: true,
              full_name: true,
              account_id: true,
              user_type: true,
              email: true,
              contact_number: true,
              department_ref: {
                select: { name: true }
              },
              program: {
                select: { name: true }
              }
            }
          }
        },
        orderBy: {
          borrow_time: 'desc'
        },
        take: limit
      })

      console.log('GET /api/locker-transactions - Found transactions:', transactions.length)
      
      // Calculate time information
      const transactionsWithInfo = transactions.map(transaction => {
        const now = new Date()
        const borrowTime = new Date(transaction.borrow_time)
        const dueTime = transaction.due_time ? new Date(transaction.due_time) : null
        const returnTime = transaction.return_time ? new Date(transaction.return_time) : null

        const hoursUsed = returnTime
          ? (returnTime.getTime() - borrowTime.getTime()) / (1000 * 60 * 60)
          : (now.getTime() - borrowTime.getTime()) / (1000 * 60 * 60)

        const isOvertime = dueTime ? (returnTime || now) > dueTime : false

        return {
          ...transaction,
          hoursUsed: hoursUsed.toFixed(1),
          isOvertime,
          status: transaction.return_time ? 'COMPLETED' : transaction.status
        }
      })

      console.log('GET /api/locker-transactions - Returning count:', transactionsWithInfo.length)
      
      return createSuccessResponse(transactionsWithInfo)
    } catch (error) {
      console.error('Error fetching locker transactions:', error)
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
      console.error('Error message:', error instanceof Error ? error.message : String(error))
      return createErrorResponse('Failed to fetch locker transactions', 500)
    }
  },
  [UserRole.ADMIN, UserRole.STAFF, UserRole.SUPER_ADMIN]
)

// POST /api/locker-transactions - Assign locker to user
export const POST = withAuth(
  async (req: NextRequest, session: any, context?: any) => {
    try {
      console.log('POST /api/locker-transactions - Session:', { id: session?.user?.id, role: session?.user?.role })
      
      const body = await req.json()
      const { user_id, locker_id, locker_number, due_hours } = body

      // Find locker by ID or number
      let locker
      if (locker_id) {
        locker = await prisma.locker.findUnique({
          where: { locker_id: parseInt(locker_id) }
        })
      } else if (locker_number) {
        locker = await prisma.locker.findFirst({
          where: { locker_number, archived_at: null }
        })
      } else {
        return createErrorResponse('locker_id or locker_number is required', 400)
      }

      if (!locker) {
        return createErrorResponse('Locker not found', 404)
      }

      // Check if locker is available
      if (locker.status !== 'AVAILABLE') {
        return createErrorResponse('Locker is not available', 400)
      }

      // Check if user already has an active locker
      const activeTransaction = await prisma.lockerTransaction.findFirst({
        where: {
          user_id: parseInt(user_id),
          return_time: null
        },
        include: {
          locker: true
        }
      })

      if (activeTransaction) {
        return createErrorResponse(
          `User already has an active locker assignment (Locker ${activeTransaction.locker.locker_number})`,
          400
        )
      }

      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { user_id: parseInt(user_id) }
      })

      if (!user) {
        return createErrorResponse('User not found', 404)
      }

      // Create transaction and update locker status
      const borrowTime = new Date()
      const dueTime = new Date(borrowTime.getTime() + (due_hours || 2) * 60 * 60 * 1000) // Default 2 hours

      const transaction = await prisma.$transaction(async (tx) => {
        // Create locker transaction
        const newTransaction = await tx.lockerTransaction.create({
          data: {
            locker_id: locker.locker_id,
            user_id: parseInt(user_id),
            borrow_time: borrowTime,
            due_time: dueTime,
            status: 'ACTIVE',
            assigned_by: parseInt(session.user.id)
          },
          include: {
            locker: true,
            user: {
              select: {
                full_name: true,
                account_id: true,
                user_type: true
              }
            }
          }
        })

        // Update locker status
        await tx.locker.update({
          where: { locker_id: locker.locker_id },
          data: { status: 'OCCUPIED' }
        })

        return newTransaction
      })

      // Log the action
      await AuditService.logAction(
        parseInt(session.user.id),
        session.user.role as UserRole,
        'ASSIGN_LOCKER',
        `Assigned locker ${locker.locker_number} to ${user.full_name} (${user.account_id})`
      )

      return createSuccessResponse(transaction, 'Locker assigned successfully')
    } catch (error) {
      console.error('Error assigning locker:', error)
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
      return createErrorResponse('Failed to assign locker', 500)
    }
  },
  [UserRole.ADMIN, UserRole.STAFF, UserRole.SUPER_ADMIN]
)

