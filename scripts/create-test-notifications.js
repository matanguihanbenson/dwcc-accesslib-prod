/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function createTestNotifications() {
  try {
    console.log('Creating test notifications...')

    // Get first few users to create notifications for
    const users = await prisma.user.findMany({
      include: { user_account: true },
      take: 5
    })

    if (users.length === 0) {
      console.log('No users found. Please create some users first.')
      return
    }

    const notifications = []
    
    for (const user of users) {
      if (!user.user_account) continue

      // Create various types of notifications
      notifications.push(
        {
          user_id: user.user_id,
          type: 'BOOK_OVERDUE',
          title: 'Book Overdue',
          message: `"Introduction to Computer Science" is 3 day(s) overdue. Please return it as soon as possible.`,
          status: 'QUEUED',
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          metadata: { bookTitle: 'Introduction to Computer Science', daysOverdue: 3 }
        },
        {
          user_id: user.user_id,
          type: 'LOCKER_ASSIGNED',
          title: 'Locker Assigned',
          message: `Locker L-${Math.floor(Math.random() * 100) + 1} has been assigned to you. Please return the key by ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}.`,
          status: 'QUEUED',
          created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        },
        {
          user_id: user.user_id,
          type: 'BOOK_APPROVED',
          title: 'Book Request Approved',
          message: `Your request for "Database Systems Concepts" has been approved. Please pick it up before ${new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString()}.`,
          status: 'QUEUED',
          created_at: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        },
        {
          user_id: user.user_id,
          type: 'SYSTEM_ALERT',
          title: 'Library Hours Update',
          message: 'Library hours have been updated for the holiday season. Please check the new schedule.',
          status: 'QUEUED',
          created_at: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        }
      )
    }

    // Create notifications in batches
    for (let i = 0; i < notifications.length; i += 10) {
      const batch = notifications.slice(i, i + 10)
      await prisma.notificationLog.createMany({
        data: batch
      })
    }

    console.log(`Created ${notifications.length} test notifications for ${users.length} users`)
    
    // Show summary
    const totalNotifications = await prisma.notificationLog.count()
    const unreadCount = await prisma.notificationLog.count({
      where: { read_at: null }
    })
    
    console.log(`Total notifications in database: ${totalNotifications}`)
    console.log(`Unread notifications: ${unreadCount}`)

  } catch (error) {
    console.error('Error creating test notifications:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestNotifications()
