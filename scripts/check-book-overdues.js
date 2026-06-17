const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkBookOverdues() {
  try {
    console.log('=== CHECKING BOOK OVERDUES FOR ACCOUNT ID 12345 ===\n')
    
    // Find the user first
    const user = await prisma.user.findFirst({
      where: { account_id: '12345' }
    })
    
    if (!user) {
      console.log('User not found!')
      return
    }
    
    console.log(`User: ${user.full_name} (${user.account_id})`)
    console.log(`User ID: ${user.user_id}\n`)
    
    // Get all book transactions for this user
    const bookTransactions = await prisma.bookTransaction.findMany({
      where: {
        user_id: user.user_id
      },
      include: {
        book: {
          select: {
            title: true,
            book_author: true
          }
        }
      },
      orderBy: {
        borrow_date: 'desc'
      }
    })
    
    console.log(`Total book transactions: ${bookTransactions.length}\n`)
    
    const now = new Date()
    
    bookTransactions.forEach((tx, index) => {
      const dueDate = tx.due_date ? new Date(tx.due_date) : null
      const isOverdue = dueDate && dueDate < now
      const isReturned = !!tx.return_date
      const daysOverdue = dueDate && !isReturned ? Math.floor((now - dueDate) / (1000 * 60 * 60 * 24)) : 0
      
      console.log(`${index + 1}. Transaction ID: ${tx.transaction_id}`)
      console.log(`   Book: ${tx.book.title}`)
      console.log(`   Author: ${tx.book.book_author}`)
      console.log(`   Borrow Date: ${tx.borrow_date}`)
      console.log(`   Due Date: ${tx.due_date}`)
      console.log(`   Return Date: ${tx.return_date || 'NOT RETURNED'}`)
      console.log(`   Penalty: ₱${tx.penalty}`)
      console.log(`   Status: ${tx.status}`)
      console.log(`   Is Overdue: ${isOverdue ? `YES (${daysOverdue} days)` : 'NO'}`)
      console.log(`   Is Returned: ${isReturned ? 'YES' : 'NO'}`)
      console.log('')
    })
    
    // Check for settlements
    console.log('=== CHECKING SETTLEMENTS ===\n')
    
    const settlements = await prisma.overdueSettlement.findMany({
      where: {
        user_id: user.user_id,
        transaction_type: 'BOOK'
      }
    })
    
    console.log(`Book settlements found: ${settlements.length}\n`)
    
    settlements.forEach((s, index) => {
      console.log(`${index + 1}. Settlement ID: ${s.settlement_id}`)
      console.log(`   Transaction ID: ${s.transaction_id}`)
      console.log(`   Penalty: ₱${s.penalty_amount}`)
      console.log(`   Paid: ₱${s.amount_paid}`)
      console.log(`   Balance: ₱${s.remaining_balance}`)
      console.log(`   Status: ${s.status}`)
      console.log('')
    })
    
    // Check overdue page query
    console.log('=== SIMULATING OVERDUE PAGE QUERY ===\n')
    
    const currentDate = new Date()
    
    // Get overdue settlements (PENDING/PARTIAL)
    const overdueSettlements = await prisma.overdueSettlement.findMany({
      where: {
        transaction_type: 'BOOK',
        status: { in: ['PENDING', 'PARTIAL'] }
      }
    })
    
    // Fetch books
    const overdueBooks = await prisma.bookTransaction.findMany({
      where: {
        OR: [
          {
            due_date: { lt: currentDate },
            return_date: null
          },
          {
            transaction_id: {
              in: overdueSettlements.map(s => s.transaction_id)
            }
          }
        ]
      },
      include: {
        book: {
          select: {
            title: true
          }
        },
        user: {
          select: {
            full_name: true,
            account_id: true
          }
        }
      }
    })
    
    console.log(`Books that should appear on overdue page: ${overdueBooks.length}\n`)
    
    overdueBooks.forEach((book, index) => {
      console.log(`${index + 1}. ${book.user.full_name} (${book.user.account_id}) - ${book.book.title}`)
      console.log(`   Returned: ${book.return_date ? 'YES' : 'NO'}`)
      console.log(`   Penalty: ₱${book.penalty}`)
      console.log('')
    })
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkBookOverdues()

