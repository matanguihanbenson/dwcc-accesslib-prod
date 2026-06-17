const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testLibraryUsersAPI() {
  console.log('Testing the exact query from userService.getLibraryUsers...');
  
  // This is the exact query from the service
  const result = await prisma.user.findMany({
    where: {
      OR: [
        { user_account: null },
        { user_account: { role: 'USER' } }
      ],
    },
    include: {
      department_ref: {
        select: {
          department_id: true,
          name: true,
          code: true,
          is_active: true
        }
      },
      program: {
        select: {
          program_id: true,
          name: true,
          code: true,
          is_active: true
        }
      }
    }
  });
  
  console.log('Total library users found:', result.length);
  
  result.forEach(user => {
    console.log('User:', {
      user_id: user.user_id,
      full_name: user.full_name,
      account_id: user.account_id,
      user_type: user.user_type,
      status: user.status,
      department: user.department_ref ? user.department_ref.name : null,
      course: user.program ? user.program.name : null,
      created_at: user.created_at
    });
  });
  
  await prisma.$disconnect();
}

testLibraryUsersAPI().catch(console.error);
