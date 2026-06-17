import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { cache, generateCacheKey } from '@/lib/cache'

export const GET = withAuth(
  async (req: NextRequest, session) => {
    try {
      const { searchParams } = new URL(req.url)
      const page = parseInt(searchParams.get('page') || '1')
      const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100) // Cap limit to prevent large queries
      const search = searchParams.get('search') || ''
      const status = searchParams.get('status') || ''
      const date = searchParams.get('date') || ''

      const offset = (page - 1) * limit

      // Generate cache key for this specific query
      const cacheKey = generateCacheKey('transactions_history', {
        page,
        limit,
        search,
        status,
        date,
        role: session.user.role
      })

      // Try to get from cache first (cache for 2 minutes)
      const cached = cache.get(cacheKey)
      if (cached) {
        return createSuccessResponse(cached)
      }

      // Build optimized where clause for filtering
      const whereClause: any = {}
      
      if (search) {
        whereClause.OR = [
          {
            book: {
              title: {
                contains: search,
              }
            }
          },
          {
            book: {
              authors: {
                some: {
                  name: {
                    contains: search,
                  }
                }
              }
            }
          },
          {
            user: {
              full_name: {
                contains: search,
              }
            }
          },
          {
            user: {
              account_id: {
                contains: search,
              }
            }
          }
        ]
      }

      if (status) {
        whereClause.status = status
      }

      if (date) {
        const filterDate = new Date(date)
        const nextDay = new Date(filterDate)
        nextDay.setDate(nextDay.getDate() + 1)
        
        whereClause.created_at = {
          gte: filterDate,
          lt: nextDay
        }
      }

      // Use a single optimized query with parallel execution
      const [transactions, total] = await Promise.all([
        prisma.bookTransaction.findMany({
          where: whereClause,
          select: {
            transaction_id: true,
            borrow_date: true,
            return_date: true,
            due_date: true,
            status: true,
            penalty: true,
            condition_on_borrow: true,
            condition_on_return: true,
            notes: true,
            created_at: true,
            updated_at: true,
            book: {
              select: {
                book_id: true,
                title: true,
                authors: {
                  select: {
                    name: true
                  }
                },
                isbn: true,
                category: {
                  select: {
                    name: true
                  }
                }
              }
            },
            user: {
              select: {
                user_id: true,
                account_id: true,
                full_name: true,
                user_type: true
              }
            },
          },
          orderBy: {
            created_at: 'desc'
          },
          skip: offset,
          take: limit
        }),
        prisma.bookTransaction.count({
          where: whereClause
        })
      ])

      // Optimize date formatting - only format once per transaction
      const formattedTransactions = transactions.map(transaction => ({
        transaction_id: transaction.transaction_id,
        borrow_date: transaction.borrow_date?.toISOString() || null,
        return_date: transaction.return_date?.toISOString() || null,
        due_date: transaction.due_date?.toISOString() || null,
        status: transaction.status,
        penalty: transaction.penalty || 0,
        condition_on_borrow: transaction.condition_on_borrow,
        condition_on_return: transaction.condition_on_return,
        notes: transaction.notes,
        book: transaction.book,
        user: transaction.user,
        created_at: transaction.created_at.toISOString(),
        updated_at: transaction.updated_at.toISOString()
      }))

      const result = {
        transactions: formattedTransactions,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }

      // Cache the result for 2 minutes (120000ms)
      cache.set(cacheKey, result, 120000)

      return createSuccessResponse(result)

    } catch (error: any) {
      console.error('Error fetching transaction history:', error)
      return createErrorResponse(error?.message || 'Failed to fetch transaction history', 500)
    }
  },
  [UserRole.ADMIN, UserRole.STAFF]
)
