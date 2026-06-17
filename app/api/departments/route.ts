import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse, getSearchParams } from '@/lib/api-utils'
import { PrismaClient } from '@prisma/client'
import { auditLogger } from '@/lib/audit-logger'
import { withDuplicatePreventionByBody } from '@/lib/duplicate-prevention'

// Create a fresh Prisma client for this API
const apiPrisma = new PrismaClient()

export const GET = async (req: NextRequest) => {
  try {
    const filters = getSearchParams(req)
    
    const where: any = {}
    
    // Only apply filters if they exist
      if (filters.query && filters.query.trim()) {
        where.OR = [
          { name: { contains: filters.query } },
          { code: { contains: filters.query } },
          { description: { contains: filters.query } },
        ]
    }
    
    // Apply status filter only when explicitly set to true/false
    if (filters.status === 'true') {
      where.is_active = true
    } else if (filters.status === 'false') {
      where.is_active = false
    }
    
    const departments = await apiPrisma.department.findMany({
      where,
      include: {
        programs: {
          select: {
            program_id: true,
            name: true,
            code: true
          }
        },
        _count: {
          select: {
            users: {
              where: {
                status: 'ACTIVE',
                archived_at: null,
                OR: [
                  { user_account: null },
                  { user_account: { role: 'USER' } }
                ]
              }
            }
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })
    
    // Transform to include user count
    const transformedDepartments = departments.map(dept => ({
      department_id: dept.department_id,
      name: dept.name,
      code: dept.code,
      description: dept.description,
      is_active: dept.is_active,
      created_at: dept.created_at,
      updated_at: dept.updated_at,
      archived_at: dept.archived_at,
      programs: dept.programs,
      user_count: dept._count.users
    }))
    
    return NextResponse.json(
      { success: true, data: transformedDepartments },
      { 
        headers: {
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    )
  } catch (error) {
    console.error('Error fetching departments:', error)
    return createErrorResponse('Failed to fetch departments', 500)
  }
}

export const POST = withDuplicatePreventionByBody(
  withAuth(
    async (req: NextRequest, session) => {
      try {
        const data = await req.json()
        
        // Validate required fields
        if (!data.name || !data.code) {
          return NextResponse.json({
            success: false,
            error: 'Name and code are required'
          }, { status: 400 })
        }
        
        // Check if department code already exists
        const existingDepartment = await apiPrisma.department.findFirst({
          where: { code: data.code }
        })
        
        if (existingDepartment) {
          return NextResponse.json({
            success: false,
            error: 'Department code already exists'
          }, { status: 400 })
        }
        
        const department = await apiPrisma.department.create({
          data: {
            name: data.name,
            code: data.code,
            description: data.description || null,
            is_active: true
          },
          include: {
            programs: {
              select: {
                program_id: true,
                name: true,
                code: true
              }
            }
          }
        })
        
        // Log the department creation
        try {
          await auditLogger.logDepartmentCreate(
            parseInt(session.user.id),
            session.user.role as UserRole,
            department.name,
            department.code,
            req
          )
        } catch (auditError) {
          console.error('Failed to log department creation:', auditError)
          // Don't fail the request if audit logging fails
        }
        
        return createSuccessResponse(department, 'Department created successfully', 201)
      } catch (error) {
        console.error('Error creating department:', error)
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create department'
        }, { status: 500 })
      }
    },
    [UserRole.SUPER_ADMIN]
  ),
  {
    keyFields: ['name', 'code'],
    ttl: 10000, // 10 seconds for department creation
  }
)
