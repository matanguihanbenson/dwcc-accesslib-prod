import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { UserRole } from '@/types'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/roles'
import { auditLogger } from '@/lib/audit-logger'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const session = await getServerSession(authOptions)
    if (!session) return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    if (!hasPermission(session.user.role as UserRole, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF])) {
      return createErrorResponse('Forbidden', 403, 'FORBIDDEN')
    }

    const id = parseInt(resolvedParams.id)
    if (!id || isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const section = await prisma.bookSection.findUnique({ where: { section_id: id } })
    if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 })

    const recent = await prisma.book.findMany({
      where: { section_id: id },
      orderBy: { created_at: 'desc' },
      take: 10,
      select: {
        book_id: true,
        title: true,
        status: true,
        created_at: true,
        authors: {
          select: { name: true, display_order: true },
          orderBy: { display_order: 'asc' },
          take: 1,
        },
      }
    })

    const recentBooks = recent.map((b) => ({
      book_id: b.book_id,
      title: b.title,
      book_author: (b as any).authors?.[0]?.name || 'Unknown',
      status: b.status,
      created_at: b.created_at,
    }))

    return createSuccessResponse({ section, recentBooks })
  } catch (error) {
    console.error('GET /api/sections/[id] error:', error)
    return createErrorResponse('Internal server error', 500, 'SERVER_ERROR')
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const session = await getServerSession(authOptions)
    if (!session) return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    if (!hasPermission(session.user.role as UserRole, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF])) {
      return createErrorResponse('Forbidden', 403, 'FORBIDDEN')
    }

    const id = parseInt(resolvedParams.id)
    if (!id || isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    const body = await req.json()
    const name = body.name !== undefined ? String(body.name).trim() : undefined
    const description = body.description !== undefined ? String(body.description) : undefined
    const is_active = body.is_active !== undefined ? Boolean(body.is_active) : undefined

    const updated = await prisma.bookSection.update({ where: { section_id: id }, data: { name, description, is_active } })
    try {
      if (session?.user?.id) {
        await auditLogger.logAction(
          parseInt(session.user.id),
          session.user.role as UserRole,
          'UPDATE_SECTION',
          `Updated section: ${updated.name} (#${updated.section_id})`,
          req
        )
      }
    } catch {}
    return createSuccessResponse(updated)
  } catch (error) {
    console.error('PUT /api/sections/[id] error:', error)
    return createErrorResponse('Internal server error', 500, 'SERVER_ERROR')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const session = await getServerSession(authOptions)
    if (!session) return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    if (!hasPermission(session.user.role as UserRole, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF])) {
      return createErrorResponse('Forbidden', 403, 'FORBIDDEN')
    }

    const id = parseInt(resolvedParams.id)
    if (!id || isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    const deleted = await prisma.bookSection.delete({ where: { section_id: id } })
    try {
      if (session?.user?.id) {
        await auditLogger.logAction(
          parseInt(session.user.id),
          session.user.role as UserRole,
          'DELETE_SECTION',
          `Deleted section: ${deleted.name} (#${deleted.section_id})`,
          _req
        )
      }
    } catch {}
    return createSuccessResponse({ deleted: true })
  } catch (error) {
    console.error('DELETE /api/sections/[id] error:', error)
    return createErrorResponse('Internal server error', 500, 'SERVER_ERROR')
  }
}


