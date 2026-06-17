const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTransactions() {
  try {
    console.log('=== Checking Active Transactions ===');
    const activeTransactions = await prisma.bookTransaction.findMany({
      where: { status: 'ACTIVE' },
      include: {
        book: { select: { title: true } },
        user: { select: { full_name: true, account_id: true } }
      }
    });
    
    console.log('Active transactions:', activeTransactions.length);
    activeTransactions.forEach(tx => {
      console.log(`- ID: ${tx.transaction_id}, Book: ${tx.book?.title}, User: ${tx.user?.full_name}, Status: ${tx.status}, Return date: ${tx.return_date}`);
    });
    
    console.log('\n=== Checking Completed Transactions ===');
    const completedTransactions = await prisma.bookTransaction.findMany({
      where: { status: 'COMPLETED' },
      include: {
        book: { select: { title: true } },
        user: { select: { full_name: true, account_id: true } }
      }
    });
    
    console.log('Completed transactions:', completedTransactions.length);
    completedTransactions.forEach(tx => {
      console.log(`- ID: ${tx.transaction_id}, Book: ${tx.book?.title}, User: ${tx.user?.full_name}, Status: ${tx.status}, Return date: ${tx.return_date}`);
    });
    
    console.log('\n=== Checking ALL Transactions (most recent 10) ===');
    const allTransactions = await prisma.bookTransaction.findMany({
      include: {
        book: { select: { title: true } },
        user: { select: { full_name: true, account_id: true } }
      },
      orderBy: { updated_at: 'desc' },
      take: 10
    });
    
    allTransactions.forEach(tx => {
      console.log(`- ID: ${tx.transaction_id}, Book: ${tx.book?.title}, User: ${tx.user?.full_name}, Status: ${tx.status}, Return date: ${tx.return_date}, Updated: ${tx.updated_at}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTransactions();
