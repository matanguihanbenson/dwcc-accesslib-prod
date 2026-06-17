import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { PrismaClient } from '@prisma/client'
import { auditLogger } from '@/lib/audit-logger'

const apiPrisma = new PrismaClient()

export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params
    const officeId = parseInt(id)
    
    const office = await apiPrisma.office.findUnique({
      where: { office_id: officeId }
    })
    
    if (!office) {
      return createErrorResponse('Office not found', 404)
    }
    
    return createSuccessResponse(office)
  } catch (error) {
    console.error('Error fetching office:', error)
    return createErrorResponse('Failed to fetch office', 500)
  }
}

export const PATCH = withAuth(
  async (req: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params
      const officeId = parseInt(id)
      const data = await req.json()
      
      // Check if office exists
      const existingOffice = await apiPrisma.office.findUnique({
        where: { office_id: officeId }
      })

      if (!existingOffice) {
        return createErrorResponse('Office not found', 404)
      }

      // Build update data (partial update)
      const updateData: any = {}
      
      if (data.name !== undefined) updateData.name = data.name
      if (data.code !== undefined) updateData.code = data.code
      if (data.description !== undefined) updateData.description = data.description || null
      if (data.is_active !== undefined) updateData.is_active = data.is_active

      const office = await apiPrisma.office.update({
        where: { office_id: officeId },
        data: updateData
      })
      
      try {
        const changes = []
        if (existingOffice.is_active !== office.is_active) {
          changes.push(`status: ${existingOffice.is_active ? 'active' : 'inactive'} → ${office.is_active ? 'active' : 'inactive'}`)
        }
        if (changes.length > 0) {
          await auditLogger.logAction(
            parseInt(session.user.id),
            session.user.role as UserRole,
            'UPDATE_OFFICE',
            `Updated office: ${office.name} - ${changes.join(', ')}`,
            req
          )
        }
      } catch (auditError) {
        console.error('Failed to log office update:', auditError)
      }
      
      return createSuccessResponse(office, 'Office updated successfully')
    } catch (error) {
      console.error('Error updating office:', error)
      return createErrorResponse('Failed to update office', 500)
    }
  },
  [UserRole.SUPER_ADMIN]
)

export const DELETE = withAuth(
  async (req: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params
      const officeId = parseInt(id)
      
      const office = await apiPrisma.office.update({
        where: { office_id: officeId },
        data: {
          archived_at: new Date(),
          is_active: false
        }
      })
      
      try {
        await auditLogger.logAction(
          parseInt(session.user.id),
          session.user.role as UserRole,
          'ARCHIVE_OFFICE',
          `Archived office: ${office.name} (${office.code})`,
          req
        )
      } catch (auditError) {
        console.error('Failed to log office archival:', auditError)
      }
      
      return createSuccessResponse(null, 'Office archived successfully')
    } catch (error) {
      console.error('Error archiving office:', error)
      return createErrorResponse('Failed to archive office', 500)
    }
  },
  [UserRole.SUPER_ADMIN]
)

