import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(
  async (req: NextRequest, session) => {
    try {
      const searchParams = req.nextUrl.searchParams
      const userId = searchParams.get('user_id')
      const dateFrom = searchParams.get('date_from')
      const dateTo = searchParams.get('date_to')

      if (!userId) {
        return createErrorResponse('User ID is required', 400)
      }

      const userIdNum = parseInt(userId)
      if (isNaN(userIdNum)) {
        return createErrorResponse('Invalid user ID', 400)
      }

      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { user_id: userIdNum },
        include: {
          department_ref: { select: { name: true, code: true } },
          program: { select: { name: true, code: true } },
          grade_level: { select: { name: true, education_level: true } },
          section: { select: { name: true } },
          office_ref: { select: { name: true, code: true } }
        }
      })

      if (!user) {
        return createErrorResponse('User not found', 404)
      }

      // Date range for filtering
      const startDate = dateFrom ? new Date(dateFrom) : new Date(new Date().getFullYear(), 0, 1)
      const endDate = dateTo ? new Date(dateTo) : new Date()

      // Fetch borrowing history
      const bookTransactions = await prisma.bookTransaction.findMany({
        where: {
          user_id: userIdNum,
          created_at: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          book: {
            select: {
              title: true,
              isbn: true
            }
          },
          copy: {
            select: {
              accession_number: true
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        }
      })

      // Fetch penalties
      const penalties = await prisma.overdueSettlement.findMany({
        where: {
          user_id: userIdNum,
          created_at: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: {
          created_at: 'desc'
        }
      })

      // Fetch library visits
      const entryLogs = await prisma.entryLog.findMany({
        where: {
          user_id: userIdNum,
          entry_time: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: {
          entry_time: 'desc'
        }
      })

      // Fetch locker usage
      const lockerTransactions = await prisma.lockerTransaction.findMany({
        where: {
          user_id: userIdNum,
          created_at: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          locker: {
            select: {
              locker_number: true,
              location: true
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        }
      })

      // Calculate summaries
      const borrowingSummary = {
        total_borrowed: bookTransactions.length,
        currently_borrowed: bookTransactions.filter(t => t.status === 'ACTIVE').length,
        overdue_count: bookTransactions.filter(t => t.status === 'OVERDUE').length,
        returned_count: bookTransactions.filter(t => t.status === 'COMPLETED').length
      }

      const bookPenalties = penalties.filter(p => p.transaction_type === 'BOOK')
      const lockerPenalties = penalties.filter(p => p.transaction_type === 'LOCKER')

      // Calculate active/ongoing penalties from book transactions (ACTIVE or OVERDUE status)
      const activeBookPenalties = bookTransactions
        .filter(t => (t.status === 'ACTIVE' || t.status === 'OVERDUE') && Number(t.penalty) > 0)
        .reduce((sum, t) => sum + Number(t.penalty), 0)

      // Calculate active/ongoing penalties from locker transactions (ACTIVE or OVERDUE status)
      const activeLockerPenalties = lockerTransactions
        .filter(t => (t.status === 'ACTIVE' || t.status === 'OVERDUE') && Number(t.penalty) > 0)
        .reduce((sum, t) => sum + Number(t.penalty), 0)

      // Combine settled penalties with active ongoing penalties
      const totalBookPenaltiesFromSettlements = bookPenalties.reduce((sum, p) => sum + Number(p.penalty_amount), 0)
      const totalLockerPenaltiesFromSettlements = lockerPenalties.reduce((sum, p) => sum + Number(p.penalty_amount), 0)
      
      const penaltySummary = {
        total_book_penalties: totalBookPenaltiesFromSettlements + activeBookPenalties,
        total_locker_penalties: totalLockerPenaltiesFromSettlements + activeLockerPenalties,
        total_penalties: penalties.reduce((sum, p) => sum + Number(p.penalty_amount), 0) + activeBookPenalties + activeLockerPenalties,
        total_paid: penalties.reduce((sum, p) => sum + Number(p.amount_paid), 0),
        total_balance: penalties.reduce((sum, p) => sum + Number(p.remaining_balance), 0) + activeBookPenalties + activeLockerPenalties
      }

      // Calculate visit statistics
      const visitsWithDuration = entryLogs
        .filter(log => log.exit_time)
        .map(log => {
          const duration = new Date(log.exit_time!).getTime() - new Date(log.entry_time).getTime()
          return duration / (1000 * 60) // Convert to minutes
        })

      const visitSummary = {
        total_visits: entryLogs.length,
        avg_duration_minutes: visitsWithDuration.length > 0 
          ? Math.round(visitsWithDuration.reduce((sum, d) => sum + d, 0) / visitsWithDuration.length)
          : 0
      }

      const lockerSummary = {
        total_rentals: lockerTransactions.length,
        current_rental: lockerTransactions.find(t => t.status === 'ACTIVE') || null,
        overdue_count: lockerTransactions.filter(t => t.status === 'OVERDUE').length
      }

      return createSuccessResponse({
        user: {
          user_id: user.user_id,
          account_id: user.account_id,
          full_name: user.full_name,
          user_type: user.user_type,
          email: user.email,
          department: user.department_ref?.name,
          program: user.program?.name,
          grade_level: user.grade_level?.name,
          section: user.section?.name,
          office: user.office_ref?.name
        },
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        borrowing: {
          history: bookTransactions.map(t => ({
            transaction_id: t.transaction_id,
            book_title: t.book.title,
            isbn: t.book.isbn,
            accession_number: t.copy?.accession_number,
            borrow_date: t.borrow_date,
            due_date: t.due_date,
            return_date: t.return_date,
            status: t.status,
            penalty: t.penalty
          })),
          summary: borrowingSummary
        },
        penalties: {
          books: bookPenalties,
          lockers: lockerPenalties,
          summary: penaltySummary
        },
        visits: {
          logs: entryLogs.map(log => ({
            entry_id: log.entry_id,
            entry_time: log.entry_time,
            exit_time: log.exit_time,
            purpose: log.purpose,
            duration_minutes: log.exit_time 
              ? Math.round((new Date(log.exit_time).getTime() - new Date(log.entry_time).getTime()) / (1000 * 60))
              : null
          })),
          summary: visitSummary
        },
        locker_usage: {
          assignments: lockerTransactions.map(t => ({
            transaction_id: t.transaction_id,
            locker_number: t.locker.locker_number,
            location: t.locker.location,
            borrow_time: t.borrow_time,
            due_time: t.due_time,
            return_time: t.return_time,
            status: t.status,
            penalty: t.penalty
          })),
          summary: lockerSummary
        }
      })
    } catch (error) {
      console.error('Error fetching user statistics:', error)
      return createErrorResponse('Failed to fetch user statistics', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
