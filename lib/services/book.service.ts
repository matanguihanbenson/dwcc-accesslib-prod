import { BaseService } from './base.service'
import { AuditService } from './audit.service'
import { prisma } from '@/lib/prisma'
import BookStatusManager from '@/lib/book-status-manager'
import { generateCutterNumber, generateBaseWorkmark, generateFinalWorkmark, interpolateShelflist, cutterToDecimal, normalizeTitle } from '@/lib/cutter'
import { generateSpelledTitle } from '@/lib/spelled-title'
import {
  ServiceResult,
  CreateBookData,
  UpdateBookData,
  Book,
  BookStatus,
  BookCondition,
  BookTransaction,
  SearchFilters,
  UserRole,
  TransactionStatus
} from '@/types'
import { validateCreateBook } from '@/lib/validations'
import { AppError, NotFoundError, BusinessLogicError } from '@/lib/errors'
import { generateAccessionNumbers } from '@/lib/accession-number'

export class BookService extends BaseService {
  async createBook(data: CreateBookData, createdBy: number, createdByRole: UserRole): Promise<ServiceResult<Book>> {
    try {
      const validation = validateCreateBook(data)
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', '),
          code: 'VALIDATION_ERROR',
        }
      }

      if (data.isbn && await this.exists(prisma.book, { isbn: data.isbn })) {
        throw new AppError('ISBN already exists', 'DUPLICATE_ENTRY', 409)
      }

      // Extract related entities and drop legacy fields not in schema
      const { authors, contributors, alternate_titles, links, digital_content, book_author, ...bookData } = data as any

      // Compute spelled-out title for workmark generation
      const spelledTitle = generateSpelledTitle(data.title || '')
      bookData.spelledout_title = spelledTitle || undefined

      // Get first author name for display
      const firstAuthorName = authors && authors.length > 0 ? authors[0].name : (book_author || 'Unknown')

      // Title used for workmark generation: spelled-out version if available, else raw
      const workmarkTitle = spelledTitle || data.title || ''

      // Create book with all relations in a transaction
      const book = await this.executeTransaction(async (tx) => {
        // ── Query existing data for shelflist + workmark scope ──
        const existingAuthors = bookData.classification_id
          ? await tx.bookAuthor.findMany({
              where: {
                book: {
                  classification_id: bookData.classification_id,
                  archived_at: null,
                }
              },
              select: {
                name: true,
                cutter_number: true,
                book: { select: { title: true, section_id: true, classification_id: true } }
              },
              orderBy: { name: 'asc' }
            })
          : []

        const existingBooks = bookData.classification_id
          ? await tx.book.findMany({
              where: {
                classification_id: bookData.classification_id,
                archived_at: null,
              },
              select: {
                book_id: true,
                title: true,
                workmark: true,
                section_id: true,
                authors: {
                  select: { name: true, cutter_number: true }
                }
              }
            })
          : []

        // Build the shelflist once (shared by all authors)
        const shelflist = existingAuthors
          .filter((a: any) => a.cutter_number)
          .map((a: any) => {
            const parts = a.name.trim().split(/\s+/)
            const surname = (parts.pop() || a.name).replace(/[^A-Za-z]/g, '').toLowerCase()
            return { surname, fullName: a.name.trim(), cutter: a.cutter_number! }
          })
          .sort((a: any, b: any) => a.surname.localeCompare(b.surname))

        // ── Compute book-level workmark (scoped by primary author's cutter) ──
        let bookWorkmark = ''

        if (bookData.classification_id) {
          const firstAuthor = authors?.[0]
          const firstAuthorName = firstAuthor?.name
          const normalizedNew = normalizeTitle(data.title || '')

          if (firstAuthorName) {
            // Determine primary author's cutter first (edition match or interpolation)
            let primaryAuthorCutter: string | null = null
            const cutterEditionMatch = existingAuthors.find((a: any) =>
              a.name === firstAuthorName &&
              a.cutter_number &&
              a.book.classification_id === bookData.classification_id &&
              a.book.section_id === (bookData.section_id || null) &&
              normalizeTitle(a.book.title || '') === normalizedNew &&
              normalizedNew !== ''
            )

            if (cutterEditionMatch) {
              primaryAuthorCutter = cutterEditionMatch.cutter_number!
            } else {
              primaryAuthorCutter = interpolateShelflist(firstAuthorName, shelflist)
            }

            // Now compute workmark using the cutter for scope
            const workmarkEditionMatch = existingBooks.find((b: any) =>
              b.authors.some((a: any) => a.cutter_number === primaryAuthorCutter) &&
              b.section_id === (bookData.section_id || null) &&
              normalizeTitle(b.title || '') === normalizedNew &&
              normalizedNew !== ''
            )

            if (workmarkEditionMatch) {
              bookWorkmark = workmarkEditionMatch.workmark || ''
            } else {
              const baseWm = generateBaseWorkmark(workmarkTitle)
              if (baseWm) {
                const existingMarks = existingBooks
                  .filter((b: any) =>
                    b.authors.some((a: any) => a.cutter_number === primaryAuthorCutter) &&
                    b.section_id === (bookData.section_id || null)
                  )
                  .map((b: any) => b.workmark)
                  .filter((m: any): m is string => !!m)
                bookWorkmark = generateFinalWorkmark(baseWm, workmarkTitle, existingMarks)
              }
            }
          }
        }

        // ── Pre-compute author cutters using shelflist interpolation ──
        const authorData = authors && authors.length > 0
          ? await Promise.all(authors.map(async (author: any, index: number) => {
              let cutter: string

              if (bookData.classification_id) {
                const normalizedNew = normalizeTitle(data.title || '')
                const matchedEdition = existingAuthors.find((a: any) =>
                  a.name === author.name &&
                  a.cutter_number &&
                  a.book.classification_id === bookData.classification_id &&
                  a.book.section_id === (bookData.section_id || null) &&
                  normalizeTitle(a.book.title || '') === normalizedNew &&
                  normalizedNew !== ''
                )

                if (matchedEdition) {
                  cutter = matchedEdition.cutter_number!
                } else {
                  cutter = interpolateShelflist(author.name || '', shelflist)
                }
              } else {
                cutter = generateCutterNumber(author.name || '')
              }

              return {
                name: author.name,
                dates: author.dates,
                cutter_number: cutter,
                decimal_value: cutterToDecimal(cutter),
                display_order: index + 1
              }
            }))
          : undefined

        // Pre-compute contributor cutters
        const contributorData = contributors && contributors.length > 0
          ? contributors.map((contributor: any, index: number) => {
              const cutter = generateCutterNumber(contributor.name || '')
              return {
                name: contributor.name,
                role: contributor.role || 'Contributor',
                dates: contributor.dates,
                cutter_number: cutter,
                decimal_value: cutterToDecimal(cutter),
                display_order: index + 1
              }
            })
          : undefined

        const createdBook = await tx.book.create({
          data: {
            ...bookData,
            workmark: bookWorkmark || undefined,
            created_by: createdBy,
            updated_by: createdBy,
            authors: authorData ? { create: authorData } : undefined,
            contributors: contributorData ? { create: contributorData } : undefined,
            // Create alternate titles
            alternate_titles: alternate_titles && alternate_titles.length > 0 ? {
              create: alternate_titles.map((title: any) => ({
                title: title.title,
                type: title.type || 'Alternate'
              }))
            } : undefined,
            // Create links
            links: links && links.length > 0 ? {
              create: links.map((link: any) => ({
                url: link.url,
                description: link.description
              }))
            } : undefined,
            // Create digital content
            digital_content: digital_content && digital_content.length > 0 ? {
              create: digital_content.map((content: any) => ({
                title: content.title,
                url: content.url,
                description: content.description,
                file_type: content.file_type,
                file_size: content.file_size
              }))
            } : undefined
          },
          include: {
            category: true,
            section: true,
            authors: true,
            contributors: true,
            alternate_titles: true,
            links: true,
            digital_content: true
          }
        })

        return createdBook
      })

      await AuditService.logAction(
        createdBy,
        createdByRole,
        'CREATE_BOOK',
        `Created book: ${book.title} by ${firstAuthorName}`
      )

      return this.handleSuccess(book, 'Book created successfully')
    } catch (error) {
      return this.handleError(error, 'BookService.createBook')
    }
  }

  async getBooks(filters: SearchFilters): Promise<ServiceResult> {
    try {
      // If filtering by classification, resolve the full subtree
      // so books in any child/grandchild classification are included
      const resolvedFilters = { ...filters }
      if (filters.classification_id) {
        const rootId = Number(filters.classification_id)
        const descendantIds = await this.getClassificationDescendantIds(rootId)
        resolvedFilters.classification_ids = descendantIds
        delete resolvedFilters.classification_id
      }

      // Build optimized query with proper indexing
      const whereClause = this.buildBookSearchQuery(resolvedFilters)
      const { page = 1, limit = 10 } = filters
      const skip = (page - 1) * limit

      // Single optimized query with borrowed count as subquery
      const [books, total] = await Promise.all([
        prisma.book.findMany({
          where: whereClause,
          select: {
            book_id: true,
            title: true,
            isbn: true,
            publisher: true,
            year_published: true,
            copies_total: true,
            copies_available: true,
            status: true,
            location: true,
            description: true,
            language: true,
            pages: true,
            edition: true,
            call_number: true,
            created_at: true,
            updated_at: true,
            category: {
              select: {
                category_id: true,
                name: true
              }
            },
            section: {
              select: {
                section_id: true,
                name: true,
                code: true
              }
            },
            classification: {
              select: {
                id: true,
                code: true,
                name: true
              }
            },
            authors: {
              select: {
                name: true,
                dates: true,
                display_order: true
              },
              orderBy: { display_order: 'asc' }
            },
            // Use aggregate to get borrowed count efficiently
            _count: {
              select: {
                book_transactions: {
                  where: {
                    status: TransactionStatus.ACTIVE
                  }
                }
              }
            }
          },
          orderBy: this.buildOrderBy(filters),
          skip,
          take: limit
        }),
        prisma.book.count({ where: whereClause })
      ])

      // Transform the data to include borrowed count and first author
      const booksWithBorrowedCount = books.map(book => ({
        ...book,
        book_author: book.authors && book.authors.length > 0
          ? book.authors.map((a: any) => a.name).join(', ')
          : 'Unknown',
        copies_borrowed: book._count.book_transactions,
        authors: undefined,
        _count: undefined
      }))

      const result = {
        data: booksWithBorrowedCount,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }

      return this.handleSuccess(result)
    } catch (error) {
      return this.handleError(error, 'BookService.getBooks')
    }
  }

  async getBookById(bookId: number): Promise<ServiceResult<Book>> {
    try {
      const validatedId = this.validateId(bookId, 'Book ID')
      
      const book = await this.findUnique<Book>(
        prisma.book,
        { book_id: validatedId },
        {
          category: true,
          section: true,
          classification: true,
          authors: { orderBy: { display_order: 'asc' } },
          contributors: { orderBy: { display_order: 'asc' } },
          alternate_titles: true,
          links: true,
          digital_content: true,
          book_copies: {
            select: { status: true, archived_at: true }
          }
        },
        'Book not found'
      )

      // Compute actual copy counts from book_copy table
      const activeCopies = (book as any).book_copies?.filter((c: any) => !c.archived_at) || []
      const copiesTotal = activeCopies.length
      const copiesAvailable = activeCopies.filter((c: any) => c.status === 'AVAILABLE').length
      ;(book as any).copies_total = copiesTotal
      ;(book as any).copies_available = copiesAvailable

      return this.handleSuccess(book)
    } catch (error) {
      return this.handleError(error, 'BookService.getBookById')
    }
  }

  // Copy management methods removed in revert

  async updateBook(bookId: number, data: UpdateBookData, updatedBy: number, updatedByRole: UserRole): Promise<ServiceResult<Book>> {
    try {
      const validatedId = this.validateId(bookId, 'Book ID')

      const existingBook = await this.findUnique<Book>(
        prisma.book,
        { book_id: validatedId },
        null,
        'Book not found'
      )

      if (data.isbn && data.isbn !== existingBook.isbn) {
        if (await this.exists(prisma.book, { isbn: data.isbn, book_id: { not: validatedId } })) {
          throw new AppError('ISBN already exists', 'DUPLICATE_ENTRY', 409)
        }
      }

      // Extract related entities and drop legacy fields not in schema
      const { authors, contributors, alternate_titles, links, digital_content, book_author, ...bookData } = data as any

      // Compute spelled-out title for workmark generation
      const spelledTitle = generateSpelledTitle((data as any).title || '')
      bookData.spelledout_title = spelledTitle || undefined

      // Get first author name for display
      const firstAuthorName = authors && authors.length > 0 ? authors[0].name : (book_author || 'Unknown')

      // Title used for workmark generation: spelled-out version if available, else raw
      const workmarkTitle = spelledTitle || (data as any).title || ''

      // Update copies validation
      if (bookData.copies_total !== undefined) {
        const borrowed = await prisma.bookTransaction.count({
          where: {
            book_id: validatedId,
            status: TransactionStatus.ACTIVE,
          }
        })

        if (bookData.copies_total < borrowed) {
          throw new BusinessLogicError(
            'Cannot reduce total copies below currently borrowed copies',
            'INVALID_COPY_COUNT'
          )
        }

        bookData.copies_available = bookData.copies_total - borrowed
      }

      // Update book with all relations in a transaction
      const updatedBook = await this.executeTransaction(async (tx) => {
        // Snapshot the current author rows BEFORE deleting them so
        // we can include the book's own entry in the shelflist for
        // edition detection and cutter interpolation.
        const snapshotAuthors = authors !== undefined
          ? await tx.bookAuthor.findMany({
              where: { book_id: validatedId },
              select: {
                name: true,
                cutter_number: true,
                book: { select: { title: true, section_id: true, classification_id: true } }
              },
              orderBy: { display_order: 'asc' }
            })
          : []

        // ── Query existing data for shelflist + workmark scope ──
        const otherAuthors = bookData.classification_id
          ? await tx.bookAuthor.findMany({
              where: {
                book: {
                  classification_id: bookData.classification_id,
                  archived_at: null,
                }
              },
              select: {
                name: true,
                cutter_number: true,
                book: { select: { title: true, section_id: true, classification_id: true } }
              },
              orderBy: { name: 'asc' }
            })
          : []

        const otherBooks = bookData.classification_id
          ? await tx.book.findMany({
              where: {
                classification_id: bookData.classification_id,
                archived_at: null,
                book_id: { not: validatedId }
              },
              select: {
                book_id: true,
                title: true,
                workmark: true,
                section_id: true,
                authors: {
                  select: { name: true, cutter_number: true }
                }
              }
            })
          : []

        // Merge snapshot into existing authors so shelflist is stable during edits
        const existingAuthors = [...otherAuthors, ...snapshotAuthors]

        // Build the shelflist once (shared by all authors)
        const shelflist = existingAuthors
          .filter((a: any) => a.cutter_number)
          .map((a: any) => {
            const parts = a.name.trim().split(/\s+/)
            const surname = (parts.pop() || a.name).replace(/[^A-Za-z]/g, '').toLowerCase()
            return { surname, fullName: a.name.trim(), cutter: a.cutter_number! }
          })
          .sort((a: any, b: any) => a.surname.localeCompare(b.surname))

        // ── Pre-compute book-level workmark (scoped by primary author's cutter) ──
        let bookWorkmark = existingBook.workmark || ''

        if (bookData.classification_id) {
          const firstAuthor = authors?.[0]
          const firstAuthorName = firstAuthor?.name
          const normalizedNew = normalizeTitle((data as any).title || '')

          if (firstAuthorName) {
            // Determine primary author's cutter first (edition match or interpolation)
            let primaryAuthorCutter: string | null = null
            const cutterEditionMatch = existingAuthors.find((a: any) =>
              a.name === firstAuthorName &&
              a.cutter_number &&
              a.book.classification_id === bookData.classification_id &&
              a.book.section_id === (bookData.section_id || null) &&
              normalizeTitle(a.book.title || '') === normalizedNew &&
              normalizedNew !== ''
            )

            if (cutterEditionMatch) {
              primaryAuthorCutter = cutterEditionMatch.cutter_number!
            } else {
              primaryAuthorCutter = interpolateShelflist(firstAuthorName, shelflist)
            }

            // Now compute workmark using the cutter for scope
            const workmarkEditionMatch = otherBooks.find((b: any) =>
              b.authors.some((a: any) => a.cutter_number === primaryAuthorCutter) &&
              b.section_id === (bookData.section_id || null) &&
              normalizeTitle(b.title || '') === normalizedNew &&
              normalizedNew !== ''
            )

            if (workmarkEditionMatch) {
              bookWorkmark = workmarkEditionMatch.workmark || ''
            } else {
              const baseWm = generateBaseWorkmark(workmarkTitle)
              if (baseWm) {
                const existingMarks = otherBooks
                  .filter((b: any) =>
                    b.authors.some((a: any) => a.cutter_number === primaryAuthorCutter) &&
                    b.section_id === (bookData.section_id || null)
                  )
                  .map((b: any) => b.workmark)
                  .filter((m: any): m is string => !!m)
                // Include the current book's own workmark in uniqueness check
                if (bookWorkmark) existingMarks.push(bookWorkmark)
                bookWorkmark = generateFinalWorkmark(baseWm, workmarkTitle, existingMarks)
              }
            }
          }
        }

        // Delete existing related entities if new ones are provided
        if (authors !== undefined) {
          await tx.bookAuthor.deleteMany({ where: { book_id: validatedId } })
        }
        if (contributors !== undefined) {
          await tx.bookContributor.deleteMany({ where: { book_id: validatedId } })
        }
        if (alternate_titles !== undefined) {
          await tx.alternateTitle.deleteMany({ where: { book_id: validatedId } })
        }
        if (links !== undefined) {
          await tx.bookLink.deleteMany({ where: { book_id: validatedId } })
        }
        if (digital_content !== undefined) {
          await tx.digitalContent.deleteMany({ where: { book_id: validatedId } })
        }

        // ── Pre-compute author cutters using shelflist interpolation ──
        const authorData = authors && authors.length > 0
          ? await Promise.all(authors.map(async (author: any, index: number) => {
              let cutter: string

              if (bookData.classification_id) {
                const normalizedNew = normalizeTitle((data as any).title || '')
                const matchedEdition = existingAuthors.find((a: any) =>
                  a.name === author.name &&
                  a.cutter_number &&
                  a.book.classification_id === bookData.classification_id &&
                  a.book.section_id === (bookData.section_id || null) &&
                  normalizeTitle(a.book.title || '') === normalizedNew &&
                  normalizedNew !== ''
                )

                if (matchedEdition) {
                  cutter = matchedEdition.cutter_number!
                } else {
                  cutter = interpolateShelflist(author.name || '', shelflist)
                }
              } else {
                cutter = generateCutterNumber(author.name || '')
              }

              return {
                name: author.name,
                dates: author.dates,
                cutter_number: cutter,
                decimal_value: cutterToDecimal(cutter),
                display_order: index + 1
              }
            }))
          : undefined

        const contributorData = contributors && contributors.length > 0
          ? contributors.map((contributor: any, index: number) => {
              const cutter = generateCutterNumber(contributor.name || '')
              return {
                name: contributor.name,
                role: contributor.role || 'Contributor',
                dates: contributor.dates,
                cutter_number: cutter,
                decimal_value: cutterToDecimal(cutter),
                display_order: index + 1
              }
            })
          : undefined

        // Update book with new data
        const updated = await tx.book.update({
          where: { book_id: validatedId },
          data: {
            ...bookData,
            workmark: bookWorkmark || undefined,
            updated_by: updatedBy,
            authors: authorData ? { create: authorData } : undefined,
            contributors: contributorData ? { create: contributorData } : undefined,
            // Create new alternate titles
            alternate_titles: alternate_titles && alternate_titles.length > 0 ? {
              create: alternate_titles.map((title: any) => ({
                title: title.title,
                type: title.type || 'Alternate'
              }))
            } : undefined,
            // Create new links
            links: links && links.length > 0 ? {
              create: links.map((link: any) => ({
                url: link.url,
                description: link.description
              }))
            } : undefined,
            // Create new digital content
            digital_content: digital_content && digital_content.length > 0 ? {
              create: digital_content.map((content: any) => ({
                title: content.title,
                url: content.url,
                description: content.description,
                file_type: content.file_type,
                file_size: content.file_size
              }))
            } : undefined
          },
          include: {
            category: true,
            section: true,
            authors: true,
            contributors: true,
            alternate_titles: true,
            links: true,
            digital_content: true
          }
        })

        return updated
      })

      await AuditService.logAction(
        updatedBy,
        updatedByRole,
        'UPDATE_BOOK',
        `Updated book: ${updatedBook.title} by ${firstAuthorName}`
      )

      return this.handleSuccess(updatedBook, 'Book updated successfully')
    } catch (error) {
      return this.handleError(error, 'BookService.updateBook')
    }
  }

  async borrowBook(bookId: number, userId: number, dueDate: Date, processedBy: number, processedByRole: UserRole): Promise<ServiceResult<BookTransaction>> {
    try {
      const validatedBookId = this.validateId(bookId, 'Book ID')
      const validatedUserId = this.validateId(userId, 'User ID')

      const book = await this.findUnique<Book>(
        prisma.book,
        { book_id: validatedBookId },
        null,
        'Book not found'
      )

      // Check if book has available copies using the status manager
      const availability = await BookStatusManager.isBookAvailableForBorrowing(validatedBookId)
      
      if (!availability.available) {
        throw new BusinessLogicError(availability.reason || 'Book is not available for borrowing', 'BOOK_NOT_AVAILABLE')
      }

      const hasActiveBorrow = await this.exists(prisma.bookTransaction, {
        book_id: validatedBookId,
        user_id: validatedUserId,
        status: TransactionStatus.ACTIVE,
      })

      if (hasActiveBorrow) {
        throw new BusinessLogicError('User already has an active borrow for this book', 'DUPLICATE_BORROW')
      }

      const result = await this.executeTransaction(async (tx) => {
        const transaction = await tx.bookTransaction.create({
          data: {
            book_id: validatedBookId,
            user_id: validatedUserId,
            borrow_date: new Date(),
            due_date: dueDate,
            approved_by: processedBy,
            status: TransactionStatus.ACTIVE,
          },
          include: {
            book: { include: { category: true } },
            user: true,
          }
        })

        // Update book status using the status manager
        await BookStatusManager.updateBookStatusAfterBorrow(validatedBookId, tx)

        return transaction
      })

      await AuditService.logAction(
        processedBy,
        processedByRole,
        'BORROW_BOOK',
        `Approved book borrow: ${book.title} for user ID ${userId}`
      )

      return this.handleSuccess(result, 'Book borrowed successfully')
    } catch (error) {
      return this.handleError(error, 'BookService.borrowBook')
    }
  }

  async returnBook(transactionId: number, processedBy: number, processedByRole: UserRole, conditionOnReturn?: BookCondition, notes?: string): Promise<ServiceResult> {
    try {
      const validatedId = this.validateId(transactionId, 'Transaction ID')

      const transaction = await this.findUnique<BookTransaction>(
        prisma.bookTransaction,
        { transaction_id: validatedId },
        { book: true, user: true },
        'Transaction not found'
      )

      if (transaction.status !== TransactionStatus.ACTIVE) {
        throw new BusinessLogicError('Transaction is not active', 'INVALID_TRANSACTION_STATUS')
      }

      const returnDate = new Date()
      let penalty = Number(transaction.penalty) // Keep existing penalty, don't reset to 0

      // Calculate penalty if overdue
      if (transaction.due_date && returnDate > transaction.due_date) {
        const daysOverdue = Math.ceil((returnDate.getTime() - transaction.due_date.getTime()) / (1000 * 60 * 60 * 24))
        const penaltyConfig = await prisma.penaltyConfig.findFirst({
          where: { type: 'BOOK', is_active: true }
        })
        const calculatedPenalty = daysOverdue * (Number(penaltyConfig?.penalty_per_day) || 5)
        penalty = Math.max(penalty, calculatedPenalty) // Use the higher of existing or calculated penalty

        // Create or update overdue settlement record for tracking
        const existingSettlement = await prisma.overdueSettlement.findFirst({
          where: {
            transaction_type: 'BOOK',
            transaction_id: validatedId
          }
        })

        if (!existingSettlement && penalty > 0) {
          await prisma.overdueSettlement.create({
            data: {
              user_id: transaction.user_id,
              transaction_type: 'BOOK',
              transaction_id: validatedId,
              penalty_amount: penalty,
              amount_paid: 0,
              remaining_balance: penalty,
              status: 'PENDING'
            }
          })
        }
      }

      const result = await this.executeTransaction(async (tx) => {
        const updatedTransaction = await tx.bookTransaction.update({
          where: { transaction_id: validatedId },
          data: {
            return_date: returnDate,
            penalty,
            status: TransactionStatus.COMPLETED,
            returned_by: processedBy,
            condition_on_return: conditionOnReturn ?? undefined,
            notes: notes !== undefined ? (transaction.notes ? `${transaction.notes} | ${notes}` : notes) : undefined,
          }
        })

        // Update the specific book copy status back to AVAILABLE (or condition-based status)
        if ((transaction as any).copy_id) {
          let copyStatus: 'AVAILABLE' | 'DAMAGED' | 'MISSING' = 'AVAILABLE'
          if (conditionOnReturn === 'DAMAGED') {
            copyStatus = 'DAMAGED'
          } else if (conditionOnReturn === 'POOR') {
            // Mark as DAMAGED if condition is POOR
            copyStatus = 'DAMAGED'
          }
          
          await tx.bookCopy.update({
            where: { copy_id: (transaction as any).copy_id },
            data: { status: copyStatus }
          })
        }

        // Update book status using the status manager
        await BookStatusManager.updateBookStatusAfterReturn(transaction.book_id, tx)
      })

      await AuditService.logAction(
        processedBy,
        processedByRole,
        'RETURN_BOOK',
        `Processed book return: ${transaction.book?.title} from user ID ${transaction.user_id}${penalty > 0 ? ` (Penalty: ₱${penalty.toFixed(2)})` : ''}`
      )

      return this.handleSuccess(null, penalty > 0 ? `Book returned successfully. Penalty of ₱${penalty.toFixed(2)} must be settled.` : 'Book returned successfully')
    } catch (error) {
      return this.handleError(error, 'BookService.returnBook')
    }
  }

  async getBookTransactions(filters: SearchFilters): Promise<ServiceResult> {
    try {
      // Build custom where clause for book transactions
      const customWhere: any = {}

      // Add search functionality for book transactions
      const query = (filters.query || '').trim()
      const searchType = (filters.searchType || 'all').trim() || 'all'

      if (query) {
        if (searchType === 'accession') {
          customWhere.copy = {
            is: {
              accession_number: { equals: query.toUpperCase() },
            },
          }
        } else if (searchType === 'isbn') {
          customWhere.book = {
            isbn: { contains: query },
          }
        } else if (searchType === 'title') {
          customWhere.book = {
            title: { contains: query },
          }
        } else if (searchType === 'author') {
          customWhere.book = {
            authors: { some: { name: { contains: query } } },
          }
        } else if (searchType === 'user') {
          customWhere.user = {
            is: {
              full_name: { contains: query },
            },
          }
        } else if (searchType === 'account_id') {
          customWhere.user = {
            is: {
              account_id: { contains: query },
            },
          }
        } else {
          customWhere.OR = [
            { book: { title: { contains: query } } },
            { book: { isbn: { contains: query } } },
            { book: { authors: { some: { name: { contains: query } } } } },
            { user: { is: { full_name: { contains: query } } } },
            { user: { is: { account_id: { contains: query } } } },
            { copy: { is: { accession_number: { contains: query.toUpperCase() } } } },
          ]
        }
      }

      // Add status filter
      if (filters.status) {
        customWhere.status = filters.status
      }

      // Add date range filter
      if (filters.dateFrom || filters.dateTo) {
        customWhere.created_at = {}
        if (filters.dateFrom) {
          customWhere.created_at.gte = new Date(filters.dateFrom)
        }
        if (filters.dateTo) {
          customWhere.created_at.lte = new Date(filters.dateTo)
        }
      }

      const result = await this.paginate(
        prisma.bookTransaction,
        filters,
        {
          copy: {
            select: {
              accession_number: true
            }
          },
          book: { 
            include: { 
              category: true,
              authors: {
                select: { name: true },
                orderBy: { display_order: 'asc' },
                take: 1
              }
            } 
          },
          user: true,
          department: true,
          office: true,
        },
        customWhere
      )

      // Transform authors array to book_author string
      if (result.success && result.data) {
        const transactions = Array.isArray(result.data) ? result.data : []
        const transformedTransactions = transactions.map((tx: any) => ({
          ...tx,
          book: {
            ...tx.book,
            book_author: tx.book.authors && tx.book.authors.length > 0
              ? tx.book.authors[0].name
              : 'Unknown Author'
          }
        }))
        
        return {
          ...result,
          data: transformedTransactions
        }
      }
      
      return result
    } catch (error) {
      return this.handleError(error, 'BookService.getBookTransactions')
    }
  }

  async getUserBookTransactions(userId: number, filters: SearchFilters): Promise<ServiceResult> {
    try {
      // Build custom where clause for specific user
      const customWhere: any = {
        user_id: userId
      }

      // Add additional filters
      if (filters.status) {
        customWhere.status = filters.status
      }

      const query = (filters.query || '').trim()
      const searchType = (filters.searchType || 'all').trim() || 'all'

      if (query) {
        if (searchType === 'accession') {
          customWhere.copy = {
            is: {
              accession_number: { equals: query.toUpperCase() },
            },
          }
        } else if (searchType === 'isbn') {
          customWhere.book = {
            isbn: { contains: query },
          }
        } else if (searchType === 'title') {
          customWhere.book = {
            title: { contains: query },
          }
        } else if (searchType === 'author') {
          customWhere.book = {
            authors: { some: { name: { contains: query } } },
          }
        } else {
          customWhere.OR = [
            { book: { title: { contains: query } } },
            { book: { isbn: { contains: query } } },
            { book: { authors: { some: { name: { contains: query } } } } },
            { copy: { is: { accession_number: { contains: query.toUpperCase() } } } },
          ]
        }
      }

      if (filters.dateFrom || filters.dateTo) {
        customWhere.created_at = {}
        if (filters.dateFrom) {
          customWhere.created_at.gte = new Date(filters.dateFrom)
        }
        if (filters.dateTo) {
          customWhere.created_at.lte = new Date(filters.dateTo)
        }
      }

      const result = await this.paginate(
        prisma.bookTransaction,
        filters,
        {
          copy: {
            select: {
              accession_number: true
            }
          },
          book: { 
            include: { 
              category: true,
              authors: {
                select: { name: true },
                orderBy: { display_order: 'asc' },
                take: 1
              }
            } 
          },
          user: true,
        },
        customWhere
      )

      // Transform authors array to book_author string
      if (result.success && result.data) {
        const transactions = Array.isArray(result.data) ? result.data : []
        const transformedTransactions = transactions.map((tx: any) => ({
          ...tx,
          book: {
            ...tx.book,
            book_author: tx.book.authors && tx.book.authors.length > 0
              ? tx.book.authors[0].name
              : 'Unknown Author'
          }
        }))
        
        return {
          ...result,
          data: transformedTransactions
        }
      }
      
      return result
    } catch (error) {
      return this.handleError(error, 'BookService.getUserBookTransactions')
    }
  }

  async getOverdueBooks(): Promise<ServiceResult<BookTransaction[]>> {
    try {
      const overdueBooks = await this.findMany<BookTransaction>(
        prisma.bookTransaction,
        {
          status: TransactionStatus.ACTIVE,
          due_date: { lt: new Date() },
        },
        {
          book: { include: { category: true } },
          user: true,
        },
        { due_date: 'asc' }
      )

      return this.handleSuccess(overdueBooks)
    } catch (error) {
      return this.handleError(error, 'BookService.getOverdueBooks')
    }
  }

  private buildOrderBy(filters: SearchFilters) {
    const { sortBy = 'created_at', sortOrder = 'desc' } = filters
    
    // Map sortBy to valid book fields
    const validSortFields: Record<string, string> = {
      'title': 'title',
      'author': 'title',
      'call_number': 'call_number',
      'created_at': 'created_at',
      'updated_at': 'updated_at',
      'status': 'status',
      'copies_total': 'copies_total',
      'copies_available': 'copies_available'
    }
    
    const field = validSortFields[sortBy] || 'created_at'
    return { [field]: sortOrder }
  }

  private buildBookSearchQuery(filters: SearchFilters) {
    const where: any = {}
    
    if (filters.query) {
      where.OR = [
        { title: { contains: filters.query } },
        { isbn: { contains: filters.query } },
        { authors: { some: { name: { contains: filters.query } } } },
      ]
    }
    
    if (filters.category) {
      where.category = { name: { contains: filters.category } }
    }
    
    if (filters.status) {
      where.status = filters.status
    }

    if (filters.classification_ids) {
      where.classification_id = { in: filters.classification_ids }
    } else if (filters.classification_id) {
      where.classification_id = Number(filters.classification_id)
    }

    if (filters.section_id) {
      where.section_id = Number(filters.section_id)
    }

    if (filters.dateFrom || filters.dateTo) {
      where.created_at = {}
      if (filters.dateFrom) {
        where.created_at.gte = filters.dateFrom
      }
      if (filters.dateTo) {
        where.created_at.lte = filters.dateTo
      }
    }
    
    return where
  }

  private async getClassificationDescendantIds(id: number): Promise<number[]> {
    const node = await prisma.bookClassification.findUnique({
      where: { id },
      include: { children: true }
    })
    if (!node) return [id]
    const ids = [id]
    for (const child of node.children) {
      ids.push(...(await this.getClassificationDescendantIds(child.id)))
    }
    return ids
  }
}

export const bookService = new BookService()
