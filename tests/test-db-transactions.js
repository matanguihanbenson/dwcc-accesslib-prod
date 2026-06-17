// Test if there are any book transactions in the database
const { PrismaClient } = require('@prisma/client');

const testBookTransactions = async () => {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing book transactions database...\n');
    
    // Check total count
    const totalCount = await prisma.bookTransaction.count();
    console.log(`Total book transactions: ${totalCount}`);
    
    if (totalCount > 0) {
      // Get first few records
      const samples = await prisma.bookTransaction.findMany({
        take: 3,
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
      
      console.log('\nSample transactions:');
      samples.forEach((tx, i) => {
        console.log(`${i + 1}. ID: ${tx.transaction_id}, Status: ${tx.status}`);
        console.log(`   Book: "${tx.book.title}" by ${tx.book.book_author}`);
        console.log(`   User: ${tx.user.full_name} (${tx.user.account_id})`);
        console.log(`   Created: ${tx.created_at}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
};

testBookTransactions();
