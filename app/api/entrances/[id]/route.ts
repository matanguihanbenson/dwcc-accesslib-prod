import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { auditLogger } from '@/lib/audit-logger'
import { UserRole } from '@prisma/client'

// PATCH /api/entrances/[id]
// Update an existing entrance (name, description, active
// flag). Campus is intentionally not editable: re-targeting
// an entrance to a different campus would silently move
// history into the wrong reporting bucket. Archive + create
// a new one if the campus ever needs to change.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req })
    if (!token?.role) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (token.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Only super admin can manage entrances' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const entranceId = parseInt(resolvedParams.id)
    if (isNaN(entranceId) || entranceId <= 0) {
      return NextResponse.json({ error: 'Invalid entrance ID' }, { status: 400 })
    }

    const body = await req.json()
    const { name, description, is_active } = body || {}

    const existing = await prisma.entrance.findUnique({
      where: { entrance_id: entranceId }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Entrance not found' }, { status: 404 })
    }

    const data: any = {}
    if (typeof name === 'string') {
      const trimmed = name.trim()
      if (!trimmed) {
        return NextResponse.json(
          { success: false, error: 'Name cannot be empty' },
          { status: 400 }
        )
      }
      if (trimmed !== existing.name) {
        const conflict = await prisma.entrance.findFirst({
          where: {
            name: trimmed,
            campus: existing.campus,
            archived_at: null,
            NOT: { entrance_id: entranceId }
          }
        })
        if (conflict) {
          return NextResponse.json(
            { success: false, error: `An entrance named "${trimmed}" already exists on the ${existing.campus} campus.` },
            { status: 409 }
          )
        }
      }
      data.name = trimmed
    }
    if (description !== undefined) {
      data.description = description === null || description === '' ? null : String(description).trim()
    }
    if (typeof is_active === 'boolean') {
      data.is_active = is_active
    }

    const updated = await prisma.entrance.update({
      where: { entrance_id: entranceId },
      data
    })

    try {
      const actorId = parseInt((token.sub as string) || '0')
      if (actorId > 0) {
        await auditLogger.logAction(
          actorId,
          token.role as any,
          'UPDATE_ENTRANCE',
          `Updated entrance "${updated.name}" (id ${updated.entrance_id}) on campus ${updated.campus}`,
          req
        )
      }
    } catch (e) {
      console.error('Failed to write entrance update audit log:', e)
    }

    return NextResponse.json({ success: true, data: updated, message: 'Entrance updated successfully' })
  } catch (error) {
    console.error('Error updating entrance:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/entrances/[id]
// Soft-archive an entrance. We never hard-delete: historical
// entrylog rows still reference this entrance via entrance_id
// and must remain readable.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req })
    if (!token?.role) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (token.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Only super admin can manage entrances' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const entranceId = parseInt(resolvedParams.id)
    if (isNaN(entranceId) || entranceId <= 0) {
      return NextResponse.json({ error: 'Invalid entrance ID' }, { status: 400 })
    }

    const existing = await prisma.entrance.findUnique({
      where: { entrance_id: entranceId }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Entrance not found' }, { status: 404 })
    }
    if (existing.archived_at) {
      return NextResponse.json({ success: true, data: existing, message: 'Entrance is already archived' })
    }

    const updated = await prisma.entrance.update({
      where: { entrance_id: entranceId },
      data: { archived_at: new Date(), is_active: false }
    })

    try {
      const actorId = parseInt((token.sub as string) || '0')
      if (actorId > 0) {
        await auditLogger.logAction(
          actorId,
          token.role as any,
          'ARCHIVE_ENTRANCE',
          `Archived entrance "${updated.name}" (id ${updated.entrance_id}) on campus ${updated.campus}`,
          req
        )
      }
    } catch (e) {
      console.error('Failed to write entrance archive audit log:', e)
    }

    return NextResponse.json({ success: true, data: updated, message: 'Entrance archived successfully' })
  } catch (error) {
    console.error('Error archiving entrance:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
