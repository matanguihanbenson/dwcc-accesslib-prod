import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const bookIdParam = searchParams.get('book_id')
    const limitParam = searchParams.get('limit')

    if (!bookIdParam) {
      return NextResponse.json({ success: false, error: 'book_id is required' }, { status: 400 })
    }

    const bookId = parseInt(bookIdParam, 10)
    if (Number.isNaN(bookId)) {
      return NextResponse.json({ success: false, error: 'book_id must be a number' }, { status: 400 })
    }

    const take = limitParam ? Math.min(parseInt(limitParam, 10) || 5, 10) : 5

    const transactions = await prisma.bookTransaction.findMany({
      where: { book_id: bookId },
      orderBy: { borrow_date: 'desc' },
      take,
      include: {
        user: {
          select: {
            full_name: true,
            account_id: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: transactions })
  } catch (error: any) {
    console.error('Public borrowing-transactions error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error?.message },
      { status: 500 },
    )
  }
}
