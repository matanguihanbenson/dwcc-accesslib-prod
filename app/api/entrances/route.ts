import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { auditLogger } from '@/lib/audit-logger'
import { Campus, UserRole } from '@prisma/client'

// GET /api/entrances
// List entrances. By default this is scoped to the caller's
// campus (for STAFF users) so the entry-monitoring page can
// fetch just the entrances they're allowed to operate from.
// Super admins can pass `?campus=ALL` to see every entrance.
export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.role) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const query = searchParams.get('query')?.trim() || ''
    const campusParam = searchParams.get('campus')?.toUpperCase() || ''
    const includeArchived = searchParams.get('include_archived') === 'true'

    const where: any = {}
    if (!includeArchived) {
      where.archived_at = null
    }
    if (query) {
      where.OR = [
        { name: { contains: query } },
        { description: { contains: query } }
      ]
    }

    // STAFF users are always scoped to their own campus. They
    // can never read entrances from a campus they're not
    // assigned to, even by passing a `campus` query param.
    if (token.role === UserRole.STAFF) {
      const accountId = parseInt((token.sub as string) || '0')
      if (!accountId) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
      }
      const account = await prisma.userAccount.findUnique({
        where: { id: accountId },
        select: { campus: true }
      })
      if (!account?.campus) {
        // STAFF without a campus designation see no entrances.
        return NextResponse.json({
          success: true,
          data: [],
          campus: null
        })
      }
      where.campus = account.campus
    } else if (campusParam && campusParam !== 'ALL' && (campusParam === Campus.COLLEGE || campusParam === Campus.BASIC_EDUCATION)) {
      where.campus = campusParam as Campus
    }

    const entrances = await prisma.entrance.findMany({
      where,
      orderBy: [{ campus: 'asc' }, { name: 'asc' }]
    })

    return NextResponse.json({
      success: true,
      data: entrances
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    })
  } catch (error) {
    console.error('Error fetching entrances:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/entrances
// Create a new entrance. Super-admin-only -- the entry-
// management page is read-only for STAFF.
export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req })
    if (!token?.role) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (token.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Only super admin can manage entrances' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { name, campus, description, is_active } = body || {}

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      )
    }
    if (campus !== Campus.COLLEGE && campus !== Campus.BASIC_EDUCATION) {
      return NextResponse.json(
        { success: false, error: 'Campus must be COLLEGE or BASIC_EDUCATION' },
        { status: 400 }
      )
    }

    const trimmedName = name.trim()
    const existing = await prisma.entrance.findFirst({
      where: { name: trimmedName, campus, archived_at: null }
    })
    if (existing) {
      return NextResponse.json(
        { success: false, error: `An entrance named "${trimmedName}" already exists on the ${campus} campus.` },
        { status: 409 }
      )
    }

    const entrance = await prisma.entrance.create({
      data: {
        name: trimmedName,
        campus,
        description: description?.toString().trim() || null,
        is_active: is_active === false ? false : true
      }
    })

    try {
      const actorId = parseInt((token.sub as string) || '0')
      if (actorId > 0) {
        await auditLogger.logAction(
          actorId,
          token.role as any,
          'CREATE_ENTRANCE',
          `Created entrance "${entrance.name}" on campus ${entrance.campus}`,
          req
        )
      }
    } catch (e) {
      console.error('Failed to write entrance creation audit log:', e)
    }

    return NextResponse.json(
      { success: true, data: entrance, message: 'Entrance created successfully' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating entrance:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
