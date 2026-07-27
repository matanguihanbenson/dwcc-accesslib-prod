/**
 * Generate a spelled-out version of a book title.
 *
 * All numeric sequences are converted to their English word equivalents
 * so that workmark generation can operate on the phonetic representation.
 *
 * Examples:
 *   "1 hour website"  → "one hour website"
 *   "1984"            → "nineteen eighty four"
 *   "Catch-22"        → "catch twenty two"
 *   "101 Dalmatians"  → "one hundred one dalmatians"
 *   "300"             → "three hundred"
 */

import { numberToWords } from '@/lib/number-to-words'

/**
 * Replace every numeric sequence in the title with its spoken-word form.
 * Non-numeric text is preserved and lowercased.
 */
export function generateSpelledTitle(title: string): string {
  if (!title) return ''

  return title
    .replace(/\d+/g, (match) => {
      const num = parseInt(match, 10)
      return numberToWords(num)
    })
    .toLowerCase()
}
