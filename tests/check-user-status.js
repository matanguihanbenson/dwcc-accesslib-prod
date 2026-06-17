const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserStatus() {
  console.log('Checking all users and their account status...');
  
  const allUsers = await prisma.user.findMany({
    include: {
      user_account: {
        select: {
          id: true,
          username: true,
          role: true,
          is_active: true
        }
      }
    }
  });
  
  console.log('\nAll users in system:');
  allUsers.forEach(user => {
    console.log(`ID: ${user.user_id}, Name: ${user.full_name}, Account ID: ${user.account_id}`);
    console.log(`  Status: ${user.status}, User Type: ${user.user_type}`);
    if (user.user_account) {
      console.log(`  Has Account: Yes, Role: ${user.user_account.role}, Active: ${user.user_account.is_active}`);
    } else {
      console.log(`  Has Account: No`);
    }
    console.log('---');
  });
  
  console.log('\nFiltering for library users (no account OR USER role):');
  const libraryUsers = allUsers.filter(user => 
    !user.user_account || user.user_account.role === 'USER'
  );
  
  console.log(`Found ${libraryUsers.length} library users:`);
  libraryUsers.forEach(user => {
    console.log(`- ${user.full_name} (${user.account_id}) - ${user.user_account?.role || 'No Account'}`);
  });
  
  await prisma.$disconnect();
}

checkUserStatus().catch(console.error);
