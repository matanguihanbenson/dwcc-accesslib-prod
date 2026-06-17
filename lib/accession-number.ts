import { prisma } from '@/lib/prisma'

const ACCESSION_SEQUENCE_START = 48000
const INITIAL_LAST_NUMBER = ACCESSION_SEQUENCE_START - 1
const ACCESSION_NUMBER_MIN_WIDTH = 5

/**
 * Generate sequential accession numbers in format LIB-XXXXX (min width 5)
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
          last_number: INITIAL_LAST_NUMBER,
          prefix: 'LIB'
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
      const paddedNumber = String(currentNumber).padStart(ACCESSION_NUMBER_MIN_WIDTH, '0')
      const accessionNumber = `${sequence.prefix}-${paddedNumber}`
      accessionNumbers.push(accessionNumber)
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
  const prefix = sequence?.prefix || 'LIB'
  return `${prefix}-${String(nextNumber).padStart(ACCESSION_NUMBER_MIN_WIDTH, '0')}`
}
