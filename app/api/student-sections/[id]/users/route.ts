import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sectionId = parseInt(id)

    if (isNaN(sectionId)) {
      return NextResponse.json(
        { error: 'Invalid section ID' },
        { status: 400 }
      )
    }

    // Fetch users in this section. We do NOT hardcode a
    // role filter here — the client-side filter modal
    // decides which `user_type`s to include so staff /
    // admin can also appear when needed.
    const users = await prisma.user.findMany({
      where: {
        section_id: sectionId
      },
      select: {
        user_id: true,
        account_id: true,
        full_name: true,
        email: true,
        contact_number: true,
        user_type: true,
        year_level: true,
        status: true,
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
    console.error('Error fetching section users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
