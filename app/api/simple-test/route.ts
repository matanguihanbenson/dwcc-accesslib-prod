import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

// Create a fresh Prisma client for this test
const testPrisma = new PrismaClient()

export async function GET(req: NextRequest) {
  try {
    console.log('=== SIMPLE TEST API ===')
    
    // Test 1: Raw count
    const deptCount = await testPrisma.department.count()
    console.log('Department count:', deptCount)
    
    // Test 2: Simple findMany
    const departments = await testPrisma.department.findMany()
    console.log('Departments found:', departments.length)
    
    // Test 3: Raw SQL
    const rawResult = await testPrisma.$queryRaw`SELECT COUNT(*) as count FROM department`
    console.log('Raw SQL result:', rawResult)
    
    console.log('=== END TEST ===')
    
    return NextResponse.json({
      success: true,
      data: {
        count: deptCount,
        departments: departments,
        rawResult: rawResult
      }
    })
  } catch (error) {
    console.error('Simple test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
