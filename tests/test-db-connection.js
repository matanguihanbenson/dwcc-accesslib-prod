const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Check if we can run a simple query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Query test successful:', result);
    
    // Check departments table
    console.log('\n--- Checking departments table ---');
    const deptCount = await prisma.department.count();
    console.log('Department count:', deptCount);
    
    if (deptCount > 0) {
      const firstDept = await prisma.department.findFirst();
      console.log('First department:', firstDept);
    }
    
    // Check programs table
    console.log('\n--- Checking programs table ---');
    const progCount = await prisma.program.count();
    console.log('Program count:', progCount);
    
    if (progCount > 0) {
      const firstProg = await prisma.program.findFirst();
      console.log('First program:', firstProg);
    }
    
    // Test the exact query from the API
    console.log('\n--- Testing API query ---');
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
    });
    console.log('API query result count:', departments.length);
    
    const programs = await prisma.program.findMany({
      include: {
        department: true
      },
      orderBy: {
        created_at: 'desc'
      }
    });
    console.log('Programs API query result count:', programs.length);
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
