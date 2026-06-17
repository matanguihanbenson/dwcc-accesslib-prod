import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { auditLogger } from '@/lib/audit-logger'
import { withDuplicatePreventionByBody } from '@/lib/duplicate-prevention'

export const GET = withAuth(
  async (_req: NextRequest) => {
    const categories = await prisma.bookCategory.findMany({
      orderBy: { name: 'asc' }
    })
    return createSuccessResponse(categories)
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)

export const POST = withDuplicatePreventionByBody(
  withAuth(
    async (req: NextRequest) => {
      const body = await req.json()
      const name = (body.name || '').trim()
      const description = body.description ? String(body.description) : null
      if (!name) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 })
      }
      const created = await prisma.bookCategory.create({
        data: { name, description: description || undefined }
      })
      try {
        const session = await getServerSession(authOptions) as any
        if (session?.user?.id) {
          await auditLogger.logAction(
            parseInt(session.user.id),
            session.user.role as UserRole,
            'CREATE_CATEGORY',
            `Created category: ${created.name} (#${created.category_id})`,
            req
          )
        }
      } catch {}
      return createSuccessResponse(created, 201 as any)
    },
    [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
  ),
  {
    keyFields: ['name'],
    ttl: 8000, 
  }
)


