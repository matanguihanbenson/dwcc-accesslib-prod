const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserAccounts() {
  try {
    console.log('=== Checking User Accounts Status ===');
    const userAccounts = await prisma.userAccount.findMany({
      where: {
        role: 'STAFF'
      },
      include: {
        user: {
          select: {
            full_name: true,
            account_id: true
          }
        }
      }
    });
    
    console.log('Staff accounts:', userAccounts.length);
    userAccounts.forEach(account => {
      console.log(`- ID: ${account.id}, Username: ${account.username}, Active: ${account.is_active}, Name: ${account.user?.full_name}, Account ID: ${account.user?.account_id}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserAccounts();
