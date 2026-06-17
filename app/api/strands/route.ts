import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { auditLogger } from '@/lib/audit-logger'

// GET - Fetch all strands with student counts
export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })
    
    if (!token?.role) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only SUPER_ADMIN and ADMIN can view strands
    if (token.role !== 'SUPER_ADMIN' && token.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const isActive = searchParams.get('is_active')

    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { abbreviation: { contains: search } }
      ]
    }

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.is_active = isActive === 'true'
    }

    const strands = await prisma.strand.findMany({
      where,
      include: {
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
        { is_active: 'desc' },
        { name: 'asc' }
      ]
    })

    // Transform to include student count
    const transformedStrands = strands.map(strand => ({
      strand_id: strand.strand_id,
      name: strand.name,
      code: strand.code,
      abbreviation: strand.abbreviation,
      is_active: strand.is_active,
      created_at: strand.created_at,
      updated_at: strand.updated_at,
      student_count: strand._count.users
    }))

    return NextResponse.json(transformedStrands, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    })

  } catch (error) {
    console.error('Error fetching strands:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new strand
export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req })
    
    if (!token?.role) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Only SUPER_ADMIN and ADMIN can create strands
    if (token.role !== 'SUPER_ADMIN' && token.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { name, code, abbreviation } = await req.json()

    // Validate required fields
    if (!name || !code || !abbreviation) {
      return NextResponse.json(
        { error: 'Name, code, and abbreviation are required' },
        { status: 400 }
      )
    }

    // Check for duplicate code
    const existingStrand = await prisma.strand.findUnique({
      where: { code }
    })

    if (existingStrand) {
      return NextResponse.json(
        { error: 'Strand code already exists' },
        { status: 400 }
      )
    }

    // Create strand
    const strand = await prisma.strand.create({
      data: {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        abbreviation: abbreviation.trim().toUpperCase(),
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
          'CREATE_STRAND',
          `Created strand: "${strand.name}" (Code: ${strand.code})`,
          req
        )
      }
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Strand created successfully',
      data: strand
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating strand:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
