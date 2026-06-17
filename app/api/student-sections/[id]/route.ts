import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { auditLogger } from '@/lib/audit-logger'

// GET - Fetch single student section
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
    const sectionId = parseInt(id)
    if (isNaN(sectionId)) {
      return NextResponse.json(
        { error: 'Invalid section ID' },
        { status: 400 }
      )
    }

    const section = await prisma.section.findUnique({
      where: { section_id: sectionId },
      include: {
        grade_level: {
          select: {
            name: true,
            code: true,
            education_level: true
          }
        },
        strand: {
          select: {
            name: true,
            code: true,
            abbreviation: true
          }
        },
        _count: {
          select: {
            users: true
          }
        }
      }
    })

    if (!section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...section,
      student_count: section._count.users
    })

  } catch (error) {
    console.error('Error fetching student section:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update student section
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

    // Only SUPER_ADMIN and ADMIN can update sections
    if (token.role !== 'SUPER_ADMIN' && token.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { id } = await params
    const sectionId = parseInt(id)
    if (isNaN(sectionId)) {
      return NextResponse.json(
        { error: 'Invalid section ID' },
        { status: 400 }
      )
    }

    const { name, grade_level_id, strand_id, is_active } = await req.json()

    // Check if section exists
    const existingSection = await prisma.section.findUnique({
      where: { section_id: sectionId }
    })

    if (!existingSection) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      )
    }

    // Verify grade level exists if being changed
    if (grade_level_id && grade_level_id !== existingSection.grade_level_id) {
      const gradeLevel = await prisma.gradeLevel.findUnique({
        where: { grade_level_id: parseInt(grade_level_id) }
      })

      if (!gradeLevel) {
        return NextResponse.json(
          { error: 'Grade level not found' },
          { status: 404 }
        )
      }
    }

    // Verify strand exists if provided
    if (strand_id !== undefined && strand_id !== null) {
      const strand = await prisma.strand.findUnique({
        where: { strand_id: parseInt(strand_id) }
      })

      if (!strand) {
        return NextResponse.json(
          { error: 'Strand not found' },
          { status: 404 }
        )
      }
    }

    // Check for duplicate section name if name or grade level is changing
    if (name || grade_level_id) {
      const checkName = name ? name.trim() : existingSection.name
      const checkGradeId = grade_level_id ? parseInt(grade_level_id) : existingSection.grade_level_id

      const duplicateSection = await prisma.section.findFirst({
        where: {
          name: checkName,
          grade_level_id: checkGradeId,
          NOT: {
            section_id: sectionId
          }
        }
      })

      if (duplicateSection) {
        return NextResponse.json(
          { error: 'Section name already exists for this grade level' },
          { status: 400 }
        )
      }
    }

    // Update section
    const updatedSection = await prisma.section.update({
      where: { section_id: sectionId },
      data: {
        ...(name && { name: name.trim() }),
        ...(grade_level_id && { grade_level_id: parseInt(grade_level_id) }),
        ...(strand_id !== undefined && { strand_id: strand_id ? parseInt(strand_id) : null }),
        ...(is_active !== undefined && { is_active })
      },
      include: {
        grade_level: {
          select: {
            name: true,
            code: true
          }
        },
        strand: {
          select: {
            name: true,
            code: true
          }
        }
      }
    })

    // Log the action
    try {
      const actorId = parseInt((token?.sub as any) || '0')
      if (actorId > 0) {
        await auditLogger.logAction(
          actorId,
          token.role as any,
          'UPDATE_STUDENT_SECTION',
          `Updated student section: "${updatedSection.name}" for ${updatedSection.grade_level.name}`,
          req
        )
      }
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Student section updated successfully',
      data: updatedSection
    })

  } catch (error) {
    console.error('Error updating student section:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete student section (with student count check)
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

    // Only SUPER_ADMIN and ADMIN can delete sections
    if (token.role !== 'SUPER_ADMIN' && token.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { id } = await params
    const sectionId = parseInt(id)
    if (isNaN(sectionId)) {
      return NextResponse.json(
        { error: 'Invalid section ID' },
        { status: 400 }
      )
    }

    // Check if section exists and has students
    const section = await prisma.section.findUnique({
      where: { section_id: sectionId },
      include: {
        grade_level: {
          select: {
            name: true
          }
        },
        _count: {
          select: {
            users: true
          }
        }
      }
    })

    if (!section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      )
    }

    if (section._count.users > 0) {
      return NextResponse.json(
        { error: `Cannot delete section. ${section._count.users} student(s) are currently assigned to this section.` },
        { status: 400 }
      )
    }

    // Hard delete since no students
    await prisma.section.delete({
      where: { section_id: sectionId }
    })

    // Log the action
    try {
      const actorId = parseInt((token?.sub as any) || '0')
      if (actorId > 0) {
        await auditLogger.logAction(
          actorId,
          token.role as any,
          'DELETE_STUDENT_SECTION',
          `Deleted student section: "${section.name}" for ${section.grade_level.name}`,
          req
        )
      }
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Student section deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting student section:', error)
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
