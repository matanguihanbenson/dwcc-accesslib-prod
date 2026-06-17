import { NextRequest, NextResponse } from 'next/server'
import { withAuth, createSuccessResponse, createErrorResponse, validateId } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/types'
import { AuditService } from '@/lib/services/audit.service'

// POST /api/lockers/[id]/bind-rfid - Bind RFID to locker
export const POST = withAuth(
  async (req: NextRequest, session: any, { params }: { params: Promise<{ id: string }> }) => {
    try {
      console.log('RFID Bind - Session:', { id: session?.user?.id, role: session?.user?.role, username: session?.user?.username })
      console.log('RFID Bind - Params:', params)
      
      const resolvedParams = await params
      const lockerId = validateId(resolvedParams.id, 'Locker ID')
      const body = await req.json()
      const { rfid_code } = body
      
      console.log('RFID Bind - Validated:', { lockerId, rfid_code })

      if (!rfid_code || !rfid_code.trim()) {
        return createErrorResponse('RFID code is required', 400)
      }

      // Check if locker exists
      const locker = await prisma.locker.findUnique({
        where: { locker_id: lockerId }
      })

      if (!locker) {
        return createErrorResponse('Locker not found', 404)
      }

      // Check if RFID is already bound to another locker
      const existingRfid = await prisma.locker.findFirst({
        where: {
          rfid_code: rfid_code.trim(),
          locker_id: { not: lockerId },
          archived_at: null
        }
      })

      if (existingRfid) {
        return createErrorResponse(
          `RFID code is already bound to locker ${existingRfid.locker_number}`,
          409
        )
      }

      const existingUser = await prisma.user.findFirst({
        where: {
          rfid_code: rfid_code.trim()
        },
        select: {
          user_id: true,
          full_name: true,
          account_id: true
        }
      })

      if (existingUser) {
        return createErrorResponse(
          `RFID code is already bound to ${existingUser.full_name} (${existingUser.account_id})`,
          409
        )
      }

      // Bind RFID to locker
      const updated = await prisma.locker.update({
        where: { locker_id: lockerId },
        data: { rfid_code: rfid_code.trim() }
      })

      // Log the action
      await AuditService.logAction(
        parseInt(session.user.id),
        session.user.role as UserRole,
        'BIND_RFID_LOCKER',
        `Bound RFID ${rfid_code.trim()} to locker ${updated.locker_number}`
      )

      return createSuccessResponse(
        updated,
        `RFID successfully bound to locker ${updated.locker_number}`
      )
    } catch (error) {
      console.error('Error binding RFID to locker:', error)
      return createErrorResponse('Failed to bind RFID to locker', 500)
    }
  },
  [UserRole.ADMIN, UserRole.SUPER_ADMIN]
)

// DELETE /api/lockers/[id]/bind-rfid - Unbind RFID from locker
export const DELETE = withAuth(
  async (req: NextRequest, session: any, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const resolvedParams = await params
      const lockerId = validateId(resolvedParams.id, 'Locker ID')

      // Check if locker exists
      const locker = await prisma.locker.findUnique({
        where: { locker_id: lockerId }
      })

      if (!locker) {
        return createErrorResponse('Locker not found', 404)
      }

      if (!locker.rfid_code) {
        return createErrorResponse('No RFID bound to this locker', 400)
      }

      // Unbind RFID
      const updated = await prisma.locker.update({
        where: { locker_id: lockerId },
        data: { rfid_code: null }
      })

      // Log the action
      await AuditService.logAction(
        parseInt(session.user.id),
        session.user.role as UserRole,
        'UNBIND_RFID_LOCKER',
        `Unbound RFID from locker ${updated.locker_number}`
      )

      return createSuccessResponse(
        updated,
        `RFID successfully unbound from locker ${updated.locker_number}`
      )
    } catch (error) {
      console.error('Error unbinding RFID from locker:', error)
      return createErrorResponse('Failed to unbind RFID from locker', 500)
    }
  },
  [UserRole.ADMIN, UserRole.SUPER_ADMIN]
)

