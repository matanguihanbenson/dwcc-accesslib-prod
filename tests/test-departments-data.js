const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testDepartmentsData() {
  try {
    console.log('Testing database connection...')
    
    // Check departments
    const departmentCount = await prisma.department.count()
    console.log(`Total departments in database: ${departmentCount}`)
    
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
    
    console.log('Departments data:')
    console.log(JSON.stringify(departments, null, 2))
    
    // Check programs
    const programCount = await prisma.program.count()
    console.log(`\nTotal programs in database: ${programCount}`)
    
    const programs = await prisma.program.findMany({
      include: {
        department: true
      },
      orderBy: {
        created_at: 'desc'
      }
    })
    
    console.log('Programs data:')
    console.log(JSON.stringify(programs, null, 2))
    
  } catch (error) {
    console.error('Error testing database:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testDepartmentsData()
