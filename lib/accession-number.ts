import { prisma } from '@/lib/prisma'

const ACCESSION_SEQUENCE_START = 48000
const INITIAL_LAST_NUMBER = ACCESSION_SEQUENCE_START - 1
const ACCESSION_NUMBER_MIN_WIDTH = 5

/**
 * Render a numeric accession number as a zero-padded string
 * (e.g. `48012`). The library used to emit a `LIB-` prefix,
 * but the physical stickers never carried it, so the prefix was
 * removed entirely — both from every existing row (by the
 * `202607070001_drop_lib_accession_prefix` migration) and from
 * the `accession_number_sequence` schema itself (by the
 * `202607150001_drop_accession_number_sequence_prefix` migration).
 * New copies are emitted as bare zero-padded integers.
 *
 * Exported so the two copy-creation endpoints
 * (`app/api/books/[book_id]/copies/route.ts` and
 * `app/api/books/[book_id]/copies/initialize/route.ts`) can
 * share the same formatter as the central service instead of
 * keeping a local copy in lockstep.
 */
export function formatAccessionNumber(value: number): string {
  return String(value).padStart(ACCESSION_NUMBER_MIN_WIDTH, '0')
}

/**
 * Generate sequential accession numbers (min width 5, e.g. `48012`).
 * @param count Number of accession numbers to generate
 * @returns Array of accession numbers
 */
export async function generateAccessionNumbers(count: number): Promise<string[]> {
  const accessionNumbers: string[] = []
  
  // Use transaction to ensure atomic sequence updates
  await prisma.$transaction(async (tx) => {
    // Get or create sequence
    let sequence = await tx.accessionNumberSequence.findFirst()
    
    if (!sequence) {
      sequence = await tx.accessionNumberSequence.create({
        data: {
          last_number: INITIAL_LAST_NUMBER
        }
      })
    }

    // Ensure the sequence never starts below the configured floor.
    if (sequence.last_number < INITIAL_LAST_NUMBER) {
      sequence = await tx.accessionNumberSequence.update({
        where: { id: sequence.id },
        data: { last_number: INITIAL_LAST_NUMBER }
      })
    }

    let currentNumber = sequence.last_number
    
    // Generate accession numbers
    for (let i = 0; i < count; i++) {
      currentNumber++
      accessionNumbers.push(formatAccessionNumber(currentNumber))
    }
    
    // Update sequence
    await tx.accessionNumberSequence.update({
      where: { id: sequence.id },
      data: { last_number: currentNumber }
    })
  })
  
  return accessionNumbers
}

/**
 * Generate a single accession number
 * @returns Single accession number
 */
export async function generateSingleAccessionNumber(): Promise<string> {
  const numbers = await generateAccessionNumbers(1)
  return numbers[0]
}

/**
 * Get the next accession number without committing it
 * Useful for previewing what the next number will be
 */
export async function getNextAccessionNumber(): Promise<string> {
  const sequence = await prisma.accessionNumberSequence.findFirst()
  const lastNumber = sequence?.last_number ?? INITIAL_LAST_NUMBER
  const nextNumber = Math.max(lastNumber, INITIAL_LAST_NUMBER) + 1
  return formatAccessionNumber(nextNumber)
}

/** Numeric-only accession numbers (zero-padded integers). */
const NUMERIC_ACCESSION_RE = /^(\d+)$/

/**
 * Ensure the central sequence never falls behind a manually-entered
 * accession number.  Call this from copy-create / copy-update
 * endpoints whenever a user-supplied accession number is accepted.
 *
 * Only numeric (bare-integer) accession numbers advance the
 * sequence — legacy `LIB-` prefixed numbers or other non-numeric
 * values are ignored.
 */
export async function advanceSequenceIfNeeded(accessionNumber: string): Promise<void> {
  const m = accessionNumber.match(NUMERIC_ACCESSION_RE)
  if (!m) return
  const num = parseInt(m[1], 10)

  const sequence = await prisma.accessionNumberSequence.findFirst()
  if (!sequence) {
    await prisma.accessionNumberSequence.create({
      data: { last_number: Math.max(num, INITIAL_LAST_NUMBER) },
    })
    return
  }
  if (num > sequence.last_number) {
    await prisma.accessionNumberSequence.update({
      where: { id: sequence.id },
      data: { last_number: num },
    })
  }
}
