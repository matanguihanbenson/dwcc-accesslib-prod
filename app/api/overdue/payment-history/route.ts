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
    const status = searchParams.get('status') || 'all' 
    const type = searchParams.get('type') || 'all' 

   
    const whereClause: any = {}
    
    if (status !== 'all') {
      whereClause.status = status
    }
    
    if (type !== 'all') {
      whereClause.transaction_type = type
    }

    const settlements = await prisma.overdueSettlement.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            full_name: true,
            email: true,
            user_type: true,
            account_id: true,
            contact_number: true,
            department_ref: {
              select: { name: true }
            },
            program: {
              select: { name: true }
            }
          }
        },
        processedByUser: {
          select: {
            full_name: true,
            account_id: true,
            user_account: {
              select: {
                role: true
              }
            }
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    const enrichedSettlements = await Promise.all(
      settlements.map(async (settlement) => {
        let transactionDetails: any = {}

        if (settlement.transaction_type === 'BOOK') {
          const bookTransaction = await prisma.bookTransaction.findUnique({
            where: { transaction_id: settlement.transaction_id },
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
          if (bookTransaction) {
            transactionDetails = {
              type: 'BOOK',
              book_title: bookTransaction.book?.title,
              book_author: bookTransaction.book?.authors && bookTransaction.book.authors.length > 0 ? bookTransaction.book.authors[0].name : undefined,
              borrow_date: bookTransaction.borrow_date,
              due_date: bookTransaction.due_date,
              return_date: bookTransaction.return_date
            }
          }
        } else {
          const lockerTransaction = await prisma.lockerTransaction.findUnique({
            where: { transaction_id: settlement.transaction_id },
            include: {
              locker: {
                select: {
                  locker_number: true
                }
              }
            }
          })
          if (lockerTransaction) {
            transactionDetails = {
              type: 'LOCKER',
              locker_number: lockerTransaction.locker?.locker_number,
              borrow_time: lockerTransaction.borrow_time,
              return_time: lockerTransaction.return_time
            }
          }
        }

        return {
          settlement_id: settlement.settlement_id,
          user: settlement.user,
          processedByUser: settlement.processedByUser,
          transaction_type: settlement.transaction_type,
          transaction_id: settlement.transaction_id,
          penalty_amount: Number(settlement.penalty_amount),
          amount_paid: Number(settlement.amount_paid),
          remaining_balance: Number(settlement.remaining_balance),
          status: settlement.status,
          created_at: settlement.created_at,
          settled_at: settlement.settled_at,
          updated_at: settlement.updated_at,
          transaction_details: transactionDetails
        }
      })
    )

    const summary = {
      total_settlements: enrichedSettlements.length,
      total_penalty_amount: enrichedSettlements.reduce((sum, s) => sum + s.penalty_amount, 0),
      total_amount_paid: enrichedSettlements.reduce((sum, s) => sum + s.amount_paid, 0),
      total_remaining_balance: enrichedSettlements.reduce((sum, s) => sum + s.remaining_balance, 0),
      settled_count: enrichedSettlements.filter(s => s.status === 'SETTLED').length,
      pending_count: enrichedSettlements.filter(s => s.status === 'PENDING').length,
      partial_count: enrichedSettlements.filter(s => s.status === 'PARTIAL').length
    }

    return NextResponse.json({
      settlements: enrichedSettlements,
      summary
    })

  } catch (error) {
    console.error('Error fetching payment history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

