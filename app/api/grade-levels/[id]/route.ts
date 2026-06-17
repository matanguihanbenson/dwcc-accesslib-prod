import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { auditLogger } from '@/lib/audit-logger'
import { EducationLevel } from '@prisma/client'

// GET - Fetch single grade level
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req })
    
    if (!token?.role) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id } = await params
    const gradeLevelId = parseInt(id)
    if (isNaN(gradeLevelId)) {
      return NextResponse.json(
        { error: 'Invalid grade level ID' },
        { status: 400 }
      )
    }

    const gradeLevel = await prisma.gradeLevel.findUnique({
      where: { grade_level_id: gradeLevelId },
      include: {
        _count: {
          select: {
            sections: true,
            users: true
          }
        }
      }
    })

    if (!gradeLevel) {
      return NextResponse.json(
        { error: 'Grade level not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...gradeLevel,
      section_count: gradeLevel._count.sections,
      student_count: gradeLevel._count.users
    })

  } catch (error) {
    console.error('Error fetching grade level:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update grade level
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req })
    
    if (!token?.role) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only SUPER_ADMIN and ADMIN can update grade levels
    if (token.role !== 'SUPER_ADMIN' && token.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { id } = await params
    const gradeLevelId = parseInt(id)
    if (isNaN(gradeLevelId)) {
      return NextResponse.json(
        { error: 'Invalid grade level ID' },
        { status: 400 }
      )
    }

    const { name, code, level_number, education_level, is_active } = await req.json()

    // Check if grade level exists
    const existingGrade = await prisma.gradeLevel.findUnique({
      where: { grade_level_id: gradeLevelId }
    })

    if (!existingGrade) {
      return NextResponse.json(
        { error: 'Grade level not found' },
        { status: 404 }
      )
    }

    // Check for duplicate code if code is being changed
    if (code && code !== existingGrade.code) {
      const duplicateCode = await prisma.gradeLevel.findUnique({
        where: { code: code.trim().toUpperCase() }
      })

      if (duplicateCode) {
        return NextResponse.json(
          { error: 'Grade level code already exists' },
          { status: 400 }
        )
      }
    }

    // Validate education level if provided
    if (education_level) {
      const validLevels: EducationLevel[] = [
        'KINDERGARTEN',
        'ELEMENTARY',
        'JUNIOR_HIGH',
        'SENIOR_HIGH',
        'COLLEGE',
        'GRADUATE_SCHOOL'
      ]

      if (!validLevels.includes(education_level)) {
        return NextResponse.json(
          { error: 'Invalid education level' },
          { status: 400 }
        )
      }
    }

    // Update grade level
    const updatedGrade = await prisma.gradeLevel.update({
      where: { grade_level_id: gradeLevelId },
      data: {
        ...(name && { name: name.trim() }),
        ...(code && { code: code.trim().toUpperCase() }),
        ...(level_number !== undefined && { level_number: parseInt(level_number) }),
        ...(education_level && { education_level }),
        ...(is_active !== undefined && { is_active })
      }
    })

    // Log the action
    try {
      const actorId = parseInt((token?.sub as any) || '0')
      if (actorId > 0) {
        await auditLogger.logAction(
          actorId,
          token.role as any,
          'UPDATE_GRADE_LEVEL',
          `Updated grade level: "${updatedGrade.name}" (Code: ${updatedGrade.code})`,
          req
        )
      }
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Grade level updated successfully',
      data: updatedGrade
    })

  } catch (error) {
    console.error('Error updating grade level:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete grade level (with cascade check)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req })
    
    if (!token?.role) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only SUPER_ADMIN and ADMIN can delete grade levels
    if (token.role !== 'SUPER_ADMIN' && token.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { id } = await params
    const gradeLevelId = parseInt(id)
    if (isNaN(gradeLevelId)) {
      return NextResponse.json(
        { error: 'Invalid grade level ID' },
        { status: 400 }
      )
    }

    // Check if grade level exists and has sections or students
    const gradeLevel = await prisma.gradeLevel.findUnique({
      where: { grade_level_id: gradeLevelId },
      include: {
        _count: {
          select: {
            sections: true,
            users: true
          }
        }
      }
    })

    if (!gradeLevel) {
      return NextResponse.json(
        { error: 'Grade level not found' },
        { status: 404 }
      )
    }

    if (gradeLevel._count.sections > 0) {
      return NextResponse.json(
        { error: `Cannot delete grade level. ${gradeLevel._count.sections} section(s) are currently assigned to this grade level.` },
        { status: 400 }
      )
    }

    if (gradeLevel._count.users > 0) {
      return NextResponse.json(
        { error: `Cannot delete grade level. ${gradeLevel._count.users} student(s) are currently assigned to this grade level.` },
        { status: 400 }
      )
    }

    // Hard delete since no dependencies
    await prisma.gradeLevel.delete({
      where: { grade_level_id: gradeLevelId }
    })

    // Log the action
    try {
      const actorId = parseInt((token?.sub as any) || '0')
      if (actorId > 0) {
        await auditLogger.logAction(
          actorId,
          token.role as any,
          'DELETE_GRADE_LEVEL',
          `Deleted grade level: "${gradeLevel.name}" (Code: ${gradeLevel.code})`,
          req
        )
      }
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Grade level deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting grade level:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Partial update (alias for PUT)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return PUT(req, { params })
}
