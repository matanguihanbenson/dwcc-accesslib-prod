const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testBorrowingTransactions() {
  try {
    console.log('Testing book transactions...');
    
    // Get all book transactions
    const allTransactions = await prisma.bookTransaction.findMany({
      include: {
        book: {
          select: {
            title: true,
            book_author: true
          }
        },
        user: {
          select: {
            full_name: true,
            account_id: true
          }
        }
      }
    });
    
    console.log('All book transactions:', allTransactions.length);
    allTransactions.forEach(tx => {
      console.log(`- ID: ${tx.transaction_id}, Status: ${tx.status}, Book: ${tx.book?.title}, User: ${tx.user?.full_name}, Due: ${tx.due_date}, Return: ${tx.return_date}`);
    });
    
    // Get only ACTIVE transactions
    const activeTransactions = await prisma.bookTransaction.findMany({
      where: {
        status: 'ACTIVE'
      },
      include: {
        book: {
          select: {
            title: true,
            book_author: true
          }
        },
        user: {
          select: {
            full_name: true,
            account_id: true
          }
        }
      }
    });
    
    console.log('\nACTIVE book transactions:', activeTransactions.length);
    activeTransactions.forEach(tx => {
      const isOverdue = tx.due_date && new Date(tx.due_date) < new Date();
      console.log(`- ID: ${tx.transaction_id}, Book: ${tx.book?.title}, User: ${tx.user?.full_name}, Due: ${tx.due_date}, Overdue: ${isOverdue}`);
    });
    
    // Get overdue transactions
    const overdueTransactions = await prisma.bookTransaction.findMany({
      where: {
        status: 'ACTIVE',
        due_date: {
          lt: new Date()
        },
        return_date: null
      },
      include: {
        book: {
          select: {
            title: true,
            book_author: true
          }
        },
        user: {
          select: {
            full_name: true,
            account_id: true
          }
        }
      }
    });
    
    console.log('\nOVERDUE book transactions:', overdueTransactions.length);
    overdueTransactions.forEach(tx => {
      const daysOverdue = Math.ceil((new Date().getTime() - new Date(tx.due_date).getTime()) / (1000 * 60 * 60 * 24));
      console.log(`- ID: ${tx.transaction_id}, Book: ${tx.book?.title}, User: ${tx.user?.full_name}, Days overdue: ${daysOverdue}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBorrowingTransactions();
