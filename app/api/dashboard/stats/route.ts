import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role as UserRole

    // Get current date for today's calculations
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get current month for monthly calculations
    const currentMonth = new Date()
    currentMonth.setDate(1)
    currentMonth.setHours(0, 0, 0, 0)

    let stats: any = {}

    switch (userRole) {
      case UserRole.SUPER_ADMIN:
        // System-wide statistics for SUPER_ADMIN
        const [
          totalUsers,
          adminAccounts,
          totalDepartments,
          totalPrograms
        ] = await Promise.all([
          prisma.user.count({
            where: { status: { not: 'ARCHIVED' } }
          }),
          prisma.userAccount.count({
            where: { 
              role: { in: ['ADMIN', 'SUPER_ADMIN'] },
              is_active: true
            }
          }),
          prisma.department.count({
            where: { is_active: true }
          }),
          prisma.program.count({
            where: { is_active: true }
          })
        ])

        stats = {
          totalUsers,
          adminAccounts,
          totalDepartments,
          totalPrograms
        }
        break

      case UserRole.ADMIN:
        // Library management statistics for ADMIN
        const [
          libraryUsers,
          staffAccounts,
          overdueItems,
          todayEntries,
          totalBooks,
          availableBooks,
          borrowedBooks,
          lockerUsage,
          totalLockers,
          overdueBreakdown
        ] = await Promise.all([
          prisma.user.count({
            where: { 
              status: 'ACTIVE',
              user_type: { in: ['STUDENT', 'EMPLOYEE'] }
            }
          }),
          prisma.userAccount.count({
            where: { 
              role: 'STAFF',
              is_active: true
            }
          }),
          // Count overdue books and lockers
          Promise.all([
            prisma.bookTransaction.count({
              where: {
                return_date: null,
                due_date: { lt: new Date() }
              }
            }),
            prisma.lockerTransaction.count({
              where: {
                return_time: null,
                due_time: { lt: new Date() }
              }
            })
          ]).then(([overdueBooks, overdueLockers]) => overdueBooks + overdueLockers),
          prisma.entryLog.count({
            where: {
              entry_time: {
                gte: today,
                lt: tomorrow
              }
            }
          }),
          // Additional book statistics
          prisma.book.count({
            where: { status: { not: 'ARCHIVED' } }
          }),
          prisma.book.count({
            where: { status: 'AVAILABLE' }
          }),
          prisma.bookTransaction.count({
            where: { 
              return_date: null,
              status: 'ACTIVE'
            }
          }),
          // Locker statistics
          prisma.lockerTransaction.count({
            where: { return_time: null }
          }),
          prisma.locker.count({
            where: { status: { not: 'ARCHIVED' } }
          }),
          // Overdue breakdown
          Promise.all([
            prisma.bookTransaction.count({
              where: {
                return_date: null,
                due_date: { lt: new Date() }
              }
            }),
            prisma.lockerTransaction.count({
              where: {
                return_time: null,
                due_time: { lt: new Date() }
              }
            })
          ]).then(([overdueBooks, overdueLockers]) => ({ overdueBooks, overdueLockers }))
        ])

        stats = {
          libraryUsers,
          staffAccounts,
          overdueItems,
          todayEntries,
          totalBooks,
          availableBooks,
          borrowedBooks,
          lockerUsage,
          totalLockers,
          lockerUtilization: totalLockers > 0 ? Math.round((lockerUsage / totalLockers) * 100) : 0,
          overdueBooks: overdueBreakdown.overdueBooks,
          overdueLockers: overdueBreakdown.overdueLockers
        }
        break

      case UserRole.STAFF:
        // Daily operations statistics for STAFF
        const [
          activeLockers,
          borrowedBooksStaff,
          todayEntriesStaff,
          overdueItemsStaff
        ] = await Promise.all([
          prisma.lockerTransaction.count({
            where: {
              return_time: null
            }
          }),
          prisma.bookTransaction.count({
            where: {
              return_date: null,
              status: 'ACTIVE'
            }
          }),
          prisma.bookTransaction.count({
            where: {
              status: 'PENDING_APPROVAL'
            }
          }),
          prisma.entryLog.count({
            where: {
              entry_time: {
                gte: today,
                lt: tomorrow
              }
            }
          }),
          Promise.all([
            prisma.bookTransaction.count({
              where: {
                return_date: null,
                due_date: { lt: new Date() }
              }
            }),
            prisma.lockerTransaction.count({
              where: {
                return_time: null,
                due_time: { lt: new Date() }
              }
            })
          ]).then(([overdueBooks, overdueLockers]) => overdueBooks + overdueLockers)
        ])

        stats = {
          activeLockers,
          borrowedBooks: borrowedBooksStaff,
          todayEntries: todayEntriesStaff,
          overdueItems: overdueItemsStaff
        }
        break

      default:
        // Personal statistics for STUDENT or other roles
        const currentUser = await prisma.user.findUnique({
          where: { account_id: session.user.username },
          include: {
            book_transactions: {
              where: { return_date: null },
              include: { book: true }
            },
            locker_transactions: {
              where: { return_time: null },
              include: { locker: true }
            }
          }
        })

        if (!currentUser) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const [
          myBorrowedBooks,
          myOverdueItems,
          myLibraryVisits
        ] = await Promise.all([
          currentUser.book_transactions.length,
          Promise.all([
            prisma.bookTransaction.count({
              where: {
                user_id: currentUser.user_id,
                return_date: null,
                due_date: { lt: new Date() }
              }
            }),
            prisma.lockerTransaction.count({
              where: {
                user_id: currentUser.user_id,
                return_time: null,
                due_time: { lt: new Date() }
              }
            })
          ]).then(([overdueBooks, overdueLockers]) => overdueBooks + overdueLockers),
          prisma.entryLog.count({
            where: {
              user_id: currentUser.user_id,
              entry_time: {
                gte: currentMonth
              }
            }
          })
        ])

        const myLockerStatus = currentUser.locker_transactions.length > 0 
          ? currentUser.locker_transactions[0].locker.locker_number 
          : "None"

        stats = {
          myBorrowedBooks,
          myLockerStatus,
          myOverdueItems,
          myLibraryVisits
        }
        break
    }

    // Return with no-cache headers to ensure fresh data
    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
