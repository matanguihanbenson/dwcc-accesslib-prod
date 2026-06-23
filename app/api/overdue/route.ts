import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

export async function GET(request: NextRequest) {
  try {
    let currentUserRole: string | null = null
    let isAuthenticated = false

    const session = await getServerSession(authOptions)
    
    if (session?.user?.username) {
      try {
        const userAccount = await prisma.userAccount.findFirst({
          where: {
            username: session.user.username,
            is_active: true,
          },
        })
        
        if (userAccount) {
          currentUserRole = userAccount.role
          isAuthenticated = true
        }
      } catch (dbError) {
        console.error('Database error during session lookup:', dbError)
      }
    }

    if (!isAuthenticated) {
      const token = request.cookies.get('token')?.value
      
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
          const userId = decoded.userId

          const userAccount = await prisma.userAccount.findFirst({
            where: { id: userId, is_active: true },
          })

          if (userAccount) {
            currentUserRole = userAccount.role
            isAuthenticated = true
          }
        } catch (jwtError) {
          console.warn('JWT verification failed:', jwtError)
        }
      }
    }

    if (!isAuthenticated || !currentUserRole) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (!['ADMIN', 'STAFF', 'SUPER_ADMIN'].includes(currentUserRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all'

    const currentDate = new Date()
    const response: any = {}

    const fineSettings = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: ['book_fine_per_day', 'locker_fine_per_hour', 'max_book_fine', 'max_locker_fine', 'grace_period_days', 'grace_period_hours', 'grace_period_minutes']
        }
      }
    })

    const bookFinePerDay = parseFloat(fineSettings.find(s => s.key === 'book_fine_per_day')?.value || '5')
    const lockerFinePerHour = parseFloat(fineSettings.find(s => s.key === 'locker_fine_per_hour')?.value || '20')
    const maxBookFine = parseFloat(fineSettings.find(s => s.key === 'max_book_fine')?.value || '100')
    const maxLockerFine = parseFloat(fineSettings.find(s => s.key === 'max_locker_fine')?.value || '500')
    const gracePeriodDays = parseInt(fineSettings.find(s => s.key === 'grace_period_days')?.value || '3')
    const gracePeriodHours = parseInt(fineSettings.find(s => s.key === 'grace_period_hours')?.value || '2')
    const gracePeriodMinutes = parseInt(fineSettings.find(s => s.key === 'grace_period_minutes')?.value || '15')

    if (type === 'books' || type === 'all') {
      const overdueSettlements = await prisma.overdueSettlement.findMany({
        where: {
          transaction_type: 'BOOK',
          status: { in: ['PENDING', 'PARTIAL'] } 
        },
        include: {
          user: {
            select: {
              user_id: true,
              full_name: true,
              email: true,
              user_type: true,
              department_ref: { select: { name: true } },
              program: { select: { name: true } },
              contact_number: true,
              account_id: true
            }
          }
        }
      })

      const overdueBooks = await prisma.bookTransaction.findMany({
        where: {
          // Only ACTIVE transactions are considered "overdue".
          // PENDING_APPROVAL transactions are requests that the
          // library admin hasn't approved yet — they shouldn't
          // surface here even if the staff pre-filled a past
          // due_date. Likewise COMPLETED / REJECTED are not
          // active borrows.
          status: 'ACTIVE',
          OR: [
            {
              due_date: { lt: currentDate },
              return_date: null
            },
            {
              transaction_id: {
                in: overdueSettlements.map(s => s.transaction_id)
              }
            }
          ]
        },
        include: {
          book: {
            select: {
              title: true,
              category: true,
              authors: {
                select: { name: true },
                orderBy: { display_order: 'asc' },
                take: 1
              }
            }
          },
          user: {
            select: {
              user_id: true,
              full_name: true,
              email: true,
              user_type: true,
              department_ref: {
                select: { name: true }
              },
              program: {
                select: { name: true }
              },
              contact_number: true,
              account_id: true
            }
          },
          department: {
            select: {
              department_id: true,
              name: true
            }
          },
          office: {
            select: {
              office_id: true,
              name: true
            }
          }
        },
        orderBy: {
          due_date: 'asc' 
        }
      })

      const settlementStatuses = await prisma.overdueSettlement.findMany({
        where: {
          transaction_type: 'BOOK',
          transaction_id: {
            in: overdueBooks.map(book => book.transaction_id)
          }
        }
      })

      const settlementMap = new Map(
        settlementStatuses.map(s => [s.transaction_id, s])
      )

      const overdueBooksWithCalculations = overdueBooks.map(transaction => {
        const dueDate = transaction.due_date ? new Date(transaction.due_date) : null
        const returnDate = transaction.return_date ? new Date(transaction.return_date) : null
        
        const endDate = returnDate || currentDate
        const totalDaysOverdue = dueDate ? Math.floor(
          (endDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
        ) : 0
        
        const daysOverdue = Math.max(0, totalDaysOverdue)
        
        const calculatedPenalty = Math.min(
          Math.max(Number(transaction.penalty), daysOverdue * bookFinePerDay),
          maxBookFine
        )
        
        const settlement = settlementMap.get(transaction.transaction_id)
        
        const bookData = {
          ...transaction.book,
          book_author: transaction.book.authors && transaction.book.authors.length > 0
            ? transaction.book.authors[0].name
            : 'Unknown Author'
        }
        
        return {
          ...transaction,
          book: bookData,
          days_overdue: Math.max(0, totalDaysOverdue),
          calculated_penalty: calculatedPenalty,
          settlement_status: settlement?.status || 'PENDING',
          settlement_id: settlement?.settlement_id || null,
          amount_paid: settlement ? Number(settlement.amount_paid) : 0,
          remaining_balance: settlement ? Number(settlement.remaining_balance) : calculatedPenalty,
          is_returned: !!returnDate,
          return_date: returnDate
        }
      })

      response.overdue_books = overdueBooksWithCalculations
    }

    if (type === 'lockers' || type === 'all') {
      const lockerOverdueSettlements = await prisma.overdueSettlement.findMany({
        where: {
          transaction_type: 'LOCKER',
          status: { in: ['PENDING', 'PARTIAL'] }
        }
      })

      const lockerWhereConditions: any[] = [
        // Locker transactions default to ACTIVE (no PENDING_APPROVAL
        // stage on the locker side) but we filter explicitly to
        // match the book-side contract: a locker that's COMPLETED
        // or any non-ACTIVE status shouldn't be reported as
        // overdue here.
        { status: 'ACTIVE' },
        { return_time: null }
      ]

      if (lockerOverdueSettlements.length > 0) {
        lockerWhereConditions.push({
          transaction_id: {
            in: lockerOverdueSettlements.map(s => s.transaction_id)
          }
        })
      }
      const allLockerTransactions = await prisma.lockerTransaction.findMany({
        where: {
          OR: lockerWhereConditions,
        },
        select: {
          transaction_id: true,
          borrow_time: true,
          return_time: true,
          due_time: true,
          penalty: true,
          status: true,
          user_id: true,
          locker_id: true,
          assigned_by: true,
          returned_by: true,
          notes: true,
          created_at: true,
          updated_at: true,
          locker: {
            select: {
              locker_number: true,
              status: true,
            },
          },
          user: {
            select: {
              user_id: true,
              full_name: true,
              email: true,
              user_type: true,
              department_ref: { select: { name: true } },
              program: { select: { name: true } },
              contact_number: true,
              account_id: true,
            },
          },
        },
        orderBy: {
          borrow_time: 'asc',
        },
      })

      const overdueLockers = allLockerTransactions.filter(locker => {
        const borrowTime = new Date(locker.borrow_time)
        const dueTime = locker.due_time ? new Date(locker.due_time) : null
        const returnTime = locker.return_time ? new Date(locker.return_time) : null
        
        if (returnTime) {
          const hasPendingSettlement = lockerOverdueSettlements.some(
            s => s.transaction_id === locker.transaction_id
          )
          if (hasPendingSettlement) {
            return true
          }
          return false
        }
        
        if (!returnTime) {
          if (dueTime) {
            return currentDate > dueTime
          } else {
            const graceHoursMs = gracePeriodHours * 60 * 60 * 1000
            const graceMinutesMs = gracePeriodMinutes * 60 * 1000
            const freeUseEndTime = new Date(borrowTime.getTime() + graceHoursMs + graceMinutesMs)
            return currentDate > freeUseEndTime
          }
        }
        
        return false
      })

      const lockerSettlementStatuses = overdueLockers.length > 0 
        ? await prisma.overdueSettlement.findMany({
            where: {
              transaction_type: 'LOCKER',
              transaction_id: {
                in: overdueLockers.map(locker => locker.transaction_id)
              }
            }
          })
        : []

      const lockerSettlementMap = new Map(
        lockerSettlementStatuses.map(s => [s.transaction_id, s])
      )

      // Calculate hours overdue and penalty for each locker
      const overdueLockerWithCalculations = overdueLockers.map(transaction => {
        const borrowTime = new Date(transaction.borrow_time)
        const dueTime = transaction.due_time ? new Date(transaction.due_time) : null
        const returnTime = transaction.return_time ? new Date(transaction.return_time) : null
        
        // Calculate time used (up to return time if returned, otherwise current time)
        const endTime = returnTime || currentDate
        const timeUsedMs = endTime.getTime() - borrowTime.getTime()
        const hoursUsed = timeUsedMs / (1000 * 60 * 60)
        
        // Calculate hours overdue and penalty (using system settings)
        let hoursOverdue = 0
        let calculatedPenalty = 0
        
        if (dueTime) {
          // If due_time exists (with extensions), add grace_period_minutes after due_time
          const gracePeriodMs = gracePeriodMinutes * 60 * 1000
          const fineStartTime = new Date(dueTime.getTime() + gracePeriodMs)
          const exceededMs = endTime.getTime() - fineStartTime.getTime()
          if (exceededMs > 0) {
            hoursOverdue = exceededMs / (1000 * 60 * 60)
            calculatedPenalty = Math.min(
              Math.floor(hoursOverdue) * lockerFinePerHour,
              maxLockerFine
            )
          }
        } else {
          // No due_time, so apply grace_period (hours + minutes) from borrow_time
          const gracePeriodMs = (gracePeriodHours * 60 * 60 * 1000) + (gracePeriodMinutes * 60 * 1000)
          const implicitDueTime = new Date(borrowTime.getTime() + gracePeriodMs)
          const exceededMs = endTime.getTime() - implicitDueTime.getTime()
          if (exceededMs > 0) {
            hoursOverdue = exceededMs / (1000 * 60 * 60)
            calculatedPenalty = Math.min(
              Math.floor(hoursOverdue) * lockerFinePerHour,
              maxLockerFine
            )
          }
        }
        
        const settlement = lockerSettlementMap.get(transaction.transaction_id)
        
        return {
          ...transaction,
          hours_used: Math.floor(hoursUsed * 10) / 10, 
          days_used: Math.floor(hoursUsed / 24), 
          hours_overdue: Math.floor(hoursOverdue * 10) / 10,
          calculated_penalty: Math.max(calculatedPenalty, Number(transaction.penalty)),
          settlement_status: settlement?.status || 'PENDING',
          settlement_id: settlement?.settlement_id || null,
          amount_paid: settlement ? Number(settlement.amount_paid) : 0,
          remaining_balance: settlement ? Number(settlement.remaining_balance) : calculatedPenalty,
          is_returned: !!returnTime,
          return_time: returnTime
        }
      })

      response.overdue_lockers = overdueLockerWithCalculations
    }

    response.summary = {
      total_overdue_books: response.overdue_books?.length || 0,
      total_overdue_lockers: response.overdue_lockers?.length || 0,
      total_book_penalties: response.overdue_books?.reduce((sum: number, book: any) => sum + book.remaining_balance, 0) || 0,
      total_locker_penalties: response.overdue_lockers?.reduce((sum: number, locker: any) => sum + locker.remaining_balance, 0) || 0
    }

    const responseObj = NextResponse.json(response)
    responseObj.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    responseObj.headers.set('Pragma', 'no-cache')
    responseObj.headers.set('Expires', '0')

    return responseObj
    
  } catch (error) {
    console.error('Error fetching overdue items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
