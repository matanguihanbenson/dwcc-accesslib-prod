import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { auditLogger } from '@/lib/audit-logger'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const GET = withAuth(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const showAll = searchParams.get('all') === 'true'
    
    const sections = await prisma.bookSection.findMany({
      where: showAll ? {} : { is_active: true },
      orderBy: { name: 'asc' }
    })
    return createSuccessResponse(sections)
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)

export const POST = withAuth(
  async (req: NextRequest) => {
    const body = await req.json()
    const name = (body.name || '').trim()
    const description = body.description ? String(body.description) : null
    const is_active = body.is_active === undefined ? true : Boolean(body.is_active)
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    const created = await prisma.bookSection.create({
      data: { name, description: description || undefined, is_active }
    })
    try {
      const session = await getServerSession(authOptions) as any
      if (session?.user?.id) {
        await auditLogger.logAction(
          parseInt(session.user.id),
          session.user.role,
          'CREATE_SECTION',
          `Created section: ${created.name} (#${created.section_id})`,
          req
        )
      }
    } catch {}
    return createSuccessResponse(created, 201 as any)
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
)


