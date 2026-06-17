const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testUserSummary() {
  try {
    // Get user by account_id
    const user = await prisma.user.findFirst({
      where: { account_id: '12345' }
    })
    
    console.log('User lookup by account_id 12345:')
    console.log('  user_id:', user?.user_id)
    console.log('  full_name:', user?.full_name)
    console.log('')
    
    if (!user) {
      console.log('User not found!')
      return
    }
    
    // Get all settlements for this user (PENDING/PARTIAL)
    const settlements = await prisma.overdueSettlement.findMany({
      where: {
        user_id: user.user_id,
        status: { in: ['PENDING', 'PARTIAL'] }
      }
    })
    
    console.log(`Settlements for user_id ${user.user_id}: ${settlements.length}`)
    console.log('')
    
    settlements.forEach(s => {
      console.log(`  - ${s.transaction_type} Transaction ${s.transaction_id}`)
      console.log(`    Penalty: ₱${s.penalty_amount}`)
      console.log(`    Balance: ₱${s.remaining_balance}`)
      console.log(`    Status: ${s.status}`)
      console.log('')
    })
    
    // Now test what the API would return
    const bookSettlements = settlements.filter(s => s.transaction_type === 'BOOK')
    const lockerSettlements = settlements.filter(s => s.transaction_type === 'LOCKER')
    
    console.log(`Book settlements: ${bookSettlements.length}`)
    console.log(`Locker settlements: ${lockerSettlements.length}`)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testUserSummary()

