import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { auditLogger } from '@/lib/audit-logger'
import { EducationLevel } from '@prisma/client'

// GET - Fetch all grade levels with section and student counts
export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })
    
    if (!token?.role) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only SUPER_ADMIN and ADMIN can view grade levels
    if (token.role !== 'SUPER_ADMIN' && token.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const educationLevel = searchParams.get('education_level') as EducationLevel | null
    const isActive = searchParams.get('is_active')
    const search = searchParams.get('search') || ''

    const where: any = {}

    if (educationLevel) {
      where.education_level = educationLevel
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } }
      ]
    }

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.is_active = isActive === 'true'
    }

    const gradeLevels = await prisma.gradeLevel.findMany({
      where,
      include: {
        _count: {
          select: {
            sections: true,
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
        { education_level: 'asc' },
        { level_number: 'asc' }
      ]
    })

    // Transform to include counts
    const transformedGradeLevels = gradeLevels.map(grade => ({
      grade_level_id: grade.grade_level_id,
      name: grade.name,
      code: grade.code,
      level_number: grade.level_number,
      education_level: grade.education_level,
      is_active: grade.is_active,
      created_at: grade.created_at,
      updated_at: grade.updated_at,
      section_count: grade._count.sections,
      student_count: grade._count.users
    }))

    return NextResponse.json(transformedGradeLevels, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    })

  } catch (error) {
    console.error('Error fetching grade levels:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new grade level
export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req })
    
    if (!token?.role) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only SUPER_ADMIN and ADMIN can create grade levels
    if (token.role !== 'SUPER_ADMIN' && token.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { name, code, level_number, education_level } = await req.json()

    // Validate required fields
    if (!name || !code || level_number === undefined || !education_level) {
      return NextResponse.json(
        { error: 'Name, code, level number, and education level are required' },
        { status: 400 }
      )
    }

    // Validate education level
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

    // Check for duplicate code
    const existingGrade = await prisma.gradeLevel.findUnique({
      where: { code }
    })

    if (existingGrade) {
      return NextResponse.json(
        { error: 'Grade level code already exists' },
        { status: 400 }
      )
    }

    // Create grade level
    const gradeLevel = await prisma.gradeLevel.create({
      data: {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        level_number: parseInt(level_number),
        education_level,
        is_active: true
      }
    })

    // Log the action
    try {
      const actorId = parseInt((token?.sub as any) || '0')
      if (actorId > 0) {
        await auditLogger.logAction(
          actorId,
          token.role as any,
          'CREATE_GRADE_LEVEL',
          `Created grade level: "${gradeLevel.name}" (Code: ${gradeLevel.code}, Level: ${education_level})`,
          req
        )
      }
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Grade level created successfully',
      data: gradeLevel
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating grade level:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
