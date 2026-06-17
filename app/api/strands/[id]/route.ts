import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { auditLogger } from '@/lib/audit-logger'

// GET - Fetch single strand
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
    const strandId = parseInt(id)
    if (isNaN(strandId)) {
      return NextResponse.json(
        { error: 'Invalid strand ID' },
        { status: 400 }
      )
    }

    const strand = await prisma.strand.findUnique({
      where: { strand_id: strandId },
      include: {
        _count: {
          select: {
            users: true
          }
        }
      }
    })

    if (!strand) {
      return NextResponse.json(
        { error: 'Strand not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...strand,
      student_count: strand._count.users
    })

  } catch (error) {
    console.error('Error fetching strand:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update strand
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

    // Only SUPER_ADMIN and ADMIN can update strands
    if (token.role !== 'SUPER_ADMIN' && token.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { id } = await params
    const strandId = parseInt(id)
    if (isNaN(strandId)) {
      return NextResponse.json(
        { error: 'Invalid strand ID' },
        { status: 400 }
      )
    }

    const { name, code, abbreviation, is_active } = await req.json()

    // Check if strand exists
    const existingStrand = await prisma.strand.findUnique({
      where: { strand_id: strandId }
    })

    if (!existingStrand) {
      return NextResponse.json(
        { error: 'Strand not found' },
        { status: 404 }
      )
    }

    // Check for duplicate code if code is being changed
    if (code && code !== existingStrand.code) {
      const duplicateCode = await prisma.strand.findUnique({
        where: { code: code.trim().toUpperCase() }
      })

      if (duplicateCode) {
        return NextResponse.json(
          { error: 'Strand code already exists' },
          { status: 400 }
        )
      }
    }

    // Update strand
    const updatedStrand = await prisma.strand.update({
      where: { strand_id: strandId },
      data: {
        ...(name && { name: name.trim() }),
        ...(code && { code: code.trim().toUpperCase() }),
        ...(abbreviation && { abbreviation: abbreviation.trim().toUpperCase() }),
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
          'UPDATE_STRAND',
          `Updated strand: "${updatedStrand.name}" (Code: ${updatedStrand.code})`,
          req
        )
      }
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Strand updated successfully',
      data: updatedStrand
    })

  } catch (error) {
    console.error('Error updating strand:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Archive/Delete strand
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

    // Only SUPER_ADMIN and ADMIN can delete strands
    if (token.role !== 'SUPER_ADMIN' && token.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { id } = await params
    const strandId = parseInt(id)
    if (isNaN(strandId)) {
      return NextResponse.json(
        { error: 'Invalid strand ID' },
        { status: 400 }
      )
    }

    // Check if strand exists and has students
    const strand = await prisma.strand.findUnique({
      where: { strand_id: strandId },
      include: {
        _count: {
          select: {
            users: true
          }
        }
      }
    })

    if (!strand) {
      return NextResponse.json(
        { error: 'Strand not found' },
        { status: 404 }
      )
    }

    if (strand._count.users > 0) {
      return NextResponse.json(
        { error: `Cannot delete strand. ${strand._count.users} student(s) are currently assigned to this strand.` },
        { status: 400 }
      )
    }

    // Soft delete by setting archived_at
    const deletedStrand = await prisma.strand.update({
      where: { strand_id: strandId },
      data: {
        is_active: false,
        archived_at: new Date()
      }
    })

    // Log the action
    try {
      const actorId = parseInt((token?.sub as any) || '0')
      if (actorId > 0) {
        await auditLogger.logAction(
          actorId,
          token.role as any,
          'DELETE_STRAND',
          `Archived strand: "${strand.name}" (Code: ${strand.code})`,
          req
        )
      }
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Strand archived successfully',
      data: deletedStrand
    })

  } catch (error) {
    console.error('Error deleting strand:', error)
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
