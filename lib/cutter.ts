/**
 * LC Cutter number generation based on the Classification and
 * Shelflisting Manual instruction sheet G 63.
 *
 * Cutter numbers are decimal fractions stored as strings:
 *   H3  = 0.300  (base)
 *   H23 = 0.230  (expanded, 3rd letter of surname)
 *   H33 = 0.330  (expanded, 1st letter of first name — same surname)
 *
 * Cutter numbers are scoped per classification — the same author
 * can have the same cutter in different classes.
 *
 * Work marks disambiguate books by the same author in the same class.
 *   workmark = first letter of title (lowercase), articles stripped,
 *              expanded to be unique within author+class.
 *              Titles with numbers are spelled out first.
 */

// ─── G63 Base cutter tables ───────────────────────────────

function isVowel(ch: string): boolean {
  return 'aeiou'.includes(ch.toLowerCase())
}

function vowelTable(ch: string): string {
  switch (ch) {
    case 'b': return '2'
    case 'd': return '3'
    case 'l': case 'm': return '4'
    case 'n': return '5'
    case 'p': return '6'
    case 'r': return '7'
    case 's': case 't': return '8'
    case 'u': case 'v': case 'w': case 'x': case 'y': return '9'
    default: return '3'
  }
}

function sTable(rest: string): string {
  if (!rest) return '3'
  const r1 = rest.charAt(0)
  if (r1 === 'a') return '2'
  if (rest.startsWith('ch')) return '3'
  if (r1 === 'e') return '4'
  if (r1 === 'h' || r1 === 'i') return '5'
  if (r1 === 'm' || r1 === 'p') return '6'
  if (r1 === 't') return '7'
  if (r1 === 'u') return '8'
  if ('wxyz'.includes(r1)) return '9'
  return '5'
}

function quTable(ch: string): string {
  switch (ch) {
    case 'a': return '3'
    case 'e': return '4'
    case 'i': return '5'
    case 'o': return '6'
    case 'r': return '7'
    case 't': return '8'
    case 'y': return '9'
    default: return '3'
  }
}

function consonantTable(ch: string): string {
  switch (ch) {
    case 'a': return '3'
    case 'e': return '4'
    case 'i': return '5'
    case 'o': return '6'
    case 'r': return '7'
    case 'u': return '8'
    case 'y': return '9'
    default: return '3'
  }
}

/**
 * G63 expansion table for subsequent letters (Rule 5).
 * Maps a single letter to a digit for cutter expansion.
 */
function expansionDigit(ch: string): number {
  const c = ch.toLowerCase()
  if (c >= 'a' && c <= 'd') return 3
  if (c >= 'e' && c <= 'g') return 4
  if (c >= 'h' && c <= 'j') return 5
  if (c >= 'k' && c <= 'o') return 6
  if (c >= 'p' && c <= 's') return 7
  if (c >= 't' && c <= 'v') return 8
  if (c >= 'w' && c <= 'z') return 9
  return 3
}

// ─── Cutter number generation (base) ──────────────────────

/**
 * Generate a base Cutter number from an author surname.
 *
 * Rules (G 63):
 * 1. After initial vowel:  b=2, d=3, l-m=4, n=5, p=6, r=7, s-t=8, u-y=9
 * 2. After initial S:      a=2, ch=3, e=4, h-i=5, m-p=6, t=7, u=8, w-z=9
 * 3. After initial Qu:     a=3, e=4, i=5, o=6, r=7, t=8, y=9
 * 4. After other consonants: a=3, e=4, i=5, o=6, r=7, u=8, y=9
 */
export function generateCutterNumber(surname: string): string {
  const name = surname.trim()
  if (!name) return ''

  const parts = name.split(/\s+/)
  const raw = (parts.pop() || name).replace(/[^A-Za-z]/g, '')
  if (!raw) return ''

  const initial = raw.charAt(0).toUpperCase()
  const rest = raw.slice(1).toLowerCase()

  if (!rest) return initial

  const secondChar = rest.charAt(0)
  let digit: string

  if (isVowel(initial)) {
    digit = vowelTable(secondChar)
  } else if (initial === 'S') {
    digit = sTable(rest)
  } else if (initial === 'Q' && rest.startsWith('u')) {
    const thirdChar = rest.length > 1 ? rest.charAt(1) : ''
    digit = quTable(thirdChar)
  } else {
    digit = consonantTable(secondChar)
  }

  return initial + digit
}

