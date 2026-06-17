import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { UserRole } from '@/types'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/roles'
import { auditLogger } from '@/lib/audit-logger'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    if (!hasPermission(session.user.role as UserRole, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF])) {
      return createErrorResponse('Forbidden', 403, 'FORBIDDEN')
    }

    const resolvedParams = await params
    const id = parseInt(resolvedParams.id)
    if (!id || isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const category = await prisma.bookCategory.findUnique({ where: { category_id: id } })
    if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 })

    const recent = await prisma.book.findMany({
      where: { category_id: id },
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
          take: 1
        }
      }
    })

    const recentBooks = recent.map((b) => ({
      book_id: b.book_id,
      title: b.title,
      book_author: (b as any).authors?.[0]?.name || 'Unknown',
      status: b.status,
      created_at: b.created_at,
    }))

    return createSuccessResponse({ category, recentBooks })
  } catch (error) {
    console.error('GET /api/book-categories/[id] error:', error)
    return createErrorResponse('Internal server error', 500, 'SERVER_ERROR')
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    if (!hasPermission(session.user.role as UserRole, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF])) {
      return createErrorResponse('Forbidden', 403, 'FORBIDDEN')
    }

    const resolvedParams = await params
    const id = parseInt(resolvedParams.id)
    if (!id || isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    const body = await req.json()
    const name = body.name ? String(body.name).trim() : undefined
    const description = body.description !== undefined ? String(body.description) : undefined

    const updated = await prisma.bookCategory.update({ where: { category_id: id }, data: { name, description } })
    try {
      if (session?.user?.id) {
        await auditLogger.logAction(
          parseInt(session.user.id),
          session.user.role as UserRole,
          'UPDATE_CATEGORY',
          `Updated category: ${updated.name} (#${updated.category_id})`,
          req
        )
      }
    } catch {}
    return createSuccessResponse(updated)
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return createErrorResponse('Category name already exists', 409, 'UNIQUE_CONSTRAINT')
    }
    console.error('PUT /api/book-categories/[id] error:', error)
    return createErrorResponse('Internal server error', 500, 'SERVER_ERROR')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    if (!hasPermission(session.user.role as UserRole, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF])) {
      return createErrorResponse('Forbidden', 403, 'FORBIDDEN')
    }

    const resolvedParams = await params
    const id = parseInt(resolvedParams.id)
    if (!id || isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    const deleted = await prisma.bookCategory.delete({ where: { category_id: id } })
    try {
      if (session?.user?.id) {
        await auditLogger.logAction(
          parseInt(session.user.id),
          session.user.role as UserRole,
          'DELETE_CATEGORY',
          `Deleted category: ${deleted.name} (#${deleted.category_id})`,
          _req
        )
      }
    } catch {}
    return createSuccessResponse({ deleted: true })
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return createErrorResponse('Cannot delete category with existing books', 409, 'FOREIGN_KEY_CONSTRAINT')
    }
    console.error('DELETE /api/book-categories/[id] error:', error)
    return createErrorResponse('Internal server error', 500, 'SERVER_ERROR')
  }
}


