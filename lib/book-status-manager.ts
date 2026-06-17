/**
 * Book status management utilities
 * Handles proper book status transitions based on copy availability
 */

import { prisma } from './prisma'
import { BookStatus } from '@/types'

export class BookStatusManager {
  /**
   * Calculate the correct book status based on copies available
   */
  static calculateBookStatus(copiesAvailable: number, copiesTotal: number): BookStatus {
    if (copiesAvailable <= 0) {
      return BookStatus.BORROWED
    }
    if (copiesTotal <= 0) {
      return BookStatus.ARCHIVED
    }
    return BookStatus.AVAILABLE
  }

  /**
   * Update book status after borrowing a copy
   */
  static async updateBookStatusAfterBorrow(bookId: number, tx?: any) {
    const client = tx || prisma
    
    // Get current book data
    const book = await client.book.findUnique({
      where: { book_id: bookId },
      select: {
        copies_available: true,
        copies_total: true,
        status: true
      }
    })

    if (!book) {
      throw new Error('Book not found')
    }

    // Calculate new status after decrementing
    const newCopiesAvailable = book.copies_available - 1
    const newStatus = this.calculateBookStatus(newCopiesAvailable, book.copies_total)

    // Update book with new status and decremented copies
    return await client.book.update({
      where: { book_id: bookId },
      data: {
        copies_available: { decrement: 1 },
        status: newStatus
      }
    })
  }

  /**
   * Update book status after returning a copy
   */
  static async updateBookStatusAfterReturn(bookId: number, tx?: any) {
    const client = tx || prisma
    
    // Get current book data
    const book = await client.book.findUnique({
      where: { book_id: bookId },
      select: {
        copies_available: true,
        copies_total: true,
        status: true
      }
    })

    if (!book) {
      throw new Error('Book not found')
    }

    // Calculate new status after incrementing
    const newCopiesAvailable = book.copies_available + 1
    const newStatus = this.calculateBookStatus(newCopiesAvailable, book.copies_total)

    // Update book with new status and incremented copies
    return await client.book.update({
      where: { book_id: bookId },
      data: {
        copies_available: { increment: 1 },
        status: newStatus
      }
    })
  }

  /**
   * Check if a book is available for borrowing
   */
  static async isBookAvailableForBorrowing(bookId: number): Promise<{
    available: boolean
    reason?: string
    book?: any
  }> {
    const book = await prisma.book.findUnique({
      where: { book_id: bookId },
      select: {
        book_id: true,
        title: true,
        status: true,
        copies_available: true,
        copies_total: true
      }
    })

    if (!book) {
      return {
        available: false,
        reason: 'Book not found'
      }
    }

    if (book.status === BookStatus.ARCHIVED) {
      return {
        available: false,
        reason: 'Book is archived',
        book
      }
    }

    if (book.status === BookStatus.DAMAGED) {
      return {
        available: false,
        reason: 'Book is damaged',
        book
      }
    }

    if (book.status === BookStatus.MISSING) {
      return {
        available: false,
        reason: 'Book is missing',
        book
      }
    }

    if (book.copies_available <= 0) {
      return {
        available: false,
        reason: 'No available copies',
        book
      }
    }

    return {
      available: true,
      book
    }
  }

  /**
   * Get detailed book availability info
   */
  static async getBookAvailabilityInfo(bookId: number) {
    const book = await prisma.book.findUnique({
      where: { book_id: bookId },
      select: {
        book_id: true,
        title: true,
        status: true,
        copies_available: true,
        copies_total: true,
        _count: {
          select: {
            book_transactions: {
              where: {
                status: 'ACTIVE'
              }
            }
          }
        }
      }
    })

    if (!book) {
      return null
    }

    return {
      ...book,
      copies_borrowed: book._count.book_transactions,
      availability_percentage: book.copies_total > 0 
        ? Math.round((book.copies_available / book.copies_total) * 100)
        : 0
    }
  }
}

export default BookStatusManager
