import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { UserRole } from '@/types'
import {
  createSuccessResponse,
  createErrorResponse
} from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/roles'
import { auditLogger } from '@/lib/audit-logger'
import { BookCatalogValueType, Prisma } from '@prisma/client'

const ALLOWED_TYPES: BookCatalogValueType[] = [
  'CLASSIFICATION',
  'MATERIAL_TYPE',
  'SUBTYPE',
  'INTEREST_LEVEL',
  'LEXILE',
  'FOUNTAS_PINNELL'
]
const isAllowedType = (v: string): v is BookCatalogValueType =>
  (ALLOWED_TYPES as string[]).includes(v)

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
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

    const id = parseInt(resolvedParams.id)
    if (!id || isNaN(id)) {
      return createErrorResponse('Invalid ID', 400, 'VALIDATION_ERROR')
    }

    const body = await req.json()
    const value =
      body.value !== undefined ? String(body.value).trim() : undefined
    const description =
      body.description !== undefined
        ? String(body.description).trim() || null
        : undefined
    const isActive =
      body.is_active !== undefined ? Boolean(body.is_active) : undefined
    const type =
      body.type !== undefined ? String(body.type) : undefined
    if (type !== undefined && !isAllowedType(type)) {
      return createErrorResponse(`Invalid type: ${type}`, 400, 'INVALID_TYPE')
    }
    if (value !== undefined && !value) {
      return createErrorResponse(
        'Value cannot be empty',
        400,
        'VALIDATION_ERROR'
      )
    }

    const data: Prisma.BookCatalogValueUpdateInput = {}
    if (value !== undefined) data.value = value
    if (description !== undefined) data.description = description
    if (isActive !== undefined) data.is_active = isActive
    if (type !== undefined) data.type = type

    try {
      const updated = await prisma.bookCatalogValue.update({
        where: { id },
        data
      })
      try {
        if (session.user.id) {
          await auditLogger.logAction(
            parseInt(session.user.id),
            session.user.role as UserRole,
            'UPDATE_BOOK_CATALOG_VALUE',
            `Updated ${updated.type} value: ${updated.value} (#${updated.id})`,
            req
          )
        }
      } catch {}
      return createSuccessResponse(updated)
    } catch (err) {
      const e = err as { code?: string }
      if (e?.code === 'P2002') {
        return createErrorResponse(
          'A value with that text already exists in this catalog.',
          409,
          'DUPLICATE_ENTRY'
        )
      }
      if (e?.code === 'P2025') {
        return createErrorResponse('Value not found', 404, 'NOT_FOUND')
      }
      console.error('PUT /api/book-catalog-values/[id] error:', err)
      return createErrorResponse(
        'Failed to update value',
        500,
        'SERVER_ERROR'
      )
    }
  } catch (error) {
    console.error('PUT /api/book-catalog-values/[id] error:', error)
    return createErrorResponse('Internal server error', 500, 'SERVER_ERROR')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
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

    const id = parseInt(resolvedParams.id)
    if (!id || isNaN(id)) {
      return createErrorResponse('Invalid ID', 400, 'VALIDATION_ERROR')
    }

    try {
      const deleted = await prisma.bookCatalogValue.delete({ where: { id } })
      try {
        if (session.user.id) {
          await auditLogger.logAction(
            parseInt(session.user.id),
            session.user.role as UserRole,
            'DELETE_BOOK_CATALOG_VALUE',
            `Deleted ${deleted.type} value: ${deleted.value} (#${deleted.id})`,
            _req
          )
        }
      } catch {}
      return createSuccessResponse({ deleted: true })
    } catch (err) {
      const e = err as { code?: string }
      if (e?.code === 'P2025') {
        return createErrorResponse('Value not found', 404, 'NOT_FOUND')
      }
      console.error('DELETE /api/book-catalog-values/[id] error:', err)
      return createErrorResponse(
        'Failed to delete value',
        500,
        'SERVER_ERROR'
      )
    }
  } catch (error) {
    console.error('DELETE /api/book-catalog-values/[id] error:', error)
    return createErrorResponse('Internal server error', 500, 'SERVER_ERROR')
  }
}