// ─── Cutter decimal conversion ────────────────────────────

/**
 * Convert a cutter number string to its decimal value for sorting.
 *
 * "H3"  → 0.300
 * "H23" → 0.230
 * "H27" → 0.270
 * "H33" → 0.330
 */
export function cutterToDecimal(cutter: string): number {
  if (!cutter) return 0
  const digits = cutter.slice(1) // drop initial letter
  if (!digits) return 0
  const padded = digits.padEnd(3, '0').slice(0, 3)
  return parseFloat('0.' + padded)
}

// ─── Shelflist interpolation ──────────────────────────────

/** Extract the surname (last word) from a full name. */
function extractSurname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return (parts.pop() || fullName).replace(/[^A-Za-z]/g, '').toLowerCase()
}

/** Extract the first name (everything before the last word), lowercase alpha-only. */
function extractFirstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length < 2) return ''
  return parts.slice(0, -1).join('').replace(/[^A-Za-z]/g, '').toLowerCase()
}

/** Get the nth letter (0-indexed) of a string, or '' if out of bounds. */
function letterAt(s: string, idx: number): string {
  return s.charAt(idx) || ''
}

/** Strip leading articles from a title for workmark purposes. */
function stripArticles(title: string): string {
  return title.replace(/^(the|a|an)\s+/i, '').trim()
}

/**
 * Expand a cutter number below a given upper bound.
 *
 * Used when the new name sorts before all existing entries.
 * Example: expandBelow("H3", "hades") → "H23"
 *
 * Algorithm:
 * 1. Take the upper bound's first digit (e.g., 3 from H3)
 * 2. Step back to (digit - 1) for the block (e.g., 2)
 * 3. Use the expansion letter (3rd letter of surname) for the second digit
 */
function expandBelow(upperCutter: string, surname: string): string {
  const initial = upperCutter.charAt(0).toUpperCase()
  const upperDigit = parseInt(upperCutter.slice(1)) || 3

  // Step back one block
  const blockDigit = Math.max(2, upperDigit - 1)

  // Use 3rd letter of surname for expansion
  const expansionLetter = letterAt(surname, 2) // 0-indexed: 3rd letter
  if (expansionLetter) {
    const d = expansionDigit(expansionLetter)
    return initial + String(blockDigit) + String(d)
  }

  // No 3rd letter available — use block edge
  return initial + String(blockDigit) + '3'
}

/**
 * Expand a cutter number above a given lower bound.
 *
 * Used when the new name sorts after all existing entries.
 * Example: expandAbove("H3", "haynes") → "H33" or "H4"
 */
function expandAbove(lowerCutter: string, surname: string): string {
  const initial = lowerCutter.charAt(0).toUpperCase()
  const lowerDigits = lowerCutter.slice(1)

  if (lowerDigits.length === 1) {
    // Base cutter — step up one block
    const blockDigit = parseInt(lowerDigits)
    const expansionLetter = letterAt(surname, 2)
    if (expansionLetter) {
      const d = expansionDigit(expansionLetter)
      // If expansion digit > block, we can try to stay in block
      // but for "above" we need to be > lowerCutter
      const candidate = initial + String(blockDigit) + String(d)
      if (cutterToDecimal(candidate) > cutterToDecimal(lowerCutter)) {
        return candidate
      }
    }
    // Step to next block
    return initial + String(Math.min(9, blockDigit + 1))
  }

  // Already expanded — try appending more digits
  const expansionLetter = letterAt(surname, lowerDigits.length + 1)
  if (expansionLetter) {
    const d = expansionDigit(expansionLetter)
    const candidate = lowerCutter + String(d)
    if (cutterToDecimal(candidate) > cutterToDecimal(lowerCutter)) {
      return candidate
    }
  }

  // Fallback: increment last digit
  const lastDigit = parseInt(lowerDigits.charAt(lowerDigits.length - 1))
  if (lastDigit < 9) {
    return lowerCutter.slice(0, -1) + String(lastDigit + 1)
  }

  return lowerCutter + '3'
}

