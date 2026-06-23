import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { auditLogger } from '@/lib/audit-logger'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req })
    if (!token?.role) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    // ADMIN and SUPER_ADMIN can view staff accounts; ADMIN limited to STAFF
    const resolvedParams = await params
    const accountId = parseInt(resolvedParams.id)
    if (isNaN(accountId)) return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })

    const account = await prisma.userAccount.findUnique({
      where: { id: accountId },
      include: { user: true }
    })

    if (!account) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (token.role === 'ADMIN' && account.role !== 'STAFF') {
      return NextResponse.json({ error: 'Admin can only view staff accounts' }, { status: 403 })
    }

    return NextResponse.json(account)
  } catch (error) {
    console.error('Error fetching staff account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req })
    if (!token?.role) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const resolvedParams = await params
    const accountId = parseInt(resolvedParams.id)
    if (isNaN(accountId)) return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })

    const body = await req.json()
    const { is_active, campus } = body

    const account = await prisma.userAccount.findUnique({ where: { id: accountId } })
    if (!account) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (token.role === 'ADMIN' && account.role !== 'STAFF') {
      return NextResponse.json({ error: 'Admin can only update staff accounts' }, { status: 403 })
    }

    // Re-designating a campus affects FUTURE entries only; historical
    // entry_log rows keep the campus they were stamped with at the
    // moment of entry. The audit log records both old and new campus
    // so the change is traceable.
    const allowedCampuses = ['COLLEGE', 'BASIC_EDUCATION']
    if (campus !== undefined && campus !== null && campus !== '' && !allowedCampuses.includes(campus)) {
      return NextResponse.json(
        { error: 'Invalid campus. Must be COLLEGE or BASIC_EDUCATION' },
        { status: 400 }
      )
    }

    const previousCampus = account.campus
    const newCampus =
      campus && allowedCampuses.includes(campus) ? campus : account.campus

    const data: any = {
      is_active: typeof is_active === 'boolean' ? is_active : account.is_active
    }
    if (newCampus !== previousCampus) {
      data.campus = newCampus
    }

    const updated = await prisma.userAccount.update({
      where: { id: accountId },
      data,
      include: { user: true }
    })

    // Audit log only when the campus actually changes so toggling
    // is_active doesn't spam the log with noise.
    if (newCampus !== previousCampus) {
      try {
        const actorId = parseInt((token?.sub as any) || '0')
        if (actorId > 0) {
          await auditLogger.logAction(
            actorId,
            token.role as any,
            'REASSIGN_STAFF_CAMPUS',
            `Re-designated staff ${updated.user?.full_name || updated.username} from ${previousCampus || 'NONE'} to ${newCampus}. Future entries will be stamped with the new campus; historical entries are unchanged.`,
            req
          )
        }
      } catch (e) {
        console.error('Failed to write campus-reassignment audit log:', e)
      }
    }

    return NextResponse.json({ success: true, data: updated, message: 'Account updated successfully' })
  } catch (error) {
    console.error('Error updating staff account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


