import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse, getSearchParams } from '@/lib/api-utils'
import { PrismaClient } from '@prisma/client'
import { auditLogger } from '@/lib/audit-logger'
import { withDuplicatePreventionByBody } from '@/lib/duplicate-prevention'

const apiPrisma = new PrismaClient()

export const GET = async (req: NextRequest) => {
  try {
    const filters = getSearchParams(req)
    
    const where: any = {}
    
    if (filters.query && filters.query.trim()) {
      where.OR = [
          { name: { contains: filters.query } },
          { code: { contains: filters.query } },
          { description: { contains: filters.query } },
      ]
    }
    
    if (filters.status === 'true') {
      where.is_active = true
    } else if (filters.status === 'false') {
      where.is_active = false
    }
    
    const offices = await apiPrisma.office.findMany({
      where,
      orderBy: {
        created_at: 'desc'
      }
    })
    
    return createSuccessResponse(offices)
  } catch (error) {
    console.error('Error fetching offices:', error)
    return createErrorResponse('Failed to fetch offices', 500)
  }
}

export const POST = withDuplicatePreventionByBody(
  withAuth(
    async (req: NextRequest, session) => {
      try {
        const data = await req.json()
        
        if (!data.name || !data.code) {
          return NextResponse.json({
            success: false,
            error: 'Name and code are required'
          }, { status: 400 })
        }
        
        const existingOffice = await apiPrisma.office.findFirst({
          where: { code: data.code }
        })
        
        if (existingOffice) {
          return NextResponse.json({
            success: false,
            error: 'Office code already exists'
          }, { status: 400 })
        }
        
        const office = await apiPrisma.office.create({
          data: {
            name: data.name,
            code: data.code,
            description: data.description || null,
            is_active: true
          }
        })
        
        try {
          await auditLogger.logAction(
            parseInt(session.user.id),
            session.user.role as UserRole,
            'CREATE_OFFICE',
            `Created office: ${office.name} (${office.code})`,
            req
          )
        } catch (auditError) {
          console.error('Failed to log office creation:', auditError)
        }
        
        return createSuccessResponse(office, 'Office created successfully', 201)
      } catch (error) {
        console.error('Error creating office:', error)
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create office'
        }, { status: 500 })
      }
    },
    [UserRole.SUPER_ADMIN]
  ),
  {
    keyFields: ['name', 'code'],
    ttl: 10000,
  }
)

