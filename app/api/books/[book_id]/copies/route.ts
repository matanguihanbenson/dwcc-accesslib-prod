import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { formatAccessionNumber, advanceSequenceIfNeeded } from '@/lib/accession-number'

const ACCESSION_SEQUENCE_START = 48000
const INITIAL_LAST_NUMBER = ACCESSION_SEQUENCE_START - 1

// GET all copies for a book
export const GET = withAuth(
  async (req: NextRequest, session, context) => {
    try {
      const { book_id } = await context.params
      const bookId = parseInt(book_id)

      if (isNaN(bookId)) {
        return createErrorResponse('Invalid book ID', 400)
      }

      const copies = await prisma.bookCopy.findMany({
        where: {
          book_id: bookId,
          archived_at: null
        },
        orderBy: {
          accession_number: 'asc'
        }
      })

      return createSuccessResponse(copies)
    } catch (error) {
      console.error('Error fetching book copies:', error)
      return createErrorResponse('Failed to fetch book copies', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)

// POST - Add new copies (stock) to a book
export const POST = withAuth(
  async (req: NextRequest, session, context) => {
    try {
      const { book_id } = await context.params
      const bookId = parseInt(book_id)

      if (isNaN(bookId)) {
        return createErrorResponse('Invalid book ID', 400)
      }

      const body = await req.json()
      const { numberOfCopies, condition = 'GOOD', location, notes, accession_number, acquisition_date } = body

      // Single copy with manual accession number
      if (accession_number) {
        const cleaned = String(accession_number).trim().toUpperCase()
        if (!cleaned) {
          return createErrorResponse('Accession number cannot be empty', 400)
        }
        // Check uniqueness
        const conflict = await prisma.bookCopy.findFirst({
          where: { accession_number: cleaned }
        })
        if (conflict) {
          return createErrorResponse(`Accession number "${cleaned}" is already in use`, 400)
        }

        const copy = await prisma.bookCopy.create({
          data: {
            book_id: bookId,
            accession_number: cleaned,
            condition,
            status: 'AVAILABLE',
            location,
            notes,
            acquisition_date: acquisition_date ? new Date(acquisition_date) : new Date()
          }
        })

        await advanceSequenceIfNeeded(cleaned)

        await prisma.book.update({
          where: { book_id: bookId },
          data: {
            copies_total: { increment: 1 },
            copies_available: { increment: 1 }
          }
        })

        return createSuccessResponse({ copies: [copy] }, 'Copy added')
      }

      // Batch auto-generated copies
      if (!numberOfCopies || numberOfCopies < 1 || numberOfCopies > 100) {
        return createErrorResponse('Number of copies must be between 1 and 100', 400)
      }

      // Verify book exists
      const book = await prisma.book.findUnique({
        where: { book_id: bookId }
      })

      if (!book) {
        return createErrorResponse('Book not found', 404)
      }

      // Get or create accession number sequence
      let sequence = await prisma.accessionNumberSequence.findFirst()
      
      if (!sequence) {
        sequence = await prisma.accessionNumberSequence.create({
          data: {
            last_number: INITIAL_LAST_NUMBER
          }
        })
      }

      if (sequence.last_number < INITIAL_LAST_NUMBER) {
        sequence = await prisma.accessionNumberSequence.update({
          where: { id: sequence.id },
          data: { last_number: INITIAL_LAST_NUMBER }
        })
      }

      // Generate accession numbers and create copies
      const createdCopies = []
      let currentNumber = sequence.last_number
      
      for (let i = 0; i < numberOfCopies; i++) {
        currentNumber++
        const accessionNumber = formatAccessionNumber(currentNumber)

        // Create copy
        const copy = await prisma.bookCopy.create({
          data: {
            book_id: bookId,
            accession_number: accessionNumber,
            condition,
            status: 'AVAILABLE',
            location,
            notes,
            acquisition_date: new Date()
          }
        })

        createdCopies.push(copy)
      }

      // Update sequence
      await prisma.accessionNumberSequence.update({
        where: { id: sequence.id },
        data: { last_number: currentNumber }
      })

      // Update book copies count
      await prisma.book.update({
        where: { book_id: bookId },
        data: {
          copies_total: { increment: numberOfCopies },
          copies_available: { increment: numberOfCopies }
        }
      })

      return createSuccessResponse(
        { copies: createdCopies },
        `Successfully added ${numberOfCopies} cop${numberOfCopies > 1 ? 'ies' : 'y'}`
      )
    } catch (error) {
      console.error('Error adding book copies:', error)
      return createErrorResponse('Failed to add book copies', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
