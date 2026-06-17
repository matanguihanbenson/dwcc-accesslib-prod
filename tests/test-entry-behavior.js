// Test entry monitoring behavior
const { PrismaClient } = require('@prisma/client');

const testEntryMonitoring = async () => {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing entry monitoring behavior...\n');
    
    // Get a sample user
    const user = await prisma.user.findFirst({
      where: { status: 'ACTIVE' },
      select: { user_id: true, full_name: true, account_id: true }
    });
    
    if (!user) {
      console.log('No active users found');
      return;
    }
    
    console.log(`Testing with user: ${user.full_name} (${user.account_id})`);
    
    // Check current active entries for this user
    const activeEntries = await prisma.entryLog.findMany({
      where: {
        user_id: user.user_id,
        exit_time: null
      },
      orderBy: { entry_time: 'desc' }
    });
    
    console.log(`\nActive entries for this user: ${activeEntries.length}`);
    if (activeEntries.length > 0) {
      activeEntries.forEach((entry, i) => {
        console.log(`${i + 1}. Entry ID: ${entry.entry_id}, Entry Time: ${entry.entry_time}`);
      });
    }
    
    // Get recent entries (both active and exited)
    const recentEntries = await prisma.entryLog.findMany({
      where: { user_id: user.user_id },
      orderBy: { entry_time: 'desc' },
      take: 5
    });
    
    console.log(`\nRecent 5 entries for this user:`);
    recentEntries.forEach((entry, i) => {
      const status = entry.exit_time ? 'EXITED' : 'INSIDE';
      console.log(`${i + 1}. ID: ${entry.entry_id}, Status: ${status}`);
      console.log(`   Entry: ${entry.entry_time}`);
      if (entry.exit_time) {
        console.log(`   Exit:  ${entry.exit_time}`);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
};

testEntryMonitoring();