/**
 * Expand a cutter number to fit between a lower and upper bound.
 *
 * Example: expandBetween("H23", "H3", "harrison") → "H27"
 *
 * Algorithm:
 * 1. Determine the block (use predecessor's block or step back from successor)
 * 2. Use expansion letter to find the right position within the block
 * 3. Keep expanding if needed
 */
function expandBetween(
  lowerCutter: string,
  upperCutter: string,
  surname: string
): string {
  const initial = lowerCutter.charAt(0).toUpperCase()
  const lowerDec = cutterToDecimal(lowerCutter)
  const upperDec = cutterToDecimal(upperCutter)

  // Try expanding the lower cutter with additional digits
  // using the expansion letter from the surname
  const expandPos = lowerCutter.length // position to add digit

  // Try all possible expansion digits, pick the largest that's still < upper
  let bestCandidate = ''
  let bestDec = lowerDec

  for (let d = 9; d >= 3; d--) {
    const candidate = lowerCutter + String(d)
    const candDec = cutterToDecimal(candidate)
    if (candDec > lowerDec && candDec < upperDec) {
      if (candDec > bestDec) {
        bestCandidate = candidate
        bestDec = candDec
      }
    }
  }

  if (bestCandidate) return bestCandidate

  // If we can't fit by appending to lower, try the surname's expansion letter
  const expansionLetter = letterAt(surname, lowerCutter.length)
  if (expansionLetter) {
    const d = expansionDigit(expansionLetter)
    const candidate = lowerCutter + String(d)
    const candDec = cutterToDecimal(candidate)
    if (candDec > lowerDec && candDec < upperDec) {
      return candidate
    }
  }

  // Try stepping within the upper block
  const upperDigits = parseInt(upperCutter.slice(1)) || 3
  for (let blockDigit = upperDigits - 1; blockDigit >= 2; blockDigit--) {
    const expansionLetter2 = letterAt(surname, 2)
    if (expansionLetter2) {
      const d = expansionDigit(expansionLetter2)
      const candidate = initial + String(blockDigit) + String(d)
      const candDec = cutterToDecimal(candidate)
      if (candDec > lowerDec && candDec < upperDec) {
        return candidate
      }
    }
  }

  // Fallback: use midpoint
  const mid = (lowerDec + upperDec) / 2
  const midStr = String(mid).slice(2) // "0.270" → "270"
  const padded = midStr.padEnd(3, '0')
  return initial + padded
}

/**
 * Expand a cutter to disambiguate between same-surname authors.
 *
 * Uses the first name letters with the G63 expansion table.
 * Example: "Haynes, Arthur" → H33 (A→3), "Haynes, Zack" → H39 (Z→9)
 */
function expandSameSurname(
  baseCutter: string,
  fullName: string,
  existingCutters: string[]
): string {
  const initial = baseCutter.charAt(0).toUpperCase()
  const baseDigit = baseCutter.slice(1)
  const firstName = extractFirstName(fullName)
  const used = new Set(existingCutters.map((c) => c.toLowerCase()))

  // Try expanding with first name letters
  for (let i = 0; i < Math.max(firstName.length, 3); i++) {
    const ch = letterAt(firstName, i)
    if (!ch) break
    const d = expansionDigit(ch)
    const candidate = baseDigit + String(d)
    if (!used.has((initial + candidate).toLowerCase())) {
      return initial + candidate
    }
    // Try additional digits for further disambiguation
    for (let extra = 3; extra <= 9; extra++) {
      const candidate2 = candidate + String(extra)
      if (!used.has((initial + candidate2).toLowerCase())) {
        return initial + candidate2
      }
    }
  }

  // Fallback: append incrementing number
  for (let n = 3; n <= 99; n++) {
    const candidate = baseDigit + String(n)
    if (!used.has((initial + candidate).toLowerCase())) {
      return initial + candidate
    }
  }

  return baseCutter + '99'
}

/**
 * Main shelflist interpolation function.
 *
 * Given a new author name and all existing cutter entries in the same
 * classification, returns the correct cutter number.
 *
 * @param newFullName - e.g. "Hades" or "Haynes, Arthur"
 * @param existingEntries - sorted list of { surname, fullName, cutter } in the classification
 * @returns the interpolated cutter number
 */
