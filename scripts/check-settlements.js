const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkSettlements() {
  try {
    console.log('=== CHECKING OVERDUE SETTLEMENTS ===\n')
    
    // Get all settlements
    const allSettlements = await prisma.overdueSettlement.findMany({
      include: {
        user: {
          select: {
            full_name: true,
            account_id: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      take: 20
    })
    
    console.log(`Total settlements found: ${allSettlements.length}\n`)
    
    const bookSettlements = allSettlements.filter(s => s.transaction_type === 'BOOK')
    const lockerSettlements = allSettlements.filter(s => s.transaction_type === 'LOCKER')
    
    console.log(`Book settlements: ${bookSettlements.length}`)
    console.log(`Locker settlements: ${lockerSettlements.length}\n`)
    
    console.log('=== SETTLEMENT DETAILS ===\n')
    
    allSettlements.forEach((s, index) => {
      console.log(`${index + 1}. Settlement ID: ${s.settlement_id}`)
      console.log(`   Type: ${s.transaction_type}`)
      console.log(`   Transaction ID: ${s.transaction_id}`)
      console.log(`   User: ${s.user.full_name} (${s.user.account_id})`)
      console.log(`   Penalty: ₱${s.penalty_amount}`)
      console.log(`   Paid: ₱${s.amount_paid}`)
      console.log(`   Balance: ₱${s.remaining_balance}`)
      console.log(`   Status: ${s.status}`)
      console.log(`   Created: ${s.created_at}`)
      console.log('')
    })
    
    // Group by user
    console.log('=== PENALTIES BY USER ===\n')
    const userMap = new Map()
    
    allSettlements.forEach(s => {
      if (!userMap.has(s.user_id)) {
        userMap.set(s.user_id, {
          user: s.user,
          book_count: 0,
          locker_count: 0,
          book_total: 0,
          locker_total: 0
        })
      }
      
      const userStats = userMap.get(s.user_id)
      if (s.transaction_type === 'BOOK') {
        userStats.book_count++
        userStats.book_total += Number(s.remaining_balance)
      } else {
        userStats.locker_count++
        userStats.locker_total += Number(s.remaining_balance)
      }
    })
    
    userMap.forEach((stats, userId) => {
      console.log(`${stats.user.full_name} (${stats.user.account_id}):`)
      console.log(`  Books: ${stats.book_count} (₱${stats.book_total.toFixed(2)})`)
      console.log(`  Lockers: ${stats.locker_count} (₱${stats.locker_total.toFixed(2)})`)
      console.log(`  Total: ₱${(stats.book_total + stats.locker_total).toFixed(2)}`)
      console.log('')
    })
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkSettlements()

