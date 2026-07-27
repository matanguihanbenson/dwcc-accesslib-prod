/**
 * Shared call number generation utility.
 *
 * Format: {SectionCode} {DDCCode} {AuthorCutter}{FinalWorkMark} {Year}
 * Example: FIL 001 G65fi 1996
 *   - FIL  = section code
 *   - 001  = DDC classification code
 *   - G65fi = author cutter + final work mark
 *   - 1996 = publication year
 */

import { generateCutterNumber, generateBaseWorkmark, cutterToDecimal } from '@/lib/cutter'
import { generateSpelledTitle } from '@/lib/spelled-title'

interface CallNumberInput {
  section_code?: string | null
  classification_code?: string | null
  book_author?: string | null
  title?: string | null
  year_published?: number | null
}

/**
 * Generate a suggested call number from book metadata.
 * Uses base work mark (single letter) for initial suggestion;
 * final work mark is resolved at save time via the API.
 *
 * Titles containing numbers are spelled out first so that
 * the workmark reflects the phonetic first letter
 * (e.g. "1984" → "nineteen eighty four" → workmark "n").
 */
export function generateCallNumber(data: CallNumberInput): string {
  const parts: string[] = []

  if (data.section_code) {
    parts.push(data.section_code)
  }

  if (data.classification_code) {
    parts.push(data.classification_code)
  }

  const author = (data.book_author || '').trim()
  const title = (data.title || '').trim()
  if (author) {
    const cutter = generateCutterNumber(author)
    const workMark = generateBaseWorkmark(generateSpelledTitle(title) || title)
    parts.push(cutter + workMark)
  }

  if (data.year_published) {
    parts.push(String(data.year_published))
  }

  return parts.join(' ')
}

export { cutterToDecimal }