export function interpolateShelflist(
  newFullName: string,
  existingEntries: Array<{
    surname: string
    fullName: string
    cutter: string
  }>
): string {
  const newSurname = extractSurname(newFullName)
  if (!newSurname) return 'A3'

  // Check for same-surname entries
  const sameSurnameEntries = existingEntries.filter(
    (e) => e.surname === newSurname
  )

  if (sameSurnameEntries.length > 0) {
    // If the exact same full name already exists, this is the same author
    // (multiple books / series). Return the existing cutter — only the
    // work mark and year differ for different books by the same author.
    const sameAuthor = sameSurnameEntries.find(
      (e) => e.fullName.toLowerCase() === newFullName.trim().toLowerCase()
    )
    if (sameAuthor) {
      return sameAuthor.cutter
    }

    // Different person with same surname — expand using first name
    const baseCutter = sameSurnameEntries[0].cutter.replace(/[0-9]+$/, '')
    const baseDigits = sameSurnameEntries[0].cutter.slice(1)
    const existingCutterStrings = sameSurnameEntries.map((e) => e.cutter)

    // Get the base digit (first digit only)
    const baseFirstDigit = baseDigits.charAt(0)
    const baseBase = baseCutter + baseFirstDigit

    return expandSameSurname(
      baseBase,
      newFullName,
      existingCutterStrings
    )
  }

  // Different surname — generate base cutter and interpolate
  const baseCutter = generateCutterNumber(newFullName)

  // Find alphabetical position
  let predecessorIdx = -1
  let successorIdx = -1
  for (let i = 0; i < existingEntries.length; i++) {
    if (existingEntries[i].surname <= newSurname) {
      predecessorIdx = i
    }
    if (existingEntries[i].surname > newSurname && successorIdx === -1) {
      successorIdx = i
    }
  }

  const predecessor = predecessorIdx >= 0 ? existingEntries[predecessorIdx] : null
  const successor = successorIdx >= 0 ? existingEntries[successorIdx] : null

  // Check if base cutter collides with any existing entry in this classification
  const baseDec = cutterToDecimal(baseCutter)
  const collides = existingEntries.some(
    (e) => cutterToDecimal(e.cutter) === baseDec
  )

  if (!collides) {
    // No collision — use base cutter, but still check it fits between neighbors
    if (predecessor && successor) {
      const predInit = predecessor.cutter.charAt(0)
      const succInit = successor.cutter.charAt(0)
      const baseInit = baseCutter.charAt(0)

      if (baseInit !== predInit || baseInit !== succInit) {
        // Different initial blocks — alphabetical order is the arbiter
        if (baseInit >= predInit && baseInit <= succInit) return baseCutter
        // Shouldn't happen given the surname sort, but handle gracefully
        return expandBetween(predecessor.cutter, successor.cutter, newSurname)
      }

      const predDec = cutterToDecimal(predecessor.cutter)
      const succDec = cutterToDecimal(successor.cutter)
      if (baseDec > predDec && baseDec < succDec) {
        return baseCutter
      }
      // Doesn't fit — need to interpolate
      return expandBetween(predecessor.cutter, successor.cutter, newSurname)
    }
    if (predecessor) {
      const predInit = predecessor.cutter.charAt(0)
      const baseInit = baseCutter.charAt(0)
      if (baseInit !== predInit) {
        // Different blocks: if base initial > predecessor's, we're after;
        // if base initial < predecessor's, we should file before but
        // the surname sort wouldn't put us here. Return base cutter.
        if (baseInit >= predInit) return baseCutter
      }
      const predDec = cutterToDecimal(predecessor.cutter)
      if (baseDec > predDec) return baseCutter
      return expandAbove(predecessor.cutter, newSurname)
    }
    if (successor) {
      const succInit = successor.cutter.charAt(0)
      const baseInit = baseCutter.charAt(0)
      if (baseInit !== succInit) {
        // Different blocks: if base initial < successor's, we file
        // before them regardless of decimal values
        if (baseInit < succInit) return baseCutter
      }
      const succDec = cutterToDecimal(successor.cutter)
      if (baseDec < succDec) return baseCutter
      return expandBelow(successor.cutter, newSurname)
    }
    return baseCutter
  }

  // Collision — need to expand
  if (predecessor && successor) {
    return expandBetween(predecessor.cutter, successor.cutter, newSurname)
  }
  if (successor) {
    return expandBelow(successor.cutter, newSurname)
  }
  if (predecessor) {
    return expandAbove(predecessor.cutter, newSurname)
  }

  // Should never happen (collision with no neighbors)
  return baseCutter + '3'
}

