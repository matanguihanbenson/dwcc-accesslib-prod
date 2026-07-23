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

// Whitelist of level values, mirrored from the
// BookClassificationLevel enum in the Prisma schema.
const ALLOWED_LEVELS: BookClassificationLevel[] = [
  'MAIN_CLASS',
  'DIVISION',
  'SECTION',
  'DECIMAL_SUBDIVISION',
  'DEEPER_SUBDIVISION'
]
const isAllowedLevel = (v: string): v is BookClassificationLevel =>
  (ALLOWED_LEVELS as string[]).includes(v)

export const GET = withAuth(
  async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url)
      const parentParam = searchParams.get('parent_id')
      const levelParam = searchParams.get('level')
      const rootsParam = searchParams.get('roots')
      const showAll = searchParams.get('all') === 'true'
      const search = searchParams.get('search') || ''

      const where: Prisma.BookClassificationWhereInput = {}
      if (showAll) {
        // Explicit "all" — no is_active filter (used by the
        // cataloging-setup manager so deactivated rows stay
        // visible for re-activation).
      } else {
        where.is_active = true
      }
      if (parentParam === 'null' || parentParam === '') {
        // Convention: ?parent_id=null (or empty) means
        // "the root nodes" (Main Classes). Convenient for
        // the "list all main classes" query.
        where.parent_id = null
      } else if (parentParam) {
        const pid = parseInt(parentParam)
        if (Number.isFinite(pid)) {
          where.parent_id = pid
        }
      }
      if (rootsParam === '1' || rootsParam === 'true') {
        where.parent_id = null
      }
      if (levelParam) {
        if (!isAllowedLevel(levelParam)) {
          return createErrorResponse(`Invalid level: ${levelParam}`, 400, 'INVALID_LEVEL')
        }
        where.level = levelParam
      }
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { code: { contains: search } }
        ]
      }

      const items = await prisma.bookClassification.findMany({
        where,
        orderBy: [{ level: 'asc' }, { code: 'asc' }]
      })
      return createSuccessResponse(items)
    } catch (error) {
      console.error('Error fetching book classifications:', error)
      return createErrorResponse('Failed to fetch book classifications', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)

export const POST = withAuth(
  async (req: NextRequest, session) => {
    try {
      if (
        !hasPermission(session.user.role as UserRole, [
          UserRole.SUPER_ADMIN,
          UserRole.ADMIN
        ])
      ) {
        return createErrorResponse('Forbidden', 403, 'FORBIDDEN')
      }

      const body = await req.json()
      const code = String(body.code || '').trim()
      const name = String(body.name || '').trim()
      const description = body.description
        ? String(body.description).trim()
        : null
      const level = String(body.level || '')
      const isActive = body.is_active === undefined ? true : Boolean(body.is_active)
      const parentIdRaw = body.parent_id
      const parentId =
        parentIdRaw === null || parentIdRaw === undefined || parentIdRaw === ''
          ? null
          : parseInt(String(parentIdRaw))

      if (!code) {
        return createErrorResponse('Code is required', 400, 'VALIDATION_ERROR')
      }
      if (!name) {
        return createErrorResponse('Name is required', 400, 'VALIDATION_ERROR')
      }
      if (!isAllowedLevel(level)) {
        return createErrorResponse(`Invalid level: ${level}`, 400, 'INVALID_LEVEL')
      }
      if (parentId !== null && (!Number.isFinite(parentId) || parentId <= 0)) {
        return createErrorResponse('Invalid parent_id', 400, 'VALIDATION_ERROR')
      }

      // Enforce the parent-level hierarchy in code:
      //   - MAIN_CLASS must have parent_id = null
      //   - DIVISION's parent must be a MAIN_CLASS
      //   - SECTION's parent must be a DIVISION
      //   - DECIMAL_SUBDIVISION's parent must be a SECTION
      //   - DEEPER_SUBDIVISION's parent must be a
      //     DECIMAL_SUBDIVISION or another DEEPER_SUBDIVISION
      if (parentId !== null) {
        const parent = await prisma.bookClassification.findUnique({
          where: { id: parentId }
        })
        if (!parent) {
          return createErrorResponse('Parent classification not found', 400, 'PARENT_NOT_FOUND')
        }
        const expectedParentLevel: Record<BookClassificationLevel, BookClassificationLevel[]> = {
          MAIN_CLASS: [],
          DIVISION: ['MAIN_CLASS'],
          SECTION: ['DIVISION'],
          DECIMAL_SUBDIVISION: ['SECTION'],
          DEEPER_SUBDIVISION: ['DECIMAL_SUBDIVISION', 'DEEPER_SUBDIVISION']
        }
        const allowed = expectedParentLevel[level]
        if (!allowed.includes(parent.level)) {
          return createErrorResponse(
            `A ${level} cannot be a child of a ${parent.level}. Expected parent level: ${allowed.join(' or ')}.`,
            400,
            'INVALID_PARENT_LEVEL'
          )
        }
        if (!parent.is_active) {
          return createErrorResponse(
            'Cannot add a child to a deactivated parent classification',
            400,
            'PARENT_INACTIVE'
          )
        }
      } else {
        // MAIN_CLASS must be a root.
        if (level !== 'MAIN_CLASS') {
          return createErrorResponse(
            `A ${level} must have a parent classification (only MAIN_CLASS can be a root).`,
            400,
            'ROOT_LEVEL_INVALID'
          )
        }
      }

      try {
        const created = await prisma.bookClassification.create({
          data: {
            code,
            name,
            description: description || null,
            level,
            is_active: isActive,
            parent_id: parentId
          }
        })
        try {
          const actorId = parseInt((session.user as any).id || '0')
          if (actorId > 0) {
            await auditLogger.logAction(
              actorId,
              session.user.role as UserRole,
              'CREATE_BOOK_CLASSIFICATION',
              `Created book classification: "${created.code} ${created.name}" (Level: ${created.level}${created.parent_id ? `, Parent ID: ${created.parent_id}` : ', root'})`,
              req
            )
          }
        } catch {}
        return createSuccessResponse(created, 201 as any)
      } catch (err: any) {
        const e = err as { code?: string; meta?: { target?: string | string[] } }
        if (e?.code === 'P2002') {
          const target = Array.isArray(e.meta?.target)
            ? e.meta?.target.join(', ')
            : e.meta?.target
          return createErrorResponse(
            `A classification with that code already exists in this scope (${target ?? 'unique constraint'}).`,
            409,
            'DUPLICATE_ENTRY'
          )
        }
        throw err
      }
    } catch (error) {
      console.error('Error creating book classification:', error)
      return createErrorResponse('Failed to create book classification', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
