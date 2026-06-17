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
        const userAccount = await prisma.userAccount.findUnique({
          where: {
            username: session.user.username,
            is_active: true
          }
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

          const userAccount = await prisma.userAccount.findUnique({
            where: { id: userId, is_active: true }
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

    if (!['ADMIN', 'SUPER_ADMIN'].includes(currentUserRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const currentDate = new Date()
    const thirtyDaysAgo = new Date(currentDate.getTime() - (30 * 24 * 60 * 60 * 1000))
    const sevenDaysAgo = new Date(currentDate.getTime() - (7 * 24 * 60 * 60 * 1000))

    const overdueBooks = await prisma.bookTransaction.findMany({
      where: {
        due_date: {
          lt: currentDate
        },
        return_date: null
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
            full_name: true,
            user_type: true,
            account_id: true,
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
        }
      },
      orderBy: {
        due_date: 'asc'
      }
    })

    const overdueLockers = await prisma.lockerTransaction.findMany({
      where: {
        return_time: null,
        borrow_time: {
          lt: new Date(currentDate.getTime() - 24 * 60 * 60 * 1000)
        }
      },
      include: {
        locker: {
          select: {
            locker_number: true,
            status: true
          }
        },
        user: {
          select: {
            full_name: true,
            user_type: true,
            account_id: true,
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
        }
      },
      orderBy: {
        borrow_time: 'asc'
      }
    })

    const bookAnalytics = calculateBookAnalytics(overdueBooks, currentDate)
    const lockerAnalytics = calculateLockerAnalytics(overdueLockers, currentDate)

    const bookTrends = await getBookOverdueTrends(currentDate, thirtyDaysAgo)
    const lockerTrends = await getLockerOverdueTrends(currentDate, thirtyDaysAgo)

    const recentOverduePatterns = await getRecentOverduePatterns(sevenDaysAgo, currentDate)

    const departmentBreakdown = getDepartmentBreakdown([...overdueBooks, ...overdueLockers])
    const userTypeBreakdown = getUserTypeBreakdown([...overdueBooks, ...overdueLockers])

    const response = {
      summary: {
        total_overdue_books: overdueBooks.length,
        total_overdue_lockers: overdueLockers.length,
        total_book_penalties: bookAnalytics.totalPenalties,
        total_locker_penalties: lockerAnalytics.totalPenalties,
        average_overdue_days_books: bookAnalytics.averageOverdueDays,
        average_usage_hours_lockers: lockerAnalytics.averageUsageHours
      },
      analytics: {
        books: bookAnalytics,
        lockers: lockerAnalytics
      },
      trends: {
        books: bookTrends,
        lockers: lockerTrends
      },
      breakdowns: {
        departments: departmentBreakdown,
        user_types: userTypeBreakdown
      },
      recent_patterns: recentOverduePatterns,
      overdue_items: {
        books: overdueBooks.map(transaction => {
          const dueDate = transaction.due_date ? new Date(transaction.due_date) : null
          const daysOverdue = dueDate ? Math.floor((currentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0
          return {
            ...transaction,
            days_overdue: daysOverdue,
            calculated_penalty: Math.max(Number(transaction.penalty || 0), daysOverdue * 10)
          }
        }),
        lockers: overdueLockers.map(transaction => {
          const borrowTime = transaction.borrow_time ? new Date(transaction.borrow_time) : null
          const hoursUsed = borrowTime ? Math.floor((currentDate.getTime() - borrowTime.getTime()) / (1000 * 60 * 60)) : 0
          const daysUsed = Math.floor(hoursUsed / 24)
          return {
            ...transaction,
            hours_used: hoursUsed,
            days_used: daysUsed,
            calculated_penalty: Math.max(Number(transaction.penalty || 0), daysUsed * 5)
          }
        })
      }
    }

    const responseObj = NextResponse.json(response)
    responseObj.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    responseObj.headers.set('Pragma', 'no-cache')
    responseObj.headers.set('Expires', '0')

    return responseObj
    
  } catch (error) {
    console.error('Error fetching admin overdue tracking data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function calculateBookAnalytics(overdueBooks: any[], currentDate: Date) {
  if (overdueBooks.length === 0) {
    return {
      totalPenalties: 0,
      averageOverdueDays: 0,
      severityBreakdown: { low: 0, medium: 0, high: 0, critical: 0 },
      categoryBreakdown: {}
    }
  }

  let totalPenalties = 0
  let totalOverdueDays = 0
  const severityBreakdown = { low: 0, medium: 0, high: 0, critical: 0 }
  const categoryBreakdown: Record<string, number> = {}

  overdueBooks.forEach(transaction => {
    const daysOverdue = Math.floor((currentDate.getTime() - transaction.due_date.getTime()) / (1000 * 60 * 60 * 24))
    const penalty = Math.max(Number(transaction.penalty), daysOverdue * 10)
    
    totalPenalties += penalty
    totalOverdueDays += daysOverdue

    if (daysOverdue <= 14) severityBreakdown.low++
    else if (daysOverdue <= 30) severityBreakdown.medium++
    else if (daysOverdue <= 60) severityBreakdown.high++
    else severityBreakdown.critical++

    const category = transaction.book.category
    categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1
  })

  return {
    totalPenalties,
    averageOverdueDays: Math.round(totalOverdueDays / overdueBooks.length),
    severityBreakdown,
    categoryBreakdown
  }
}

function calculateLockerAnalytics(overdueLockers: any[], currentDate: Date) {
  if (overdueLockers.length === 0) {
    return {
      totalPenalties: 0,
      averageUsageHours: 0,
      severityBreakdown: { low: 0, medium: 0, high: 0, critical: 0 }
    }
  }

  let totalPenalties = 0
  let totalUsageHours = 0
  const severityBreakdown = { low: 0, medium: 0, high: 0, critical: 0 }

  overdueLockers.forEach(transaction => {
    const hoursUsed = Math.floor((currentDate.getTime() - transaction.borrow_time.getTime()) / (1000 * 60 * 60))
    const daysUsed = Math.floor(hoursUsed / 24)
    const penalty = Math.max(Number(transaction.penalty), daysUsed * 5)
    
    totalPenalties += penalty
    totalUsageHours += hoursUsed

    if (daysUsed <= 3) severityBreakdown.low++
    else if (daysUsed <= 7) severityBreakdown.medium++
    else if (daysUsed <= 14) severityBreakdown.high++
    else severityBreakdown.critical++
  })

  return {
    totalPenalties,
    averageUsageHours: Math.round(totalUsageHours / overdueLockers.length),
    severityBreakdown
  }
}

async function getBookOverdueTrends(currentDate: Date, thirtyDaysAgo: Date) {
  return {
    daily_counts: [],
    weekly_totals: [],
    penalty_trends: []
  }
}

async function getLockerOverdueTrends(currentDate: Date, thirtyDaysAgo: Date) {
  return {
    daily_counts: [],
    weekly_totals: [],
    penalty_trends: []
  }
}

async function getRecentOverduePatterns(sevenDaysAgo: Date, currentDate: Date) {
  return {
    new_overdue_books: 0,
    new_overdue_lockers: 0,
    resolved_books: 0,
    resolved_lockers: 0
  }
}

function getDepartmentBreakdown(allOverdueItems: any[]) {
  const breakdown: Record<string, { books: number, lockers: number, total: number }> = {}
  
  allOverdueItems.forEach(item => {
    const department = item.user?.department || item.user?.course || 'Unknown'
    if (!breakdown[department]) {
      breakdown[department] = { books: 0, lockers: 0, total: 0 }
    }
    
    if (item.book) breakdown[department].books++
    if (item.locker) breakdown[department].lockers++
    breakdown[department].total++
  })

  return breakdown
}

function getUserTypeBreakdown(allOverdueItems: any[]) {
  const breakdown: Record<string, { books: number, lockers: number, total: number }> = {}
  
  allOverdueItems.forEach(item => {
    const userType = item.user?.user_type || 'Unknown'
    if (!breakdown[userType]) {
      breakdown[userType] = { books: 0, lockers: 0, total: 0 }
    }
    
    if (item.book) breakdown[userType].books++
    if (item.locker) breakdown[userType].lockers++
    breakdown[userType].total++
  })

  return breakdown
}