// ─── Work marks ────────────────────────────────────────────

/**
 * Generate the base work mark from a book title.
 * First letter of the title in lowercase, skipping leading articles.
 */
export function generateBaseWorkmark(title: string): string {
  if (!title) return ''
  const cleaned = stripArticles(title)
  if (!cleaned) return ''
  return cleaned.charAt(0).toLowerCase() || ''
}

/**
 * Generate the final work mark by expanding the base to be unique
 * within the same author + classification.
 *
 * Rules:
 * - If the base alone is unique among existing final workmarks → use base
 * - Otherwise append the next letter(s) of the title until unique
 * - If still not unique after exhausting title letters → append a number
 *
 * @param baseWorkmark - the single-letter base (e.g. "f")
 * @param title - full title (for expansion beyond first letter)
 * @param existingFinalMarks - array of final_workmark values already used
 *                              by this author in this classification
 */
export function generateFinalWorkmark(
  baseWorkmark: string,
  title: string,
  existingFinalMarks: string[]
): string {
  if (!baseWorkmark) return ''

  const used = new Set(existingFinalMarks.map((m) => m.toLowerCase()))
  if (!used.has(baseWorkmark.toLowerCase())) return baseWorkmark

  // Strip articles and get the full title letters (lowercase, alpha only)
  const cleaned = stripArticles(title)
  const letters = cleaned.replace(/[^A-Za-z]/g, '').toLowerCase()

  // Try expanding: base + 2nd letter, base + 2nd+3rd, etc.
  for (let len = 2; len <= letters.length; len++) {
    const candidate = baseWorkmark + letters.slice(1, len)
    if (!used.has(candidate)) return candidate
  }

  // All expansions exhausted — append a number
  for (let n = 2; n <= 99; n++) {
    const candidate = baseWorkmark + String(n)
    if (!used.has(candidate)) return candidate
  }

  // Fallback (should never happen)
  return baseWorkmark + '99'
}

/**
 * Normalize a title for edition comparison.
 *
 * Strips edition/volume indicators, subtitles after colons,
 * and normalizes whitespace so that titles from different
 * editions of the same work compare equal:
 *
 *   "Python Crash Course: A Hands-On Project-Based Introduction, 2nd Edition"
 *   "Python Crash Course, 3rd Edition"
 *   "Python Crash Course"
 * all normalize to the same string.
 */
export function normalizeTitle(title: string): string {
  if (!title) return ''
  const t = title
    .toLowerCase()
    .trim()
    // Remove subtitles after colon or semicolon
    .replace(/[:;].*$/, '')
    // Remove edition markers: "1st edition", "2nd ed", "third edition", etc.
    .replace(/\b\d+(?:st|nd|rd|th)\s*(?:edition|ed\.?|version)\b/gi, '')
    .replace(
      /\b(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s*(?:edition|ed\.?|version)\b/gi,
      ''
    )
    // Remove "edition", "ed.", "vol.", "volume" with optional number
    .replace(/\b(?:edition|ed\.?|version|vol\.?|volume)\s*\d*\b/gi, '')
    // Remove bare edition numbers like "2nd", "3rd" at end
    .replace(/\b\d+(?:st|nd|rd|th)\b\s*$/g, '')
    // Remove year in parentheses or at end
    .replace(/\(\d{4}\)/g, '')
    .replace(/,\s*\d{4}\s*$/g, '')
    // Clean up residual punctuation left after stripping editions
    .replace(/\(\s*\)/g, '')    // empty parentheses
    .replace(/\[\s*\]/g, '')    // empty brackets
    .replace(/,\s*$/g, '')      // trailing commas
    .replace(/^\s*,/g, '')      // leading commas
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
  return t
}
