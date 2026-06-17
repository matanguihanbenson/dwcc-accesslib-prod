const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDemotedUsers() {
  console.log('Checking users with USER role that have UserAccount...');
  
  const usersWithUserRole = await prisma.user.findMany({
    where: {
      user_account: {
        role: 'USER'
      }
    },
    include: {
      user_account: {
        select: {
          id: true,
          username: true,
          role: true,
          is_active: true
        }
      },
      department_ref: {
        select: {
          name: true
        }
      },
      program: {
        select: {
          name: true
        }
      }
    }
  });
  
  console.log('Found', usersWithUserRole.length, 'users with USER role accounts:');
  usersWithUserRole.forEach(user => {
    console.log('- ID:', user.user_id, 'Name:', user.full_name, 'Account ID:', user.account_id, 'Role:', user.user_account?.role, 'Active:', user.user_account?.is_active);
  });
  
  console.log('\nChecking library users query filter...');
  const libraryUsers = await prisma.user.findMany({
    where: {
      OR: [
        { user_account: null },
        { user_account: { role: 'USER' } }
      ],
    },
    include: {
      user_account: {
        select: {
          role: true,
          is_active: true
        }
      }
    },
    take: 10
  });
  
  console.log('Found', libraryUsers.length, 'total library users');
  libraryUsers.forEach(user => {
    console.log('- ID:', user.user_id, 'Name:', user.full_name, 'Account ID:', user.account_id, 'Has Account:', !!user.user_account, 'Role:', user.user_account?.role || 'None');
  });
  
  await prisma.$disconnect();
}

checkDemotedUsers().catch(console.error);
