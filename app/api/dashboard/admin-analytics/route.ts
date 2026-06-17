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
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay())
    
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

    // Parallel data fetching for better performance
    const [
      // User Entry Analytics
      totalTodayEntries,
      totalWeekEntries,
      totalMonthEntries,
      uniqueUsersToday,
      uniqueUsersWeek,
      uniqueUsersMonth,
      hourlyTrends,
      
      // Locker Analytics
      totalLockers,
      occupiedLockers,
      recentLockerTransactions,
      
      // Book Analytics
      borrowedToday,
      borrowedWeek,
      borrowedMonth,
      popularBooks,
      totalActiveBooks,
      completedTransactions,
      
      // Overdue Analytics
      overdueBooks,
      overdueLockers,
      
      // Weekly chart data
      weeklyEntryData
    ] = await Promise.all([
      // User Entry Queries
      prisma.entryLog.count({
        where: { entry_time: { gte: today, lt: tomorrow } }
      }),
      prisma.entryLog.count({
        where: { entry_time: { gte: weekStart } }
      }),
      prisma.entryLog.count({
        where: { entry_time: { gte: monthStart } }
      }),
      prisma.entryLog.groupBy({
        by: ['user_id'],
        where: { entry_time: { gte: today, lt: tomorrow } },
        _count: { user_id: true }
      }).then(result => result.length),
      prisma.entryLog.groupBy({
        by: ['user_id'],
        where: { entry_time: { gte: weekStart } },
        _count: { user_id: true }
      }).then(result => result.length),
      prisma.entryLog.groupBy({
        by: ['user_id'],
        where: { entry_time: { gte: monthStart } },
        _count: { user_id: true }
      }).then(result => result.length),
      
      // Hourly trends for today
      prisma.entryLog.findMany({
        where: { entry_time: { gte: today, lt: tomorrow } },
        select: { entry_time: true }
      }).then(logs => {
        const hourCounts: { [hour: string]: number } = {}
        logs.forEach(log => {
          const hour = log.entry_time.getHours()
          hourCounts[hour] = (hourCounts[hour] || 0) + 1
        })
        return Object.entries(hourCounts).map(([hour, count]) => ({
          hour: parseInt(hour),
          entries: count
        }))
      }),
      
      // Locker Queries
      prisma.locker.count({
        where: { status: { not: 'ARCHIVED' } }
      }),
      prisma.lockerTransaction.count({
        where: { return_time: null }
      }),
      prisma.lockerTransaction.findMany({
        where: {
          borrow_time: { gte: monthStart }
        },
        include: {
          locker: { select: { locker_number: true } }
        },
        orderBy: { borrow_time: 'desc' },
        take: 100
      }),
      
      // Book Queries
      prisma.bookTransaction.count({
        where: {
          borrow_date: { gte: today, lt: tomorrow }
        }
      }),
      prisma.bookTransaction.count({
        where: {
          borrow_date: { gte: weekStart }
        }
      }),
      prisma.bookTransaction.count({
        where: {
          borrow_date: { gte: monthStart }
        }
      }),
      prisma.bookTransaction.groupBy({
        by: ['book_id'],
        where: {
          borrow_date: { gte: monthStart }
        },
        _count: { book_id: true },
        orderBy: { _count: { book_id: 'desc' } },
        take: 1
      }),
      prisma.bookTransaction.count({
        where: { status: 'ACTIVE' }
      }),
      prisma.bookTransaction.findMany({
        where: {
          status: 'COMPLETED',
          return_date: { gte: monthStart }
        },
        select: {
          borrow_date: true,
          return_date: true
        }
      }),
      
      // Overdue Queries
      prisma.bookTransaction.findMany({
        where: {
          status: 'ACTIVE',
          due_date: { lt: now },
          return_date: null
        },
        include: {
          book: { select: { title: true } },
          user: { select: { full_name: true } }
        }
      }),
      prisma.lockerTransaction.findMany({
        where: {
          return_time: null,
          borrow_time: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
        },
        include: {
          locker: { select: { locker_number: true } },
          user: { select: { full_name: true } }
        }
      }),
      
      // Weekly chart data (last 7 days)
      Promise.all(
        Array.from({ length: 7 }, (_, i) => {
          const date = new Date()
          date.setDate(date.getDate() - (6 - i))
          date.setHours(0, 0, 0, 0)
          const nextDay = new Date(date)
          nextDay.setDate(date.getDate() + 1)
          
          return Promise.all([
            prisma.entryLog.count({
              where: { entry_time: { gte: date, lt: nextDay } }
            }),
            prisma.entryLog.groupBy({
              by: ['user_id'],
              where: { entry_time: { gte: date, lt: nextDay } },
              _count: { user_id: true }
            }).then(result => result.length)
          ]).then(([entries, unique]) => ({
            name: date.toLocaleDateString('en-US', { weekday: 'short' }),
            entries,
            unique
          }))
        })
      )
    ])

    // Calculate additional metrics
    const peakHour = hourlyTrends.length > 0 
      ? hourlyTrends.reduce((max, current) => 
          current.entries > max.entries ? current : max
        ).hour 
      : 8

    // Calculate average borrow duration
    const avgBorrowDuration = completedTransactions.length > 0
      ? completedTransactions.reduce((sum, tx) => {
          if (tx.borrow_date && tx.return_date) {
            const duration = new Date(tx.return_date).getTime() - new Date(tx.borrow_date).getTime()
            return sum + duration
          }
          return sum
        }, 0) / completedTransactions.length / (1000 * 60 * 60 * 24) // Convert to days
      : 7 // Default 7 days

    // Get most popular book
    let popularBookTitle = 'No data available'
    if (popularBooks.length > 0) {
      const popularBook = await prisma.book.findUnique({
        where: { book_id: popularBooks[0].book_id },
        select: { title: true }
      })
      popularBookTitle = popularBook?.title || 'Unknown'
    }

    // Calculate return rate
    const totalBorrowsThisMonth = borrowedMonth
    const returnedThisMonth = completedTransactions.length
    const returnRate = totalBorrowsThisMonth > 0 ? (returnedThisMonth / totalBorrowsThisMonth) * 100 : 0

    // Calculate average usage time for lockers
    const avgUsageTimeHours = recentLockerTransactions.length > 0
      ? recentLockerTransactions.reduce((sum, tx) => {
          const endTime = tx.return_time || now
          const hours = (endTime.getTime() - tx.borrow_time.getTime()) / (1000 * 60 * 60)
          return sum + hours
        }, 0) / recentLockerTransactions.length
      : 0

    // Find most used locker
    const lockerUsageCount = recentLockerTransactions.reduce((acc, tx) => {
      const lockerNum = tx.locker?.locker_number || 'Unknown'
      acc[lockerNum] = (acc[lockerNum] || 0) + 1
      return acc
    }, {} as { [key: string]: number })

    const mostUsedLocker = Object.entries(lockerUsageCount).length > 0
      ? Object.entries(lockerUsageCount).reduce((max, [locker, count]) => 
          count > max[1] ? [locker, count] : max, ['N/A', 0]
        )[0]
      : 'N/A'

    // Calculate overdue metrics
    const totalFines = overdueBooks.reduce((sum, book) => {
      if (book.due_date) {
        const daysOverdue = Math.ceil((now.getTime() - new Date(book.due_date).getTime()) / (1000 * 60 * 60 * 24))
        return sum + (daysOverdue * 10) // 10 pesos per day
      }
      return sum
    }, 0)

    const oldestOverdueBook = overdueBooks.length > 0
      ? overdueBooks.reduce((oldest, current) => {
          if (!oldest.due_date || !current.due_date) return oldest
          return new Date(current.due_date) < new Date(oldest.due_date) ? current : oldest
        })
      : null

    const avgOverdueDays = overdueBooks.length > 0
      ? overdueBooks.reduce((sum, book) => {
          if (book.due_date) {
            const days = Math.ceil((now.getTime() - new Date(book.due_date).getTime()) / (1000 * 60 * 60 * 24))
            return sum + days
          }
          return sum
        }, 0) / overdueBooks.length
      : 0

    // Create hourly chart data for today
    const hourlyChartData = []
    for (let hour = 6; hour <= 20; hour += 2) {
      const hourData = hourlyTrends.find(h => h.hour >= hour && h.hour < hour + 2)
      hourlyChartData.push({
        name: `${hour}:00`,
        entries: hourData?.entries || 0,
        unique: hourData?.entries || 0 // Simplified for now
      })
    }

    const analytics = {
      userEntry: {
        totalToday: totalTodayEntries,
        totalThisWeek: totalWeekEntries,
        totalThisMonth: totalMonthEntries,
        uniqueUsersToday: uniqueUsersToday,
        uniqueUsersWeek: uniqueUsersWeek,
        uniqueUsersMonth: uniqueUsersMonth,
        peakHour: `${peakHour}:00`,
        trend: totalTodayEntries > (totalWeekEntries / 7) ? 'up' : 
               totalTodayEntries < (totalWeekEntries / 7) ? 'down' : 'stable'
      },
      lockerUsage: {
        totalLockers,
        occupiedLockers,
        availableLockers: totalLockers - occupiedLockers,
        averageUsageTime: `${Math.round(avgUsageTimeHours)}h`,
        mostUsedLocker: `#${mostUsedLocker}`,
        utilizationRate: totalLockers > 0 ? Math.round((occupiedLockers / totalLockers) * 100) : 0
      },
      bookBorrowed: {
        borrowedToday,
        borrowedThisWeek: borrowedWeek,
        borrowedThisMonth: borrowedMonth,
        popularBook: popularBookTitle,
        averageBorrowDuration: `${Math.round(avgBorrowDuration)} days`,
        returnRate: Math.round(returnRate)
      },
      overdues: {
        totalOverdue: overdueBooks.length + overdueLockers.length,
        overdueBooks: overdueBooks.length,
        overdueLockers: overdueLockers.length,
        totalFines,
        oldestOverdue: oldestOverdueBook?.book?.title || 'None',
        averageOverdueDays: Math.round(avgOverdueDays)
      },
      chartData: {
        day: hourlyChartData,
        week: weeklyEntryData,
        month: weeklyEntryData, // Could be expanded to monthly data
        year: weeklyEntryData   // Could be expanded to yearly data
      }
    }

    return NextResponse.json(analytics)

  } catch (error) {
    console.error('Error fetching admin analytics:', error)
    
    // Return fallback data to prevent crashes
    const fallbackData = {
      userEntry: {
        totalToday: 0,
        totalThisWeek: 0,
        totalThisMonth: 0,
        uniqueUsersToday: 0,
        uniqueUsersWeek: 0,
        uniqueUsersMonth: 0,
        peakHour: '8:00',
        trend: 'stable'
      },
      lockerUsage: {
        totalLockers: 0,
        occupiedLockers: 0,
        availableLockers: 0,
        averageUsageTime: '0h',
        mostUsedLocker: '#N/A',
        utilizationRate: 0
      },
      bookBorrowed: {
        borrowedToday: 0,
        borrowedThisWeek: 0,
        borrowedThisMonth: 0,
        popularBook: 'No data available',
        averageBorrowDuration: '7 days',
        returnRate: 0
      },
      overdues: {
        totalOverdue: 0,
        overdueBooks: 0,
        overdueLockers: 0,
        totalFines: 0,
        oldestOverdue: 'None',
        averageOverdueDays: 0
      },
      chartData: {
        day: [],
        week: [],
        month: [],
        year: []
      }
    }
    
    return NextResponse.json(fallbackData)
  }
}
