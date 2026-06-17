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
    const programId = parseInt(resolvedParams.id)
    
    if (isNaN(programId)) {
      return createErrorResponse('Invalid program ID', 400)
    }

    const program = await prisma.program.findUnique({
      where: { program_id: programId },
      include: {
        department: {
          select: {
            department_id: true,
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

    if (!program) {
      return createErrorResponse('Program not found', 404)
    }

    return createSuccessResponse(program)
  } catch (error) {
    console.error('Error fetching program:', error)
    return createErrorResponse('Failed to fetch program', 500)
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
    const programId = parseInt(resolvedParams.id)
    
    if (isNaN(programId)) {
      return createErrorResponse('Invalid program ID', 400)
    }

    const data = await req.json()
    
    // Validate required fields
    if (!data.name || !data.code || !data.department_id) {
      return createErrorResponse('Name, code, and department are required', 400)
    }

    // Check if program exists
    const existingProgram = await prisma.program.findUnique({
      where: { program_id: programId },
      include: {
        department: true
      }
    })

    if (!existingProgram) {
      return createErrorResponse('Program not found', 404)
    }

    // Check if program code already exists (excluding current program)
    const codeExists = await prisma.program.findFirst({
      where: { 
        code: data.code,
        program_id: { not: programId }
      }
    })
    
    if (codeExists) {
      return createErrorResponse('Program code already exists', 400)
    }

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { department_id: data.department_id }
    })
    
    if (!department) {
      return createErrorResponse('Department not found', 400)
    }

    const updatedProgram = await prisma.program.update({
      where: { program_id: programId },
      data: {
        name: data.name,
        code: data.code,
        description: data.description || null,
        department_id: data.department_id,
        is_active: data.is_active !== undefined ? data.is_active : existingProgram.is_active
      },
      include: {
        department: {
          select: {
            department_id: true,
            name: true,
            code: true
          }
        }
      }
    })

    // Log the program update
    try {
      const changes = []
      if (existingProgram.name !== updatedProgram.name) {
        changes.push(`name: "${existingProgram.name}" → "${updatedProgram.name}"`)
      }
      if (existingProgram.code !== updatedProgram.code) {
        changes.push(`code: "${existingProgram.code}" → "${updatedProgram.code}"`)
      }
      if (existingProgram.description !== updatedProgram.description) {
        changes.push(`description: "${existingProgram.description || 'none'}" → "${updatedProgram.description || 'none'}"`)
      }
      if (existingProgram.department_id !== updatedProgram.department_id) {
        changes.push(`department: "${existingProgram.department.name}" → "${department.name}"`)
      }
      if (existingProgram.is_active !== updatedProgram.is_active) {
        changes.push(`status: ${existingProgram.is_active ? 'active' : 'inactive'} → ${updatedProgram.is_active ? 'active' : 'inactive'}`)
      }
      
      await auditLogger.logProgramUpdate(
        parseInt(session.user.id),
        session.user.role as UserRole,
        updatedProgram.name,
        changes,
        req
      )
    } catch (auditError) {
      console.error('Failed to log program update:', auditError)
      // Don't fail the request if audit logging fails
    }

    return createSuccessResponse(updatedProgram, 'Program updated successfully')
  } catch (error) {
    console.error('Error updating program:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to update program', 
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
    const programId = parseInt(resolvedParams.id)
    
    if (isNaN(programId)) {
      return createErrorResponse('Invalid program ID', 400)
    }

    // Check if program exists
    const existingProgram = await prisma.program.findUnique({
      where: { program_id: programId },
      include: {
        users: true
      }
    })

    if (!existingProgram) {
      return createErrorResponse('Program not found', 404)
    }

    // Check if program has associated users
    if (existingProgram.users.length > 0) {
      return createErrorResponse('Cannot delete program with associated users', 400)
    }

    await prisma.program.delete({
      where: { program_id: programId }
    })

    // Log the program deletion
    try {
      await auditLogger.logProgramDelete(
        parseInt(session.user.id),
        session.user.role as UserRole,
        existingProgram.name,
        req
      )
    } catch (auditError) {
      console.error('Failed to log program deletion:', auditError)
      // Don't fail the request if audit logging fails
    }

    return createSuccessResponse(null, 'Program deleted successfully')
  } catch (error) {
    console.error('Error deleting program:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to delete program', 
      500
    )
  }
}
