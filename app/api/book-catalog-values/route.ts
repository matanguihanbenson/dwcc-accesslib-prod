import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { UserRole } from '@/types'
import {
  withAuth,
  createSuccessResponse,
  createErrorResponse
} from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { auditLogger } from '@/lib/audit-logger'
import { BookCatalogValueType, Prisma } from '@prisma/client'

// Whitelist of `type` values the API will accept. Lets
// the request body carry the enum as a plain string
// without exposing the full Prisma enum to the
// route layer (and without letting a hand-crafted body
// sneak in a new enum value).
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

export const GET = withAuth(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const showAll = searchParams.get('all') === 'true'

    const where: Prisma.BookCatalogValueWhereInput = {}
    if (type) {
      if (!isAllowedType(type)) {
        return createErrorResponse(`Invalid type: ${type}`, 400, 'INVALID_TYPE')
      }
      where.type = type
    }
    if (!showAll) where.is_active = true

    const values = await prisma.bookCatalogValue.findMany({
      where,
      orderBy: [{ is_active: 'desc' }, { value: 'asc' }]
    })
    return createSuccessResponse(values)
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)

export const POST = withAuth(
  async (req: NextRequest) => {
    const body = await req.json()
    const type = String(body.type || '')
    const value = String(body.value || '').trim()
    const description = body.description
      ? String(body.description).trim()
      : null
    const isActive = body.is_active === undefined ? true : Boolean(body.is_active)

    if (!isAllowedType(type)) {
      return createErrorResponse(`Invalid type: ${type}`, 400, 'INVALID_TYPE')
    }
    if (!value) {
      return createErrorResponse('Value is required', 400, 'VALIDATION_ERROR')
    }

    try {
      const created = await prisma.bookCatalogValue.create({
        data: {
          type,
          value,
          description: description || null,
          is_active: isActive
        }
      })
      try {
        // Same `as any` pattern used by the sections /
        // book-categories API routes — session.user.role
        // is typed as `string` by next-auth but every
        // server route in this codebase already trusts it
        // as a `UserRole`. The audit logger is best-effort
        // so a wrong cast here would just skip the log,
        // never break the response.
        const session = (await getServerSession(authOptions)) as any
        if (session?.user?.id) {
          await auditLogger.logAction(
            parseInt(session.user.id),
            session.user.role,
            'CREATE_BOOK_CATALOG_VALUE',
            `Created ${type} value: ${value} (#${created.id})`,
            req
          )
        }
      } catch {}
      return createSuccessResponse(created, 201 as any)
    } catch (err) {
      // Unique violation on (type, value) — surface a
      // friendly 409 instead of a raw 500.
      const e = err as { code?: string }
      if (e?.code === 'P2002') {
        return createErrorResponse(
          `A ${type} value with that text already exists.`,
          409,
          'DUPLICATE_ENTRY'
        )
      }
      console.error('POST /api/book-catalog-values error:', err)
      return createErrorResponse('Failed to create value', 500, 'SERVER_ERROR')
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
)
