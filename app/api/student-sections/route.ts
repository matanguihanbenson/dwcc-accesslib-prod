import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { auditLogger } from '@/lib/audit-logger'

// GET - Fetch all student sections with student counts
export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })
    
    if (!token?.role) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only SUPER_ADMIN and ADMIN can view sections
    if (token.role !== 'SUPER_ADMIN' && token.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const gradeLevelId = searchParams.get('grade_level_id')
    const strandId = searchParams.get('strand_id')
    const isActive = searchParams.get('is_active')
    const search = searchParams.get('search') || ''

    const where: any = {}

    if (gradeLevelId) {
      where.grade_level_id = parseInt(gradeLevelId)
    }

    if (strandId) {
      where.strand_id = parseInt(strandId)
    }

    if (search) {
      where.name = { contains: search }
    }

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.is_active = isActive === 'true'
    }

    const sections = await prisma.section.findMany({
      where,
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
            users: {
              where: {
                OR: [
                  { user_account: null },
                  { user_account: { role: 'USER' } }
                ]
              }
            }
          }
        }
      },
      orderBy: [
        { grade_level: { level_number: 'asc' } },
        { name: 'asc' }
      ]
    })

    // Transform to include student count
    const transformedSections = sections.map(section => ({
      section_id: section.section_id,
      name: section.name,
      grade_level_id: section.grade_level_id,
      strand_id: section.strand_id,
      is_active: section.is_active,
      created_at: section.created_at,
      updated_at: section.updated_at,
      grade_level: section.grade_level,
      strand: section.strand,
      student_count: section._count.users
    }))

    return NextResponse.json(transformedSections, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    })

  } catch (error) {
    console.error('Error fetching student sections:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new student section
export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req })
    
    if (!token?.role) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only SUPER_ADMIN and ADMIN can create sections
    if (token.role !== 'SUPER_ADMIN' && token.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { name, grade_level_id, strand_id } = await req.json()

    // Validate required fields
    if (!name || !grade_level_id) {
      return NextResponse.json(
        { error: 'Name and grade level are required' },
        { status: 400 }
      )
    }

    // Verify grade level exists
    const gradeLevel = await prisma.gradeLevel.findUnique({
      where: { grade_level_id: parseInt(grade_level_id) }
    })

    if (!gradeLevel) {
      return NextResponse.json(
        { error: 'Grade level not found' },
        { status: 404 }
      )
    }

    // Verify strand exists if provided
    if (strand_id) {
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

    // Check for duplicate section name within the same grade level
    const existingSection = await prisma.section.findFirst({
      where: {
        name: name.trim(),
        grade_level_id: parseInt(grade_level_id)
      }
    })

    if (existingSection) {
      return NextResponse.json(
        { error: 'Section name already exists for this grade level' },
        { status: 400 }
      )
    }

    // Create section
    const section = await prisma.section.create({
      data: {
        name: name.trim(),
        grade_level_id: parseInt(grade_level_id),
        strand_id: strand_id ? parseInt(strand_id) : null,
        is_active: true
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
        const strandInfo = section.strand ? ` - ${section.strand.name}` : ''
        await auditLogger.logAction(
          actorId,
          token.role as any,
          'CREATE_STUDENT_SECTION',
          `Created student section: "${section.name}" for ${section.grade_level.name}${strandInfo}`,
          req
        )
      }
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Student section created successfully',
      data: section
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating student section:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
