import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { UserRole } from '@/types'
import {
  withAuth,
  createSuccessResponse,
  createErrorResponse
} from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/roles'
import { auditLogger } from '@/lib/audit-logger'
import { BookClassificationLevel, Prisma } from '@prisma/client'

const ALLOWED_LEVELS: BookClassificationLevel[] = [
  'MAIN_CLASS',
  'DIVISION',
  'SECTION',
  'DECIMAL_SUBDIVISION',
  'DEEPER_SUBDIVISION'
]
const isAllowedLevel = (v: string): v is BookClassificationLevel =>
  (ALLOWED_LEVELS as string[]).includes(v)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id)
    if (!Number.isFinite(id) || id <= 0) {
      return createErrorResponse('Invalid ID', 400)
    }
    const item = await prisma.bookClassification.findUnique({
      where: { id },
      include: {
        // Direct children so the tree UI can show
        // "this Main Class has 3 Divisions" without a
        // second round-trip.
        _count: { select: { children: true, books: true } }
      }
    })
    if (!item) {
      return createErrorResponse('Classification not found', 404)
    }
    return createSuccessResponse(item)
  } catch (error) {
    console.error('Error fetching book classification:', error)
    return createErrorResponse('Failed to fetch book classification', 500)
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    if (
      !hasPermission(session.user.role as UserRole, [
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN
      ])
    ) {
      return createErrorResponse('Forbidden', 403, 'FORBIDDEN')
    }
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id)
    if (!Number.isFinite(id) || id <= 0) {
      return createErrorResponse('Invalid ID', 400)
    }
    const body = await req.json()
    const data: Prisma.BookClassificationUpdateInput = {}
    if (body.code !== undefined) data.code = String(body.code).trim()
    if (body.name !== undefined) data.name = String(body.name).trim()
    if (body.description !== undefined) {
      data.description = body.description
        ? String(body.description).trim()
        : null
    }
    if (body.is_active !== undefined) {
      data.is_active = Boolean(body.is_active)
    }
    // parent_id changes are blocked here — moving a
    // node to a different parent is a manual operation
    // the admin should do by deleting + re-creating.
    // This avoids accidentally orphaning children or
    // breaking the level hierarchy invariant.

    if (Object.keys(data).length === 0) {
      return createErrorResponse('No updatable fields supplied', 400, 'VALIDATION_ERROR')
    }
    try {
      const updated = await prisma.bookClassification.update({
        where: { id },
        data
      })
      try {
        const actorId = parseInt((session.user as any).id || '0')
        if (actorId > 0) {
          await auditLogger.logAction(
            actorId,
            session.user.role as UserRole,
            'UPDATE_BOOK_CLASSIFICATION',
            `Updated book classification #${id}: "${updated.code} ${updated.name}"`,
            req
          )
        }
      } catch {}
      return createSuccessResponse(updated)
    } catch (err: any) {
      const e = err as { code?: string }
      if (e?.code === 'P2002') {
        return createErrorResponse(
          'A classification with that code already exists in this scope.',
          409,
          'DUPLICATE_ENTRY'
        )
      }
      throw err
    }
  } catch (error) {
    console.error('Error updating book classification:', error)
    return createErrorResponse('Failed to update book classification', 500)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    if (
      !hasPermission(session.user.role as UserRole, [
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN
      ])
    ) {
      return createErrorResponse('Forbidden', 403, 'FORBIDDEN')
    }
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id)
    if (!Number.isFinite(id) || id <= 0) {
      return createErrorResponse('Invalid ID', 400)
    }
    const existing = await prisma.bookClassification.findUnique({
      where: { id },
      include: { _count: { select: { children: true, books: true } } }
    })
    if (!existing) {
      return createErrorResponse('Classification not found', 404)
    }
    // Soft-delete by deactivating if the node still
    // has children or assigned books. This avoids
    // accidental data loss in a library that has
    // already assigned books to this node.
    if (existing._count.children > 0 || existing._count.books > 0) {
      const updated = await prisma.bookClassification.update({
        where: { id },
        data: { is_active: false }
      })
      try {
        const actorId = parseInt((session.user as any).id || '0')
        if (actorId > 0) {
          await auditLogger.logAction(
            actorId,
            session.user.role as UserRole,
            'DEACTIVATE_BOOK_CLASSIFICATION',
            `Deactivated book classification #${id}: "${existing.code} ${existing.name}" (has ${existing._count.children} children / ${existing._count.books} books — soft-delete only)`,
            req
          )
        }
      } catch {}
      return createSuccessResponse({
        ...updated,
        _softDeleted: true,
        _reason: 'Has children or books; deactivated instead of hard-deleted.'
      })
    }
    // Hard-delete only if the node is a true leaf
    // (no children, no books). Safe.
    const deleted = await prisma.bookClassification.delete({
      where: { id }
    })
    try {
      const actorId = parseInt((session.user as any).id || '0')
      if (actorId > 0) {
        await auditLogger.logAction(
          actorId,
          session.user.role as UserRole,
          'DELETE_BOOK_CLASSIFICATION',
          `Hard-deleted book classification #${id}: "${existing.code} ${existing.name}"`,
          req
        )
      }
    } catch {}
    return createSuccessResponse({ ...deleted, _softDeleted: false })
  } catch (error) {
    console.error('Error deleting book classification:', error)
    return createErrorResponse('Failed to delete book classification', 500)
  }
}
