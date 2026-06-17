import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

export async function POST(request: NextRequest) {
  try {
    let currentUserRole: string | null = null
    let currentUserId: number | null = null
    let isAuthenticated = false

    // Try NextAuth session first
    const session = await getServerSession(authOptions)
    
    if (session?.user?.username) {
      try {
        const userAccount = await prisma.userAccount.findFirst({
          where: {
            username: session.user.username,
            is_active: true,
          },
          include: {
            user: true,
          },
        })
        
        if (userAccount) {
          currentUserRole = userAccount.role
          currentUserId = userAccount.user_id  // Use user_id, not userAccount.id
          isAuthenticated = true
        }
      } catch (dbError) {
        console.error('Database error during session lookup:', dbError)
      }
    }

    // If no session, try JWT token from cookies
    if (!isAuthenticated) {
      const token = request.cookies.get('token')?.value
      
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
          const userId = decoded.userId

          const userAccount = await prisma.userAccount.findFirst({
            where: { id: userId, is_active: true },
            include: { user: true },
          })

          if (userAccount) {
            currentUserRole = userAccount.role
            currentUserId = userAccount.user_id  // Use user_id, not userAccount.id
            isAuthenticated = true
          }
        } catch (jwtError) {
          console.warn('JWT verification failed:', jwtError)
        }
      }
    }

    if (!isAuthenticated || !currentUserRole || !currentUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Check permissions - Only ADMIN and STAFF can process overdue settlements
    if (!['ADMIN', 'STAFF', 'SUPER_ADMIN'].includes(currentUserRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { transaction_type, transaction_id, amount_paid } = body

    if (!transaction_type || !transaction_id || !amount_paid) {
      return NextResponse.json({ 
        error: 'Missing required fields: transaction_type, transaction_id, amount_paid' 
      }, { status: 400 })
    }

    if (!['BOOK', 'LOCKER'].includes(transaction_type)) {
      return NextResponse.json({ 
        error: 'Invalid transaction_type. Must be BOOK or LOCKER' 
      }, { status: 400 })
    }

    if (amount_paid <= 0) {
      return NextResponse.json({ 
        error: 'Amount paid must be greater than 0' 
      }, { status: 400 })
    }

    // Get transaction details and calculate current penalty
    let transactionData: any = null
    let penaltyAmount = 0

    if (transaction_type === 'BOOK') {
      transactionData = await prisma.bookTransaction.findUnique({
        where: { transaction_id: parseInt(transaction_id) },
        include: { user: true, book: true }
      })
      
      if (!transactionData) {
        return NextResponse.json({ error: 'Book transaction not found' }, { status: 404 })
      }

      // Calculate penalty based on current overdue (if not returned) or use recorded penalty (if returned)
      if (transactionData.due_date) {
        const currentDate = new Date()
        const dueDate = new Date(transactionData.due_date)
        const returnDate = transactionData.return_date ? new Date(transactionData.return_date) : null
        
        // If returned, use the penalty that was calculated at return time
        if (returnDate) {
          penaltyAmount = Number(transactionData.penalty)
        } 
        // If not returned and overdue, calculate current penalty
        else if (currentDate > dueDate) {
          const daysOverdue = Math.floor((currentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
          penaltyAmount = Math.max(Number(transactionData.penalty), daysOverdue * 10) // 10 pesos per day
        }
      }
    } else {
      transactionData = await prisma.lockerTransaction.findUnique({
        where: { transaction_id: parseInt(transaction_id) },
        select: {
          transaction_id: true,
          borrow_time: true,
          return_time: true,
          due_time: true,
          penalty: true,
          status: true,
          user_id: true,
          locker_id: true,
          user: true,
          locker: true,
        },
      })
      
      if (!transactionData) {
        return NextResponse.json({ error: 'Locker transaction not found' }, { status: 404 })
      }

      // Calculate penalty based on current overdue (if not returned) or use recorded penalty (if returned)
      const returnTime = transactionData.return_time ? new Date(transactionData.return_time) : null
      const borrowTime = new Date(transactionData.borrow_time)
      
      // If returned, use the penalty that was recorded at return time
      if (returnTime) {
        penaltyAmount = Number(transactionData.penalty)
      }
      // If not returned, calculate current penalty
      else {
        const currentDate = new Date()
        const hoursUsed = Math.floor((currentDate.getTime() - borrowTime.getTime()) / (1000 * 60 * 60))
        if (hoursUsed > 24) {
          const daysUsed = Math.floor(hoursUsed / 24)
          penaltyAmount = Math.max(Number(transactionData.penalty), daysUsed * 5) // 5 pesos per day
        }
      }
    }

    if (penaltyAmount <= 0) {
      return NextResponse.json({ 
        error: 'No penalty amount to settle for this transaction',
        details: transaction_type === 'BOOK' 
          ? `Book transaction #${transaction_id}: penalty=${transactionData?.penalty}, due_date=${transactionData?.due_date}, return_date=${transactionData?.return_date}`
          : `Locker transaction #${transaction_id}: penalty=${transactionData?.penalty}, borrow_time=${transactionData?.borrow_time}, return_time=${transactionData?.return_time}`
      }, { status: 400 })
    }

    // Check if settlement already exists
    let settlement = await prisma.overdueSettlement.findFirst({
      where: {
        transaction_type: transaction_type === 'BOOK' ? 'BOOK' : 'LOCKER',
        transaction_id: parseInt(transaction_id)
      }
    })

    const result = await prisma.$transaction(async (tx) => {
      if (settlement) {
        // Update existing settlement
        const newAmountPaid = Number(settlement.amount_paid) + Number(amount_paid)
        const newRemainingBalance = Math.max(0, Number(settlement.penalty_amount) - newAmountPaid)
        const newStatus = newRemainingBalance === 0 ? 'SETTLED' : 
                         newAmountPaid > 0 ? 'PARTIAL' : 'PENDING'

        settlement = await tx.overdueSettlement.update({
          where: { settlement_id: settlement.settlement_id },
          data: {
            amount_paid: newAmountPaid,
            remaining_balance: newRemainingBalance,
            status: newStatus,
            settled_at: newStatus === 'SETTLED' ? new Date() : null,
            processed_by: currentUserId,
            updated_at: new Date()
          }
        })
      } else {
        // Create new settlement
        const remainingBalance = Math.max(0, penaltyAmount - Number(amount_paid))
        const status = remainingBalance === 0 ? 'SETTLED' : 
                      Number(amount_paid) > 0 ? 'PARTIAL' : 'PENDING'

        settlement = await tx.overdueSettlement.create({
          data: {
            user_id: transactionData.user_id,
            transaction_type: transaction_type === 'BOOK' ? 'BOOK' : 'LOCKER',
            transaction_id: parseInt(transaction_id),
            penalty_amount: penaltyAmount,
            amount_paid: Number(amount_paid),
            remaining_balance: remainingBalance,
            status: status,
            settled_at: status === 'SETTLED' ? new Date() : null,
            processed_by: currentUserId
          }
        })
      }

      return settlement
    })

    return NextResponse.json({
      message: 'Payment processed successfully',
      settlement_id: result.settlement_id,
      status: result.status,
      amount_paid: Number(result.amount_paid),
      remaining_balance: Number(result.remaining_balance),
      penalty_amount: Number(result.penalty_amount)
    })

  } catch (error) {
    console.error('Error processing overdue settlement:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
