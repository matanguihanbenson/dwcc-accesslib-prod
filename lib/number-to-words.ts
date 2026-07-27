/**
 * Convert numbers to their English word representation.
 * Handles numbers from 0 up to 999,999,999,999.
 *
 * Special year handling: 4-digit numbers in range 1100–2099 are
 * read as spoken years (e.g. 1984 → "nineteen eighty-four").
 */

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
  'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
  'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'
]

const TENS = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy',
  'eighty', 'ninety'
]

/**
 * Convert a number (0–999,999,999,999) to English words.
 * Returns lowercase, no hyphens (hyphens stripped for clean workmark extraction).
 */
export function numberToWords(n: number): string {
  if (n === 0) return 'zero'
  if (n < 0) return 'negative ' + numberToWords(-n)

  // Year handling: 4-digit numbers in 1100–2099 → spoken year form
  if (n >= 1100 && n <= 2099 && Math.floor(n) === n) {
    return yearToWords(n)
  }

  return cardinalToWords(n)
}

/**
 * Read a year as two spoken parts.
 * 1984 → "nineteen eighty-four" → "nineteen eighty four"
 * 2001 → "two thousand one"
 * 2024 → "twenty twenty four"
 */
function yearToWords(n: number): string {
  const high = Math.floor(n / 100)
  const low = n % 100

  if (low === 0) {
    return cardinalToWords(high) + ' hundred'
  }
  if (high === 20 && low < 10) {
    // 2001–2009 → "two thousand one"
    return 'two thousand ' + ONES[low]
  }
  if (high === 20) {
    // 2010–2099 → "twenty X"
    return 'twenty ' + cardinalToWords(low)
  }
  // 1100–1999 → "Xteen Y"
  return cardinalToWords(high) + ' ' + cardinalToWords(low)
}

/**
 * Standard cardinal number conversion for 1–999,999,999,999.
 */
function cardinalToWords(n: number): string {
  if (n < 20) return ONES[n]

  if (n < 100) {
    const remainder = n % 10
    return remainder === 0
      ? TENS[Math.floor(n / 10)]
      : TENS[Math.floor(n / 10)] + ' ' + ONES[remainder]
  }

  if (n < 1000) {
    const remainder = n % 100
    return ONES[Math.floor(n / 100)] + ' hundred' +
      (remainder ? ' ' + cardinalToWords(remainder) : '')
  }

  if (n < 1_000_000) {
    const remainder = n % 1000
    return cardinalToWords(Math.floor(n / 1000)) + ' thousand' +
      (remainder ? ' ' + cardinalToWords(remainder) : '')
  }

  if (n < 1_000_000_000) {
    const remainder = n % 1_000_000
    return cardinalToWords(Math.floor(n / 1_000_000)) + ' million' +
      (remainder ? ' ' + cardinalToWords(remainder) : '')
  }

  const remainder = n % 1_000_000_000
  return cardinalToWords(Math.floor(n / 1_000_000_000)) + ' billion' +
    (remainder ? ' ' + cardinalToWords(remainder) : '')
}
