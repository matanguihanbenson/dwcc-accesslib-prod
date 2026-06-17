import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ isbn: string }> }
) {
  try {
    const resolvedParams = await params
    const isbn = resolvedParams.isbn

    if (!isbn) {
      return NextResponse.json({ error: 'ISBN is required' }, { status: 400 })
    }

    const book = await prisma.book.findFirst({
      where: {
        isbn: isbn
      },
      include: {
        category: true,
        section: true,
      }
    })

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: book
    })

  } catch (error) {
    console.error('Error looking up book by ISBN:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

