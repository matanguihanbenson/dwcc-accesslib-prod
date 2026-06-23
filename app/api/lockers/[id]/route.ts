import { NextRequest, NextResponse } from 'next/server'
import { withAuth, createSuccessResponse, createErrorResponse, validateId } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { UserRole, Campus } from '@/types'
import { AuditService } from '@/lib/services/audit.service'

// PATCH /api/lockers/[id] - Update locker (Admin only)
export const PATCH = withAuth(
  async (req: NextRequest, session: any, { params }: { params: Promise<{ id: string }> }) => {
    try {
      console.log('Update Locker - Session:', { id: session?.user?.id, role: session?.user?.role, username: session?.user?.username })
      console.log('Update Locker - Params:', params)
      
      const resolvedParams = await params
      const lockerId = validateId(resolvedParams.id, 'Locker ID')
      const body = await req.json()
      const { locker_number, location, status, unarchive, campus } = body

      console.log('Update Locker - Validated:', { lockerId, locker_number, location, status, campus })

      // Check if locker exists
      const existing = await prisma.locker.findUnique({
        where: { locker_id: lockerId }
      })

      if (!existing) {
        return createErrorResponse('Locker not found', 404)
      }

      // If changing locker number, check for duplicates
      if (locker_number && locker_number !== existing.locker_number) {
        const duplicate = await prisma.locker.findFirst({
          where: {
            locker_number,
            locker_id: { not: lockerId },
            archived_at: null
          }
        })

        if (duplicate) {
          return createErrorResponse('Locker number already exists', 409)
        }
      }

      const updateData: any = {}
      if (locker_number) updateData.locker_number = locker_number
      if (location) updateData.location = location
      if (status) updateData.status = status
      // Allow re-designating the locker's campus from the update
      // modal. Validate against the Campus enum so a typo can't
      // silently misroute assignments.
      if (campus === Campus.COLLEGE || campus === Campus.BASIC_EDUCATION) {
        updateData.campus = campus
      }

      if (unarchive === true) {
        if (existing.rfid_code) {
          const conflictingLocker = await prisma.locker.findFirst({
            where: {
              archived_at: null,
              rfid_code: existing.rfid_code,
              locker_id: { not: lockerId }
            },
            select: { locker_id: true, locker_number: true }
          })

          const conflictingUser = await prisma.user.findFirst({
            where: { rfid_code: existing.rfid_code },
            select: { user_id: true, full_name: true, account_id: true }
          })

          const shouldUnbind = body?.unbind_rfid === true || body?.resolve_conflict === 'unbind'
          if ((conflictingLocker || conflictingUser) && !shouldUnbind) {
            return NextResponse.json({
              success: false,
              error: 'RFID_CONFLICT',
              message: conflictingLocker
                ? `RFID is already bound to locker ${conflictingLocker.locker_number}. Unbind to proceed.`
                : `RFID is already bound to ${conflictingUser!.full_name} (${conflictingUser!.account_id}). Unbind to proceed.`,
              conflict: {
                type: conflictingLocker ? 'locker' : 'user',
                locker: conflictingLocker || null,
                user: conflictingUser || null,
                rfid_code: existing.rfid_code
              }
            }, { status: 409 })
          }

          if (shouldUnbind) {
            updateData.rfid_code = null
          }
        }

        updateData.archived_at = null
        if (!status) updateData.status = 'AVAILABLE'
      }

      const updated = await prisma.locker.update({
        where: { locker_id: lockerId },
        data: updateData
      })

      // Log the action
      await AuditService.logAction(
        parseInt(session.user.id),
        session.user.role as UserRole,
        'UPDATE_LOCKER',
        campus
          ? `Updated locker ${updated.locker_number} (re-designated campus to ${updated.campus})`
          : `Updated locker ${updated.locker_number}`
      )

      return createSuccessResponse(updated, 'Locker updated successfully')
    } catch (error) {
      console.error('Error updating locker:', error)
      return createErrorResponse('Failed to update locker', 500)
    }
  },
  [UserRole.ADMIN, UserRole.SUPER_ADMIN]
)

// DELETE /api/lockers/[id] - Archive locker (Admin only)
export const DELETE = withAuth(
  async (req: NextRequest, session: any, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const resolvedParams = await params
      const lockerId = validateId(resolvedParams.id, 'Locker ID')

      // Check if locker exists and is not occupied
      const locker = await prisma.locker.findUnique({
        where: { locker_id: lockerId },
        include: {
          locker_transactions: {
            where: { return_time: null }
          }
        }
      })

      if (!locker) {
        return createErrorResponse('Locker not found', 404)
      }

      if (locker.locker_transactions.length > 0) {
        return createErrorResponse('Cannot archive locker that is currently occupied', 400)
      }

      // Soft delete by setting archived_at
      const archived = await prisma.locker.update({
        where: { locker_id: lockerId },
        data: {
          archived_at: new Date(),
          status: 'ARCHIVED'
        }
      })

      // Log the action
      await AuditService.logAction(
        parseInt(session.user.id),
        session.user.role as UserRole,
        'ARCHIVE_LOCKER',
        `Archived locker ${archived.locker_number}`
      )

      return createSuccessResponse(null, 'Locker archived successfully')
    } catch (error) {
      console.error('Error archiving locker:', error)
      return createErrorResponse('Failed to archive locker', 500)
    }
  },
  [UserRole.ADMIN, UserRole.SUPER_ADMIN]
)

