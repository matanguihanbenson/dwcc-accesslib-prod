import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

const ACCESSION_SEQUENCE_START = 48000
const INITIAL_LAST_NUMBER = ACCESSION_SEQUENCE_START - 1
const ACCESSION_NUMBER_MIN_WIDTH = 5

// POST - Initialize copies for existing books (one-time migration)
export const POST = withAuth(
  async (req: NextRequest, session, context) => {
    try {
      const { book_id } = await context.params
      const bookId = parseInt(book_id)

      if (isNaN(bookId)) {
        return createErrorResponse('Invalid book ID', 400)
      }

      const body = await req.json()
      const { numberOfCopies, condition = 'GOOD' } = body

      // Verify book exists
      const book = await prisma.book.findUnique({
        where: { book_id: bookId }
      })

      if (!book) {
        return createErrorResponse('Book not found', 404)
      }

      // Check if copies already exist
      const existingCopies = await prisma.bookCopy.count({
        where: {
          book_id: bookId,
          archived_at: null
        }
      })

      if (existingCopies > 0) {
        return createErrorResponse('Copies already exist for this book', 400)
      }

      // Get or create accession number sequence
      let sequence = await prisma.accessionNumberSequence.findFirst()
      
      if (!sequence) {
        sequence = await prisma.accessionNumberSequence.create({
          data: {
            last_number: INITIAL_LAST_NUMBER,
            prefix: 'LIB'
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
        const accessionNumber = `${sequence.prefix}-${String(currentNumber).padStart(ACCESSION_NUMBER_MIN_WIDTH, '0')}`

        // Create copy
        const copy = await prisma.bookCopy.create({
          data: {
            book_id: bookId,
            accession_number: accessionNumber,
            condition,
            status: 'AVAILABLE',
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

      // Note: We don't update copies_total since it already exists
      // This is a one-time initialization for existing books

      return createSuccessResponse(
        { copies: createdCopies },
        `Successfully initialized ${numberOfCopies} cop${numberOfCopies > 1 ? 'ies' : 'y'}`
      )
    } catch (error) {
      console.error('Error initializing book copies:', error)
      return createErrorResponse('Failed to initialize book copies', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
