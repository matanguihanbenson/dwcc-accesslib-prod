/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function createSampleData() {
  try {
    console.log('Creating sample dashboard data...')

    // Get sample users
    const users = await prisma.user.findMany({
      include: { user_account: true },
      take: 10
    })

    if (users.length === 0) {
      console.log('No users found. Please create some users first.')
      return
    }

    const now = new Date()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Create sample entry logs for today
    const entryLogs = []
    const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
    
    for (let i = 0; i < 50; i++) {
      const randomUser = users[Math.floor(Math.random() * users.length)]
      const randomHour = hours[Math.floor(Math.random() * hours.length)]
      const randomMinute = Math.floor(Math.random() * 60)
      
      const entryTime = new Date(today)
      entryTime.setHours(randomHour, randomMinute)
      
      entryLogs.push({
        user_id: randomUser.user_id,
        rfid_code: `RFID${randomUser.user_id}${i}`,
        date_time_log: entryTime
      })
    }

    await prisma.entryLog.createMany({
      data: entryLogs,
      skipDuplicates: true
    })

    // Create sample book transactions
    const books = await prisma.book.findMany({ take: 20 })
    if (books.length > 0) {
      const bookTransactions = []
      
      for (let i = 0; i < 15; i++) {
        const randomUser = users[Math.floor(Math.random() * users.length)]
        const randomBook = books[Math.floor(Math.random() * books.length)]
        const borrowDate = new Date(today)
        borrowDate.setDate(today.getDate() - Math.floor(Math.random() * 30))
        
        const dueDate = new Date(borrowDate)
        dueDate.setDate(borrowDate.getDate() + 14)
        
        // Some should be overdue
        const isOverdue = Math.random() < 0.3
        if (isOverdue) {
          dueDate.setDate(today.getDate() - Math.floor(Math.random() * 10))
        }
        
        bookTransactions.push({
          user_id: randomUser.user_id,
          book_id: randomBook.book_id,
          borrow_date: borrowDate,
          due_date: dueDate,
          return_date: Math.random() < 0.7 ? null : new Date() // 70% still borrowed
        })
      }

      await prisma.bookTransaction.createMany({
        data: bookTransactions,
        skipDuplicates: true
      })
    }

    // Create sample locker transactions
    const lockers = await prisma.locker.findMany({ take: 10 })
    if (lockers.length > 0) {
      const lockerTransactions = []
      
      for (let i = 0; i < 8; i++) {
        const randomUser = users[Math.floor(Math.random() * users.length)]
        const randomLocker = lockers[i] // Use different lockers
        const assignDate = new Date(today)
        assignDate.setDate(today.getDate() - Math.floor(Math.random() * 20))
        
        const dueDate = new Date(assignDate)
        dueDate.setDate(assignDate.getDate() + 7)
        
        // Some should be overdue
        const isOverdue = Math.random() < 0.2
        if (isOverdue) {
          dueDate.setDate(today.getDate() - Math.floor(Math.random() * 5))
        }
        
        lockerTransactions.push({
          user_id: randomUser.user_id,
          locker_id: randomLocker.locker_id,
          assign_date: assignDate,
          due_date: dueDate,
          return_date: Math.random() < 0.8 ? null : new Date() // 80% still occupied
        })
      }

      await prisma.lockerTransaction.createMany({
        data: lockerTransactions,
        skipDuplicates: true
      })
    }

    console.log('Sample dashboard data created successfully!')
    
    // Show some stats
    const stats = {
      entryLogsToday: await prisma.entryLog.count({
        where: {
          date_time_log: { gte: today }
        }
      }),
      activeBookTransactions: await prisma.bookTransaction.count({
        where: { return_date: null }
      }),
      activeLockerTransactions: await prisma.lockerTransaction.count({
        where: { return_date: null }
      }),
      overdueBooks: await prisma.bookTransaction.count({
        where: {
          return_date: null,
          due_date: { lt: now }
        }
      }),
      overdueLockers: await prisma.lockerTransaction.count({
        where: {
          return_date: null,
          due_date: { lt: now }
        }
      })
    }
    
    console.log('Dashboard statistics:', stats)

  } catch (error) {
    console.error('Error creating sample data:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createSampleData()
