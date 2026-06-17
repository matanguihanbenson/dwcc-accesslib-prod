const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function seedDepartmentsAndPrograms() {
  try {
    console.log('Starting to seed departments and programs...')

    // First, let's check if there are any existing departments
    const existingDepartments = await prisma.department.findMany()
    console.log(`Found ${existingDepartments.length} existing departments`)

    // Add sample departments (even if some exist)
    console.log('Creating additional sample departments...')
    
    const departmentsToAdd = [
      {
        name: 'College of Engineering',
        code: 'COE',
        description: 'College of Engineering and Technology',
        is_active: true
      },
      {
        name: 'College of Arts and Sciences',
        code: 'CAS',
        description: 'College of Liberal Arts and Sciences',
        is_active: true
      },
      {
        name: 'College of Business',
        code: 'COB',
        description: 'College of Business Administration',
        is_active: true
      },
      {
        name: 'College of Education',
        code: 'COEd',
        description: 'College of Education and Human Development',
        is_active: true
      }
    ]
    
    for (const deptData of departmentsToAdd) {
      const existingDept = await prisma.department.findFirst({
        where: { code: deptData.code }
      })
      
      if (!existingDept) {
        await prisma.department.create({
          data: deptData
        })
        console.log(`Created department: ${deptData.name}`)
      } else {
        console.log(`Department ${deptData.name} already exists`)
      }
    }

    // Get all departments for programs
    const allDepartments = await prisma.department.findMany()
    console.log('Available departments:', allDepartments.map(d => `${d.name} (${d.code})`))

    // Check existing programs
    const existingPrograms = await prisma.program.findMany()
    console.log(`Found ${existingPrograms.length} existing programs`)

    // Add sample programs (even if some exist)
    console.log('Creating additional sample programs...')
    
    const coe = allDepartments.find(d => d.code === 'COE')
    const cas = allDepartments.find(d => d.code === 'CAS')
    const cob = allDepartments.find(d => d.code === 'COB')
    const coed = allDepartments.find(d => d.code === 'COEd')

    const programsToAdd = []

    if (coe) {
      programsToAdd.push(
        { name: 'Computer Science', code: 'CS', description: 'Bachelor of Science in Computer Science', department_id: coe.department_id, is_active: true },
        { name: 'Information Technology', code: 'IT', description: 'Bachelor of Science in Information Technology', department_id: coe.department_id, is_active: true },
        { name: 'Civil Engineering', code: 'CE', description: 'Bachelor of Science in Civil Engineering', department_id: coe.department_id, is_active: true },
        { name: 'Electrical Engineering', code: 'EE', description: 'Bachelor of Science in Electrical Engineering', department_id: coe.department_id, is_active: true }
      )
    }

    if (cas) {
      programsToAdd.push(
        { name: 'Psychology', code: 'PSYC', description: 'Bachelor of Arts in Psychology', department_id: cas.department_id, is_active: true },
        { name: 'English Literature', code: 'ENGL', description: 'Bachelor of Arts in English Literature', department_id: cas.department_id, is_active: true },
        { name: 'Mathematics', code: 'MATH', description: 'Bachelor of Science in Mathematics', department_id: cas.department_id, is_active: true },
        { name: 'Biology', code: 'BIO', description: 'Bachelor of Science in Biology', department_id: cas.department_id, is_active: true }
      )
    }

    if (cob) {
      programsToAdd.push(
        { name: 'Business Administration', code: 'BA', description: 'Bachelor of Science in Business Administration', department_id: cob.department_id, is_active: true },
        { name: 'Accounting', code: 'ACCT', description: 'Bachelor of Science in Accounting', department_id: cob.department_id, is_active: true },
        { name: 'Marketing', code: 'MKT', description: 'Bachelor of Science in Marketing', department_id: cob.department_id, is_active: true },
        { name: 'Finance', code: 'FIN', description: 'Bachelor of Science in Finance', department_id: cob.department_id, is_active: true }
      )
    }

    if (coed) {
      programsToAdd.push(
        { name: 'Elementary Education', code: 'ELED', description: 'Bachelor of Elementary Education', department_id: coed.department_id, is_active: true },
        { name: 'Secondary Education', code: 'SCED', description: 'Bachelor of Secondary Education', department_id: coed.department_id, is_active: true },
        { name: 'Special Education', code: 'SPED', description: 'Bachelor of Special Education', department_id: coed.department_id, is_active: true }
      )
    }

    for (const progData of programsToAdd) {
      const existingProg = await prisma.program.findFirst({
        where: { code: progData.code }
      })
      
      if (!existingProg) {
        await prisma.program.create({
          data: progData
        })
        console.log(`Created program: ${progData.name}`)
      } else {
        console.log(`Program ${progData.name} already exists`)
      }
    }

    // Final verification
    const finalDepartments = await prisma.department.findMany({
      include: {
        programs: true
      }
    })
    
    const finalPrograms = await prisma.program.findMany({
      include: {
        department: true
      }
    })

    console.log('\n=== FINAL RESULTS ===')
    console.log(`Total departments: ${finalDepartments.length}`)
    console.log(`Total programs: ${finalPrograms.length}`)
    
    finalDepartments.forEach(dept => {
      console.log(`- ${dept.name} (${dept.code}): ${dept.programs.length} programs`)
    })

  } catch (error) {
    console.error('Error seeding data:', error)
  } finally {
    await prisma.$disconnect()
  }
}

seedDepartmentsAndPrograms()
