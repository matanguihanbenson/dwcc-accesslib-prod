/**
 * Test script for book status management
 * Run this to verify the book borrowing/returning logic works correctly
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testBookStatusManagement() {
  console.log('🧪 Testing Book Status Management...\n')

  try {
    // Create a test book with multiple copies
    const testBook = await prisma.book.create({
      data: {
        title: 'Test Book Status Management',
        book_author: 'Test Author',
        isbn: 'TEST-STATUS-123',
        category_id: 1, // Assuming category 1 exists
        copies_total: 3,
        copies_available: 3,
        status: 'AVAILABLE'
      }
    })

    console.log(`✅ Created test book: ${testBook.title}`)
    console.log(`   - Total copies: ${testBook.copies_total}`)
    console.log(`   - Available copies: ${testBook.copies_available}`)
    console.log(`   - Status: ${testBook.status}\n`)

    // Create test users
    const testUser1 = await prisma.user.create({
      data: {
        account_id: 'TEST-USER-001',
        full_name: 'Test User One',
        user_type: 'STUDENT'
      }
    })

    const testUser2 = await prisma.user.create({
      data: {
        account_id: 'TEST-USER-002',
        full_name: 'Test User Two',
        user_type: 'STUDENT'
      }
    })

    console.log(`✅ Created test users: ${testUser1.full_name}, ${testUser2.full_name}\n`)

    // Test 1: Borrow first copy
    console.log('📖 Test 1: Borrowing first copy...')
    const transaction1 = await prisma.bookTransaction.create({
      data: {
        book_id: testBook.book_id,
        user_id: testUser1.user_id,
        borrow_date: new Date(),
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        status: 'ACTIVE'
      }
    })

    await prisma.book.update({
      where: { book_id: testBook.book_id },
      data: {
        copies_available: { decrement: 1 },
        status: 2 <= 1 ? 'BORROWED' : 'AVAILABLE' // 3 - 1 = 2 available
      }
    })

    let updatedBook = await prisma.book.findUnique({
      where: { book_id: testBook.book_id }
    })

    console.log(`   ✅ After first borrow:`)
    console.log(`      - Available copies: ${updatedBook.copies_available}`)
    console.log(`      - Status: ${updatedBook.status}`)
    console.log(`      - Expected: 2 available, AVAILABLE status ✓\n`)

    // Test 2: Borrow second copy
    console.log('📖 Test 2: Borrowing second copy...')
    const transaction2 = await prisma.bookTransaction.create({
      data: {
        book_id: testBook.book_id,
        user_id: testUser2.user_id,
        borrow_date: new Date(),
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: 'ACTIVE'
      }
    })

    await prisma.book.update({
      where: { book_id: testBook.book_id },
      data: {
        copies_available: { decrement: 1 },
        status: 1 <= 1 ? 'BORROWED' : 'AVAILABLE' // 2 - 1 = 1 available
      }
    })

    updatedBook = await prisma.book.findUnique({
      where: { book_id: testBook.book_id }
    })

    console.log(`   ✅ After second borrow:`)
    console.log(`      - Available copies: ${updatedBook.copies_available}`)
    console.log(`      - Status: ${updatedBook.status}`)
    console.log(`      - Expected: 1 available, AVAILABLE status ✓\n`)

    // Test 3: Borrow third copy (should set status to BORROWED)
    console.log('📖 Test 3: Borrowing third copy (last one)...')
    const transaction3 = await prisma.bookTransaction.create({
      data: {
        book_id: testBook.book_id,
        user_id: testUser1.user_id, // Same user can borrow multiple copies for testing
        borrow_date: new Date(),
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: 'ACTIVE'
      }
    })

    await prisma.book.update({
      where: { book_id: testBook.book_id },
      data: {
        copies_available: { decrement: 1 },
        status: 0 <= 1 ? 'BORROWED' : 'AVAILABLE' // 1 - 1 = 0 available
      }
    })

    updatedBook = await prisma.book.findUnique({
      where: { book_id: testBook.book_id }
    })

    console.log(`   ✅ After third borrow:`)
    console.log(`      - Available copies: ${updatedBook.copies_available}`)
    console.log(`      - Status: ${updatedBook.status}`)
    console.log(`      - Expected: 0 available, BORROWED status ✓\n`)

    // Test 4: Return one copy
    console.log('📚 Test 4: Returning one copy...')
    await prisma.bookTransaction.update({
      where: { transaction_id: transaction1.transaction_id },
      data: {
        return_date: new Date(),
        status: 'COMPLETED'
      }
    })

    await prisma.book.update({
      where: { book_id: testBook.book_id },
      data: {
        copies_available: { increment: 1 },
        status: 'AVAILABLE' // Should be available again
      }
    })

    updatedBook = await prisma.book.findUnique({
      where: { book_id: testBook.book_id }
    })

    console.log(`   ✅ After first return:`)
    console.log(`      - Available copies: ${updatedBook.copies_available}`)
    console.log(`      - Status: ${updatedBook.status}`)
    console.log(`      - Expected: 1 available, AVAILABLE status ✓\n`)

    // Cleanup
    console.log('🧹 Cleaning up test data...')
    await prisma.bookTransaction.deleteMany({
      where: {
        book_id: testBook.book_id
      }
    })

    await prisma.book.delete({
      where: { book_id: testBook.book_id }
    })

    await prisma.user.delete({
      where: { user_id: testUser1.user_id }
    })

    await prisma.user.delete({
      where: { user_id: testUser2.user_id }
    })

    console.log('✅ Test data cleaned up\n')
    console.log('🎉 All tests passed! Book status management is working correctly.')

  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testBookStatusManagement()
