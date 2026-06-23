import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

// GET - Return distinct year_level values currently in use by library users
// (college/graduate-school year labels typed at user creation, e.g. "1st Year",
// "Thesis Writing"). This keeps the Entry Monitoring filter dropdown in sync
// with whatever the super admin has actually added to the system.
export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })

    if (!token?.role) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (token.role !== 'SUPER_ADMIN' && token.role !== 'ADMIN' && token.role !== 'STAFF') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const departmentId = searchParams.get('department_id')
    const departmentName = searchParams.get('department')

    const userWhere: any = {
      year_level: { not: null }
    }

    if (departmentId) {
      const parsed = parseInt(departmentId)
      if (!isNaN(parsed)) {
        userWhere.department_id = parsed
      }
    } else if (departmentName) {
      userWhere.department_ref = { name: departmentName }
    }

    const users = await prisma.user.findMany({
      where: userWhere,
      select: { year_level: true },
      distinct: ['year_level']
    })

    const yearLevels = users
      .map((u) => u.year_level)
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .map((v) => v.trim())

    const unique = Array.from(new Set(yearLevels)).sort((a, b) => a.localeCompare(b))

    return NextResponse.json(unique, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    })
  } catch (error) {
    console.error('Error fetching year levels:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
