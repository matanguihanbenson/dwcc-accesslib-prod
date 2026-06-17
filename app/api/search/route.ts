import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })
    
    if (!token?.role) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const url = new URL(req.url)
    const query = url.searchParams.get('q')?.trim()
    const limit = parseInt(url.searchParams.get('limit') || '10')

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] })
    }

    const results: any[] = []

    // Search books (accessible to all authenticated users)
    const books = await prisma.book.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { authors: { some: { name: { contains: query } } } },
          { isbn: { contains: query } }
        ]
      },
      include: {
        category: true,
        authors: {
          select: {
            name: true
          },
          orderBy: {
            display_order: 'asc'
          },
          take: 1
        }
      },
      take: Math.ceil(limit / 3)
    })

    books.forEach(book => {
      const authorName = book.authors[0]?.name || 'Unknown Author'
      results.push({
        type: 'book',
        id: book.book_id,
        title: book.title,
        subtitle: `by ${authorName} - ${book.category?.name || 'Unknown Category'}`,
        url: `/books/${book.book_id}`
      })
    })

    // Search users (only for admin/staff)
    if (['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(token.role)) {
      const users = await prisma.user.findMany({
        where: {
        OR: [
          { full_name: { contains: query } },
          { email: { contains: query } }
        ]
        },
        include: {
          user_account: true,
          department_ref: true,
          program: true
        },
        take: Math.ceil(limit / 3)
      })

      users.forEach(user => {
        if (user.user_account) {
          results.push({
            type: 'user',
            id: user.user_id,
            title: user.full_name,
            subtitle: `${user.user_type} - ${user.department_ref?.name || 'No Department'}`,
            url: `/library-users/${user.user_id}`
          })
        }
      })
    }

    // Search lockers (only for admin/staff)
    if (['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(token.role)) {
      const lockers = await prisma.locker.findMany({
        where: {
          locker_number: { contains: query }
        },
        include: {
          locker_transactions: {
            where: {
              status: 'ACTIVE'
            },
            include: {
              user: true
            }
          }
        },
        take: Math.ceil(limit / 3)
      })

      lockers.forEach(locker => {
        const isOccupied = locker.locker_transactions.length > 0 && locker.status === 'OCCUPIED'
        results.push({
          type: 'locker',
          id: locker.locker_id,
          title: `Locker ${locker.locker_number}`,
          subtitle: isOccupied
            ? `Occupied by ${locker.locker_transactions[0]?.user?.full_name}`
            : `Status: ${locker.status}`,
          url: `/lockers`
        })
      })
    }

    // Sort results by relevance (exact matches first) and limit
    const sortedResults = results
      .sort((a, b) => {
        const aExact = a.title.toLowerCase().includes(query.toLowerCase())
        const bExact = b.title.toLowerCase().includes(query.toLowerCase())
        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1
        return 0
      })
      .slice(0, limit)

    return NextResponse.json({ results: sortedResults })

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
