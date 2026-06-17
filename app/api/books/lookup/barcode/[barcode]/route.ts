import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ barcode: string }> }
) {
  try {
    const resolvedParams = await params
    const barcode = resolvedParams.barcode

    if (!barcode) {
      return NextResponse.json({ error: 'Barcode is required' }, { status: 400 })
    }

    // For now, treating barcode as ISBN since we don't have a separate barcode field
    // You can modify this logic if you have a different barcode field
    const book = await prisma.book.findFirst({
      where: {
        OR: [
          { isbn: barcode },
          // Add other barcode field searches here if needed
        ]
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
    console.error('Error looking up book by barcode:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

