import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/overdue/user-summary/[user_id] - Get all penalties for a specific user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ user_id: string }> }
) {
  try {
    console.log('User summary - Starting...')
    const session = await getServerSession(authOptions)
    
    console.log('User summary - Session:', { 
      exists: !!session, 
      id: session?.user?.id, 
      role: session?.user?.role 
    })
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const userId = parseInt(resolvedParams.user_id)
    
    console.log('User summary - User ID:', userId, 'Valid:', !isNaN(userId))

    // Fetch user information first
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: {
        full_name: true,
        account_id: true,
        email: true,
        user_type: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const currentDate = new Date()

    // 1. Fetch all pending/partial settlements for this user
    const settlements = await prisma.overdueSettlement.findMany({
      where: {
        user_id: userId,
        status: { in: ['PENDING', 'PARTIAL'] }
      },
      orderBy: {
        created_at: 'asc'
      }
    })

    console.log('User summary - Total settlements found:', settlements.length)

    const bookSettlements = settlements.filter(s => s.transaction_type === 'BOOK')
    const lockerSettlements = settlements.filter(s => s.transaction_type === 'LOCKER')

    // 2. Fetch UNRETURNED OVERDUE book transactions (may not have settlements yet)
    const unreturnedOverdueBooks = await prisma.bookTransaction.findMany({
      where: {
        user_id: userId,
        due_date: { lt: currentDate },
        return_date: null // Not yet returned
      },
      include: {
        book: {
          select: {
            title: true,
            authors: {
              select: { name: true },
              orderBy: { display_order: 'asc' },
              take: 1
            }
          }
        }
      }
    })

    console.log('User summary - Unreturned overdue books:', unreturnedOverdueBooks.length)

    // 3. Fetch book transactions WITH settlements
    const bookTransactionsWithSettlements = bookSettlements.length > 0 ? await prisma.bookTransaction.findMany({
      where: {
        transaction_id: {
          in: bookSettlements.map(s => s.transaction_id)
        }
      },
      include: {
        book: {
          select: {
            title: true,
            authors: {
              select: { name: true },
              orderBy: { display_order: 'asc' },
              take: 1
            }
          }
        }
      }
    }) : []

    // 4. Fetch UNRETURNED OVERDUE locker transactions
    const allLockerTransactions = await prisma.lockerTransaction.findMany({
      where: {
        user_id: userId,
        return_time: null // Not yet returned
      },
      include: {
        locker: {
          select: {
            locker_number: true,
            location: true
          }
        }
      }
    })

    // Filter for overdues: past 2 hours free use or past due_time
    const unreturnedOverdueLockers = allLockerTransactions.filter(locker => {
      const borrowTime = new Date(locker.borrow_time)
      const dueTime = locker.due_time ? new Date(locker.due_time) : null
      
      if (dueTime) {
        return currentDate > dueTime
      } else {
        const twoHoursMs = 2 * 60 * 60 * 1000
        const freeUseEndTime = new Date(borrowTime.getTime() + twoHoursMs)
        return currentDate > freeUseEndTime
      }
    })

    console.log('User summary - Unreturned overdue lockers:', unreturnedOverdueLockers.length)

    // 5. Fetch locker transactions WITH settlements
    const lockerTransactionsWithSettlements = lockerSettlements.length > 0 ? await prisma.lockerTransaction.findMany({
      where: {
        transaction_id: {
          in: lockerSettlements.map(s => s.transaction_id)
        }
      },
      include: {
        locker: {
          select: {
            locker_number: true,
            location: true
          }
        }
      }
    }) : []

    // Create a map of settlement by transaction_id
    const settlementMap = new Map(settlements.map(s => [s.transaction_id, s]))

    // 6. Build book penalties list
    const bookPenalties: Array<{
      settlement_id: number | null
      transaction_id: number
      transaction_type: 'BOOK'
      item_name: string
      item_author?: string
      penalty_amount: number
      amount_paid: number
      remaining_balance: number
      status: string
      due_date: Date | null | undefined
      return_date: Date | null | undefined
      created_at: Date
      is_returned: boolean
    }> = []

    // Add unreturned overdue books (without settlements yet)
    unreturnedOverdueBooks.forEach(transaction => {
      const existingSettlement = settlementMap.get(transaction.transaction_id)
      
      // If already in settlements, skip (will be added below)
      if (existingSettlement) return

      // Skip if no due date
      if (!transaction.due_date) {
        console.warn(`Transaction ${transaction.transaction_id} has no due date, skipping`)
        return
      }

      const dueDate = new Date(transaction.due_date)
      const daysOverdue = Math.floor((currentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      const calculatedPenalty = Math.max(0, daysOverdue * 10) // 10 pesos per day

      bookPenalties.push({
        settlement_id: null, // No settlement yet
        transaction_id: transaction.transaction_id,
        transaction_type: 'BOOK' as const,
        item_name: transaction.book.title || 'Unknown Book',
        item_author: transaction.book.authors?.[0]?.name,
        penalty_amount: calculatedPenalty,
        amount_paid: 0,
        remaining_balance: calculatedPenalty,
        status: 'PENDING' as const,
        due_date: transaction.due_date,
        return_date: null,
        created_at: transaction.borrow_date || new Date(),
        is_returned: false
      })
    })

    // Add books with settlements
    bookSettlements.forEach(settlement => {
      const transaction = bookTransactionsWithSettlements.find(t => t.transaction_id === settlement.transaction_id)
      bookPenalties.push({
        settlement_id: settlement.settlement_id,
        transaction_id: settlement.transaction_id,
        transaction_type: 'BOOK' as const,
        item_name: transaction?.book.title || 'Unknown Book',
        item_author: transaction?.book.authors?.[0]?.name,
        penalty_amount: Number(settlement.penalty_amount),
        amount_paid: Number(settlement.amount_paid),
        remaining_balance: Number(settlement.remaining_balance),
        status: settlement.status,
        due_date: transaction?.due_date,
        return_date: transaction?.return_date,
        created_at: settlement.created_at,
        is_returned: !!transaction?.return_date
      })
    })

    // 7. Build locker penalties list
    const lockerPenalties: Array<{
      settlement_id: number | null
      transaction_id: number
      transaction_type: 'LOCKER'
      item_name: string
      item_location?: string
      penalty_amount: number
      amount_paid: number
      remaining_balance: number
      status: string
      borrow_time: Date | null | undefined
      due_time?: Date | null
      return_time: Date | null | undefined
      created_at: Date
      is_returned: boolean
      hours_overdue?: number
    }> = []

    // Add unreturned overdue lockers (without settlements yet)
    unreturnedOverdueLockers.forEach(transaction => {
      const existingSettlement = settlementMap.get(transaction.transaction_id)
      
      // If already in settlements, skip
      if (existingSettlement) return

      // Skip if no borrow time
      if (!transaction.borrow_time) {
        console.warn(`Locker transaction ${transaction.transaction_id} has no borrow time, skipping`)
        return
      }

      const borrowTime = new Date(transaction.borrow_time)
      const dueTime = transaction.due_time ? new Date(transaction.due_time) : null
      
      const timeUsedMs = currentDate.getTime() - borrowTime.getTime()
      const hoursUsed = timeUsedMs / (1000 * 60 * 60)
      
      let hoursOverdue = 0
      let calculatedPenalty = 0
      
      if (dueTime) {
        const exceededMs = currentDate.getTime() - dueTime.getTime()
        if (exceededMs > 0) {
          hoursOverdue = exceededMs / (1000 * 60 * 60)
          calculatedPenalty = Math.floor(hoursOverdue) * 20
        }
      } else {
        const freeHours = 2
        if (hoursUsed > freeHours) {
          hoursOverdue = hoursUsed - freeHours
          calculatedPenalty = Math.floor(hoursOverdue) * 20
        }
      }

      lockerPenalties.push({
        settlement_id: null,
        transaction_id: transaction.transaction_id,
        transaction_type: 'LOCKER' as const,
        item_name: transaction.locker.locker_number || 'Unknown Locker',
        item_location: transaction.locker.location,
        penalty_amount: calculatedPenalty,
        amount_paid: 0,
        remaining_balance: calculatedPenalty,
        status: 'PENDING' as const,
        borrow_time: transaction.borrow_time,
        return_time: null,
        created_at: transaction.borrow_time,
        is_returned: false,
        hours_overdue: Math.floor(hoursOverdue * 10) / 10
      })
    })

    // Add lockers with settlements
    lockerSettlements.forEach(settlement => {
      const transaction = lockerTransactionsWithSettlements.find(t => t.transaction_id === settlement.transaction_id)
      lockerPenalties.push({
        settlement_id: settlement.settlement_id,
        transaction_id: settlement.transaction_id,
        transaction_type: 'LOCKER' as const,
        item_name: transaction?.locker.locker_number || 'Unknown Locker',
        item_location: transaction?.locker.location,
        penalty_amount: Number(settlement.penalty_amount),
        amount_paid: Number(settlement.amount_paid),
        remaining_balance: Number(settlement.remaining_balance),
        status: settlement.status,
        borrow_time: transaction?.borrow_time,
        return_time: transaction?.return_time,
        created_at: settlement.created_at,
        is_returned: !!transaction?.return_time
      })
    })

    // Calculate totals
    const totalBookPenalties = bookPenalties.reduce((sum, p) => sum + p.remaining_balance, 0)
    const totalLockerPenalties = lockerPenalties.reduce((sum, p) => sum + p.remaining_balance, 0)
    const totalPenalties = totalBookPenalties + totalLockerPenalties

    console.log('User summary - Final counts:', {
      book_penalties: bookPenalties.length,
      locker_penalties: lockerPenalties.length,
      total_book_amount: totalBookPenalties,
      total_locker_amount: totalLockerPenalties,
      unreturned_books: unreturnedOverdueBooks.length,
      unreturned_lockers: unreturnedOverdueLockers.length
    })

    return NextResponse.json({
      success: true,
      data: {
        user: user,
        book_penalties: bookPenalties,
        locker_penalties: lockerPenalties,
        summary: {
          total_book_penalties: totalBookPenalties,
          total_locker_penalties: totalLockerPenalties,
          total_penalties: totalPenalties,
          book_count: bookPenalties.length,
          locker_count: lockerPenalties.length,
          total_count: bookPenalties.length + lockerPenalties.length
        }
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Error fetching user penalty summary:', error)
    console.error('Error details:', error instanceof Error ? error.message : String(error))
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

