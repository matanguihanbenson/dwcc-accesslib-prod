import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { auditLogger } from '@/lib/audit-logger'
import { UserRole } from '@/types'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userAccountId = parseInt(resolvedParams.id)
    if (!userAccountId || isNaN(userAccountId)) {
      return NextResponse.json({ error: 'Invalid user account id' }, { status: 400 })
    }

    // Who is making the change
    const actorRole = session.user.role as UserRole

    // Target account
    const account = await prisma.userAccount.findUnique({ 
      where: { id: userAccountId },
      include: { user: { select: { full_name: true, account_id: true } } }
    })
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

    // Authorization rules
    if (account.role === UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Cannot demote SUPER_ADMIN' }, { status: 403 })
    }
    if (account.role === UserRole.ADMIN && actorRole !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Only SUPER_ADMIN can demote ADMIN' }, { status: 403 })
    }
    const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN]
    if (account.role === UserRole.STAFF && !allowedRoles.includes(actorRole as UserRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Demote to USER role
    const updated = await prisma.userAccount.update({
      where: { id: userAccountId },
      data: { role: UserRole.USER }
    })

    try {
      if (session.user.id) {
        await auditLogger.logAction(
          parseInt(session.user.id as any),
          actorRole,
          account.role === UserRole.ADMIN ? 'DEMOTE_ADMIN' : 'DEMOTE_STAFF',
          `Demoted ${account.role} for ${account.user?.full_name || account.username} (${account.user?.account_id || 'N/A'}) to USER`,
          req
        )
      }
    } catch {}

    return NextResponse.json({ success: true, message: 'User demoted to USER', data: { id: updated.id, role: updated.role } })
  } catch (error) {
    console.error('Error demoting account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


