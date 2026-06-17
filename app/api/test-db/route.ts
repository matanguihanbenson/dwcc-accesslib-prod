import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    console.log('🧪 Testing database connection...')
    
    // Test basic database connection
    const departmentCount = await prisma.department.count()
    const programCount = await prisma.program.count()
    
    console.log(`📊 Counts: Departments=${departmentCount}, Programs=${programCount}`)
    
    // Get actual data
    const departments = await prisma.department.findMany({
      take: 5, // Limit to first 5
      include: {
        programs: {
          select: {
            program_id: true,
            name: true,
            code: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })
    
    const programs = await prisma.program.findMany({
      take: 5, // Limit to first 5
      include: {
        department: {
          select: {
            name: true,
            code: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })
    
    console.log(`🔍 Query Results: ${departments.length} departments, ${programs.length} programs`)
    
    return NextResponse.json({
      success: true,
      message: 'Database test successful',
      data: {
        counts: {
          departments: departmentCount,
          programs: programCount
        },
        sample_data: {
          departments: departments,
          programs: programs
        }
      }
    })
  } catch (error) {
    console.error('❌ Database test failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Database test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
