import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const strandId = parseInt(id)

    if (isNaN(strandId)) {
      return NextResponse.json(
        { error: 'Invalid strand ID' },
        { status: 400 }
      )
    }

    // Fetch users in this strand (excluding admin/staff accounts)
    const users = await prisma.user.findMany({
      where: {
        strand_id: strandId,
        OR: [
          { user_account: null },
          { user_account: { role: 'USER' } }
        ]
      },
      include: {
        section: {
          select: {
            name: true
          }
        },
        program: {
          select: {
            name: true,
            code: true
          }
        },
        department_ref: {
          select: {
            name: true,
            code: true
          }
        },
        grade_level: {
          select: {
            name: true,
            code: true
          }
        },
        strand: {
          select: {
            name: true,
            abbreviation: true
          }
        },
        office_ref: {
          select: {
            name: true,
            code: true
          }
        }
      },
      orderBy: {
        full_name: 'asc'
      }
    })

    return NextResponse.json(users, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    })
  } catch (error) {
    console.error('Error fetching strand users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
