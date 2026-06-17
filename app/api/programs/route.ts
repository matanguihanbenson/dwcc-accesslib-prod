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
    
    if (filters.departmentId && filters.departmentId.trim()) {
      where.department_id = parseInt(filters.departmentId)
    }
    
    // Apply status filter only when explicitly set to true/false
    if (filters.status === 'true') {
      where.is_active = true
    } else if (filters.status === 'false') {
      where.is_active = false
    }
    
    const programs = await apiPrisma.program.findMany({
      where,
      include: {
        department: true,
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
    const transformedPrograms = programs.map(program => ({
      program_id: program.program_id,
      name: program.name,
      code: program.code,
      description: program.description,
      department_id: program.department_id,
      is_active: program.is_active,
      created_at: program.created_at,
      updated_at: program.updated_at,
      archived_at: program.archived_at,
      department: program.department,
      user_count: program._count.users
    }))
    
    return NextResponse.json(
      { success: true, data: transformedPrograms },
      { 
        headers: {
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    )
  } catch (error) {
    console.error('Error fetching programs:', error)
    return createErrorResponse('Failed to fetch programs', 500)
  }
}

export const POST = withDuplicatePreventionByBody(
  withAuth(
    async (req: NextRequest, session) => {
      try {
        const data = await req.json()
        
        // Validate required fields
        if (!data.name || !data.code || !data.department_id) {
          return NextResponse.json({
            success: false,
            error: 'Name, code, and department are required'
          }, { status: 400 })
        }
        
        // Check if program code already exists
        const existingProgram = await apiPrisma.program.findFirst({
          where: { code: data.code }
        })
        
        if (existingProgram) {
          return NextResponse.json({
            success: false,
            error: 'Program code already exists'
          }, { status: 400 })
        }
        
        // Check if department exists
        const department = await apiPrisma.department.findUnique({
          where: { department_id: data.department_id }
        })
        
        if (!department) {
          return NextResponse.json({
            success: false,
            error: 'Department not found'
          }, { status: 400 })
        }
        
        const program = await apiPrisma.program.create({
          data: {
            name: data.name,
            code: data.code,
            description: data.description || null,
            department_id: data.department_id,
            is_active: true
          },
          include: {
            department: true
          }
        })
        
        // Log the program creation
        await auditLogger.logProgramCreate(
          parseInt(session.user.id),
          session.user.role as UserRole,
          program.name,
          program.code,
          program.department.name,
          req
        )
        
        return createSuccessResponse(program, 'Program created successfully', 201)
      } catch (error) {
        console.error('Error creating program:', error)
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create program'
        }, { status: 500 })
      }
    },
    [UserRole.SUPER_ADMIN]
  ),
  {
    keyFields: ['name', 'code', 'department_id'],
    ttl: 10000, // 10 seconds for program creation
  }
)
