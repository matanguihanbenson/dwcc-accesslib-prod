// Test script to debug departments and programs API
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testDatabase() {
  try {
    console.log('=== DATABASE CONNECTION TEST ===')
    
    // Test database connection
    await prisma.$connect()
    console.log('✅ Database connected successfully')
    
    // Count records
    const deptCount = await prisma.department.count()
    const progCount = await prisma.program.count()
    
    console.log(`📊 Database Records:`)
    console.log(`   - Departments: ${deptCount}`)
    console.log(`   - Programs: ${progCount}`)
    
    if (deptCount === 0) {
      console.log('❌ No departments found in database')
      return
    }
    
    if (progCount === 0) {
      console.log('❌ No programs found in database')
      return
    }
    
    // Sample data
    console.log('\n=== SAMPLE DATA ===')
    
    const sampleDepts = await prisma.department.findMany({
      take: 3,
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
    
    console.log('📋 Sample Departments:')
    sampleDepts.forEach(dept => {
      console.log(`   - ${dept.name} (${dept.code}): ${dept.programs.length} programs`)
    })
    
    const sampleProgs = await prisma.program.findMany({
      take: 3,
      include: {
        department: {
          select: {
            name: true,
            code: true
          }
        }
      }
    })
    
    console.log('\n📋 Sample Programs:')
    sampleProgs.forEach(prog => {
      console.log(`   - ${prog.name} (${prog.code}) - Dept: ${prog.department?.name}`)
    })
    
    console.log('\n✅ Database test completed successfully')
    
  } catch (error) {
    console.error('❌ Database test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

async function testAPIStructure() {
  console.log('\n=== API STRUCTURE SIMULATION ===')
  
  try {
    // Simulate the departments API query
    const departments = await prisma.department.findMany({
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
    
    console.log(`🔗 Departments API would return: ${departments.length} records`)
    console.log('📦 Response structure:', {
      success: true,
      data: departments.slice(0, 1) // Show first record structure
    })
    
    // Simulate the programs API query
    const programs = await prisma.program.findMany({
      include: {
        department: true
      },
      orderBy: {
        created_at: 'desc'
      }
    })
    
    console.log(`\n🔗 Programs API would return: ${programs.length} records`)
    console.log('📦 Response structure:', {
      success: true,
      data: programs.slice(0, 1) // Show first record structure
    })
    
  } catch (error) {
    console.error('❌ API simulation failed:', error)
  }
}

// Run tests
async function runAllTests() {
  await testDatabase()
  await testAPIStructure()
}

runAllTests().catch(console.error)
