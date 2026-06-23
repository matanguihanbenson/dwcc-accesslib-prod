import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { auditLogger } from '@/lib/audit-logger'

// PATCH /api/staff-accounts/[id]/campus
// Re-designates a STAFF account to a different campus. Only ADMIN and
// SUPER_ADMIN can call this. Re-designation only affects FUTURE
// entry_log rows -- historical entries keep the campus they were
// stamped with at the moment of entry.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req })
    if (!token?.role) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (token.role !== 'ADMIN' && token.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Only library admin / super admin can re-designate staff campus' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const accountId = parseInt(resolvedParams.id)
    if (isNaN(accountId)) {
      return NextResponse.json({ error: 'Invalid staff account ID' }, { status: 400 })
    }

    const body = await req.json()
    const { campus } = body
    const allowedCampuses = ['COLLEGE', 'BASIC_EDUCATION']
    if (!campus || !allowedCampuses.includes(campus)) {
      return NextResponse.json(
        { error: 'Invalid campus. Must be COLLEGE or BASIC_EDUCATION' },
        { status: 400 }
      )
    }

    const account = await prisma.userAccount.findUnique({
      where: { id: accountId },
      include: { user: { select: { full_name: true, account_id: true } } }
    })
    if (!account) {
      return NextResponse.json({ error: 'Staff account not found' }, { status: 404 })
    }
    if (account.role !== 'STAFF') {
      return NextResponse.json(
        { error: 'Only STAFF accounts have a campus designation' },
        { status: 400 }
      )
    }

    const previousCampus = account.campus

    const updated = await prisma.userAccount.update({
      where: { id: accountId },
      data: { campus },
      include: { user: { select: { full_name: true, account_id: true } } }
    })

    if (previousCampus !== campus) {
      try {
        const actorId = parseInt((token?.sub as any) || '0')
        if (actorId > 0) {
          await auditLogger.logAction(
            actorId,
            token.role as any,
            'REASSIGN_STAFF_CAMPUS',
            `Re-designated staff ${updated.user?.full_name || updated.username} (${updated.user?.account_id || ''}) from campus ${previousCampus || 'NONE'} to ${campus}. Past entries are unchanged; future entries will use the new campus.`,
            req
          )
        }
      } catch (e) {
        console.error('Failed to write campus-reassignment audit log:', e)
      }
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: previousCampus === campus
        ? 'Campus unchanged.'
        : `Staff re-designated from ${previousCampus || 'NONE'} to ${campus}. Past entries are unchanged; future entries will use ${campus}.`
    })
  } catch (error) {
    console.error('Error re-designating staff campus:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
