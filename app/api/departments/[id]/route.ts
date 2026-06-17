import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { UserRole } from '@/types'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { auditLogger } from '@/lib/audit-logger'
import { authOptions } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== UserRole.SUPER_ADMIN) {
      return createErrorResponse('Unauthorized', 401)
    }

    const resolvedParams = await params
    const departmentId = parseInt(resolvedParams.id)
    
    if (isNaN(departmentId)) {
      return createErrorResponse('Invalid department ID', 400)
    }

    const department = await prisma.department.findUnique({
      where: { department_id: departmentId },
      include: {
        programs: {
          select: {
            program_id: true,
            name: true,
            code: true,
            is_active: true
          }
        },
        users: {
          select: {
            user_id: true,
            account_id: true,
            full_name: true,
            user_type: true,
            status: true
          }
        }
      }
    })

    if (!department) {
      return createErrorResponse('Department not found', 404)
    }

    return createSuccessResponse(department)
  } catch (error) {
    console.error('Error fetching department:', error)
    return createErrorResponse('Failed to fetch department', 500)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== UserRole.SUPER_ADMIN) {
      return createErrorResponse('Unauthorized', 401)
    }

    const resolvedParams = await params
    const departmentId = parseInt(resolvedParams.id)
    
    if (isNaN(departmentId)) {
      return createErrorResponse('Invalid department ID', 400)
    }

    const data = await req.json()

    // Check if department exists
    const existingDepartment = await prisma.department.findUnique({
      where: { department_id: departmentId }
    })

    if (!existingDepartment) {
      return createErrorResponse('Department not found', 404)
    }

    // For PATCH, allow partial updates
    const updateData: any = {}
    
    if (data.name !== undefined) updateData.name = data.name
    if (data.code !== undefined) updateData.code = data.code
    if (data.description !== undefined) updateData.description = data.description || null
    if (data.is_active !== undefined) updateData.is_active = data.is_active

    // Validate code if it's being updated
    if (data.code && data.code !== existingDepartment.code) {
      const codeExists = await prisma.department.findFirst({
        where: { 
          code: data.code,
          department_id: { not: departmentId }
        }
      })
      
      if (codeExists) {
        return createErrorResponse('Department code already exists', 400)
      }
    }

    const updatedDepartment = await prisma.department.update({
      where: { department_id: departmentId },
      data: updateData
    })

    // Log the department update
    try {
      const changes = []
      if (existingDepartment.is_active !== updatedDepartment.is_active) {
        changes.push(`status: ${existingDepartment.is_active ? 'active' : 'inactive'} → ${updatedDepartment.is_active ? 'active' : 'inactive'}`)
      }
      if (changes.length > 0) {
        await auditLogger.logAction(
          parseInt(session.user.id),
          session.user.role as UserRole,
          'UPDATE_DEPARTMENT',
          `Updated department: ${updatedDepartment.name} - ${changes.join(', ')}`,
          req
        )
      }
    } catch (auditError) {
      console.error('Failed to log department update:', auditError)
    }

    return createSuccessResponse(updatedDepartment, 'Department updated successfully')
  } catch (error) {
    console.error('Error updating department:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to update department', 
      500
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== UserRole.SUPER_ADMIN) {
      return createErrorResponse('Unauthorized', 401)
    }

    const resolvedParams = await params
    const departmentId = parseInt(resolvedParams.id)
    
    if (isNaN(departmentId)) {
      return createErrorResponse('Invalid department ID', 400)
    }

    const data = await req.json()
    
    // Validate required fields for PUT (full update)
    if (!data.name || !data.code) {
      return createErrorResponse('Name and code are required', 400)
    }

    // Check if department exists
    const existingDepartment = await prisma.department.findUnique({
      where: { department_id: departmentId }
    })

    if (!existingDepartment) {
      return createErrorResponse('Department not found', 404)
    }

    // Check if department code already exists (excluding current department)
    const codeExists = await prisma.department.findFirst({
      where: { 
        code: data.code,
        department_id: { not: departmentId }
      }
    })
    
    if (codeExists) {
      return createErrorResponse('Department code already exists', 400)
    }

    const updatedDepartment = await prisma.department.update({
      where: { department_id: departmentId },
      data: {
        name: data.name,
        code: data.code,
        description: data.description || null,
        is_active: data.is_active !== undefined ? data.is_active : existingDepartment.is_active
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

    // Log the department update
    try {
      const changes = []
      if (existingDepartment.name !== updatedDepartment.name) {
        changes.push(`name: "${existingDepartment.name}" → "${updatedDepartment.name}"`)
      }
      if (existingDepartment.code !== updatedDepartment.code) {
        changes.push(`code: "${existingDepartment.code}" → "${updatedDepartment.code}"`)
      }
      if (existingDepartment.description !== updatedDepartment.description) {
        changes.push(`description: "${existingDepartment.description || 'none'}" → "${updatedDepartment.description || 'none'}"`)
      }
      if (existingDepartment.is_active !== updatedDepartment.is_active) {
        changes.push(`status: ${existingDepartment.is_active ? 'active' : 'inactive'} → ${updatedDepartment.is_active ? 'active' : 'inactive'}`)
      }
      
      await auditLogger.logDepartmentUpdate(
        parseInt(session.user.id),
        session.user.role as UserRole,
        updatedDepartment.name,
        changes,
        req
      )
    } catch (auditError) {
      console.error('Failed to log department update:', auditError)
      // Don't fail the request if audit logging fails
    }

    return createSuccessResponse(updatedDepartment, 'Department updated successfully')
  } catch (error) {
    console.error('Error updating department:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to update department', 
      500
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== UserRole.SUPER_ADMIN) {
      return createErrorResponse('Unauthorized', 401)
    }

    const resolvedParams = await params
    const departmentId = parseInt(resolvedParams.id)
    
    if (isNaN(departmentId)) {
      return createErrorResponse('Invalid department ID', 400)
    }

    // Check if department exists
    const existingDepartment = await prisma.department.findUnique({
      where: { department_id: departmentId },
      include: {
        programs: true,
        users: true
      }
    })

    if (!existingDepartment) {
      return createErrorResponse('Department not found', 404)
    }

    // Check if department has associated programs or users
    if (existingDepartment.programs.length > 0) {
      return createErrorResponse('Cannot delete department with associated programs', 400)
    }

    if (existingDepartment.users.length > 0) {
      return createErrorResponse('Cannot delete department with associated users', 400)
    }

    await prisma.department.delete({
      where: { department_id: departmentId }
    })

    // Log the department deletion
    try {
      await auditLogger.logDepartmentDelete(
        parseInt(session.user.id),
        session.user.role as UserRole,
        existingDepartment.name,
        req
      )
    } catch (auditError) {
      console.error('Failed to log department deletion:', auditError)
      // Don't fail the request if audit logging fails
    }

    return createSuccessResponse(null, 'Department deleted successfully')
  } catch (error) {
    console.error('Error deleting department:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to delete department', 
      500
    )
  }
}

