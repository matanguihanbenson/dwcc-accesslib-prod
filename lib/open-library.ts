/**
 * Open Library API helpers.
 *
 * Wraps the public Open Library endpoints and projects the
 * response onto the shape the Add-Book form expects.
 *
 * Endpoints used:
 *   - /api/books?bibkeys=ISBN:…&format=json&jscmd=data
 *       The "data" jscmd returns rich book records including
 *       authors, publishers, publish_date, physical_format,
 *       number_of_pages, identifiers (lccn / isbn_10 /
 *       isbn_13), subjects, and cover art.
 *
 *   - /isbn/{isbn}.json
 *       The "edition" record — gives us publish_places,
 *       physical_dimensions, weight, edition info, etc. Used
 *       as a secondary source to fill fields the bibkeys
 *       endpoint doesn't expose.
 *
 * Reference: https://openlibrary.org/dev/docs/api/books
 */

const OPEN_LIBRARY_BASE = 'https://openlibrary.org'
const FETCH_TIMEOUT_MS = 15_000

export interface OpenLibraryAuthor {
  name: string
  url?: string
}

export interface OpenLibraryBook {
  // Core bibliographic fields
  title: string
  subtitle: string
  // First author is the "primary" — the rest go into the
  // added-entries / co-authors list.
  primaryAuthor: string
  coAuthors: string[]
  // Publisher + place + date
  publishers: string[]
  publishPlaces: string[]
  publishDateRaw: string
  publishYear: string
  // Physical / format
  numberOfPages: string
  physicalFormat: string
  physicalDimensions: string
  weight: string
  // Standard identifiers
  isbn: string
  isbn10: string[]
  isbn13: string[]
  lccn: string[]
  issn: string[]
  oclc: string[]
  // Computed projections for our form (mapped by
  // `materialTypeFor()` / `subtypeFor()` below).
  materialType: string
  subtype: string
  // Series
  series: string
  // Subjects (used as fallback notes)
  subjects: string[]
  // Description / abstract — comes from the edition
  // record, the bibkeys `notes` field, or the work endpoint.
  description: string
  // Cover
  coverUrl: string
  // Raw payload — handy when the projection misses a field
  raw: any
}

// ---------- Network helpers ----------

async function fetchJson(url: string): Promise<any> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      // Cache for an hour so a repeated search for the same
      // ISBN doesn't hammer Open Library's free API.
      next: { revalidate: 3600 },
      signal: controller.signal,
      headers: { accept: 'application/json' }
    })
    if (!response.ok) {
      throw new Error(`Open Library returned ${response.status}`)
    }
    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

// ---------- Field projection ----------

/**
 * Map Open Library `physical_format` (and the more detailed
 * `physical_dimensions` / `weight`) to our form's
 * `materialType` + `subtype` selects. Returns whatever the
 * Open Library record says verbatim, lower-cased, so the
 * caller can decide whether to map it to one of the
 * hard-coded options or to auto-add a new option.
 */
function rawFormat(record: any): string {
  return String(
    record?.physical_format ||
      record?.physical_format_text ||
      record?.edition ||
      ''
  ).trim()
}

function inferMaterialType(format: string): string {
  const f = format.toLowerCase()
  if (!f) return ''
  if (f.includes('ebook') || f.includes('e-book') || f.includes('kindle'))
    return 'eBook'
  if (f.includes('audio')) return 'Audiobook'
  if (f.includes('dvd') || f.includes('bluray') || f.includes('video'))
    return 'DVD'
  if (f.includes('magazine') || f.includes('periodical')) return 'Magazine'
  // "paperback", "hardcover", "board book", etc. all count as
  // "Book" in our form's material_type enum.
  return 'Book'
}

function inferSubtype(format: string): string {
  const f = format.toLowerCase()
  if (f.includes('hardcover') || f.includes('hardback') || f.includes('cloth'))
    return 'Hardcover'
  if (f.includes('board')) return 'Board Book'
  if (f.includes('paperback') || f.includes('softcover') || f.includes('mass market'))
    return 'Paperback'
  // Fall back to the raw format so the user can fix it in
  // the form (e.g. "Trade Paperback" gets surfaced verbatim
  // and the select will auto-add it as a new option).
  return format
}

function yearOf(rawDate: string): string {
  if (!rawDate) return ''
  const match = rawDate.match(/\b(1[5-9]\d\d|20\d\d)\b/)
  return match ? match[1] : ''
}

function firstString(values: any): string {
  if (!Array.isArray(values) || values.length === 0) return ''
  const head = values[0]
  if (typeof head === 'string') return head
  if (head && typeof head === 'object' && typeof head.name === 'string')
    return head.name
  return ''
}

function authorNames(record: any): OpenLibraryAuthor[] {
  const raw = record?.authors
  if (!Array.isArray(raw)) return []
  return raw
    .map((a: any) => {
      if (typeof a === 'string') return { name: a }
      if (a && typeof a === 'object' && typeof a.name === 'string')
        return { name: a.name, url: a.url }
      return null
    })
    .filter((a): a is OpenLibraryAuthor => !!a && !!a.name)
}

// ---------- Public API ----------

/**
 * Fetch the book record for an ISBN from Open Library. Returns
 * `null` if Open Library has nothing for that ISBN.
 */
export async function fetchByISBN(rawIsbn: string): Promise<OpenLibraryBook | null> {
  const isbn = (rawIsbn || '').replace(/[^0-9Xx]/g, '').trim()
  if (!isbn) {
    throw new Error('ISBN is required')
  }

  // Primary: the rich "data" jscmd which already includes
  // authors, publishers, publish_date, identifiers, and the
  // physical format.
  const bibUrl = `${OPEN_LIBRARY_BASE}/api/books?bibkeys=ISBN:${encodeURIComponent(
    isbn
  )}&format=json&jscmd=data`
  const bib = await fetchJson(bibUrl)
  const bibRecord = bib?.[`ISBN:${isbn}`]
  if (!bibRecord) return null

  // Secondary: the edition record fills in publish_places,
  // physical_dimensions, and weight that the bibkeys API
  // doesn't include. Failures here are non-fatal — the
  // primary response is enough to populate the form.
  let editionRecord: any = {}
  try {
    editionRecord = await fetchJson(
      `${OPEN_LIBRARY_BASE}/isbn/${encodeURIComponent(isbn)}.json`
    )
  } catch {
    editionRecord = {}
  }

  // Merge: bibkeys first, edition as fallback.
  const merged: any = { ...editionRecord, ...bibRecord }

  // The bibkeys response includes the work key in the form
  // `key: "/works/OL…W"`. The work record holds the
  // canonical description / abstract for the book; pulling
  // it gives us a much richer summary than the edition
  // record alone.
  let workRecord: any = {}
  const workKey =
    typeof bibRecord?.key === 'string' && bibRecord.key.startsWith('/works/')
      ? bibRecord.key
      : typeof merged?.works?.[0]?.key === 'string'
        ? merged.works[0].key
        : ''
  if (workKey) {
    try {
      workRecord = await fetchJson(`${OPEN_LIBRARY_BASE}${workKey}.json`)
    } catch {
      workRecord = {}
    }
  }

  // Authors — primary vs added-entries (co-authors).
  const allAuthors = authorNames(merged)
  const primaryAuthor = allAuthors[0]?.name || ''
  const coAuthors = allAuthors.slice(1).map((a) => a.name)

  // Identifiers — Open Library returns them as arrays of
  // strings, sometimes nested inside the `identifiers` object
  // on the bibkeys response or as top-level fields on the
  // edition response.
  const ids = merged.identifiers || {}
  const isbn10 = Array.isArray(ids.isbn_10) ? ids.isbn_10 : []
  const isbn13 = Array.isArray(ids.isbn_13) ? ids.isbn_13 : []
  const lccn = Array.isArray(ids.lccn) ? ids.lccn : []
  const issn = Array.isArray(ids.issn) ? ids.issn : []
  const oclc = Array.isArray(ids.oclc) ? ids.oclc : []

  // Standardise: the user typed an ISBN, so we record that
  // back on the result so the form can prefill it even when
  // Open Library's own record doesn't include it.
  const format = rawFormat(merged)
  const publishDate = String(merged.publish_date || '').trim()

  // Cover — prefer medium-size from the bibkeys response.
  const coverUrl: string =
    merged.cover?.medium || merged.cover?.large || merged.cover?.small || ''

  // Subjects — joined so the user can paste them into the
  // notes/resources field if relevant.
  const subjects: string[] = Array.isArray(merged.subjects)
    ? merged.subjects
        .map((s: any) => (typeof s === 'string' ? s : s?.name))
        .filter((s: any): s is string => !!s)
    : []

  // Description — try, in order: work description, edition
  // description, bibkeys `notes`, first_sentence.
  const description = extractDescription(workRecord, editionRecord, bibRecord)

  return {
    title: String(merged.title || '').trim(),
    subtitle: String(merged.subtitle || '').trim(),
    primaryAuthor,
    coAuthors,
    publishers: firstString(merged.publishers)
      ? [firstString(merged.publishers)]
      : Array.isArray(merged.publishers)
        ? merged.publishers.map((p: any) =>
            typeof p === 'string' ? p : p?.name
          ).filter(Boolean)
        : [],
    publishPlaces: Array.isArray(merged.publish_places)
      ? merged.publish_places.map((p: any) =>
          typeof p === 'string' ? p : p?.name
        ).filter(Boolean)
      : [],
    publishDateRaw: publishDate,
    publishYear: yearOf(publishDate),
    numberOfPages: merged.number_of_pages
      ? String(merged.number_of_pages)
      : '',
    physicalFormat: format,
    physicalDimensions: String(
      merged.physical_dimensions || ''
    ).trim(),
    weight: String(merged.weight || '').trim(),
    isbn,
    isbn10,
    isbn13,
    lccn,
    issn,
    oclc,
    materialType: inferMaterialType(format),
    subtype: inferSubtype(format),
    series: '', // Open Library doesn't expose series uniformly
    subjects,
    description,
    coverUrl,
    raw: merged
  }
}

/**
 * Open Library stores descriptions as either a plain string
 * or `{ type, value }` objects. This helper flattens those
 * shapes and tries the work record (best), the edition
 * record, then the bibkeys `notes` / first_sentence.
 */
function extractDescription(workRecord: any, editionRecord: any, bibRecord: any): string {
  const candidates: any[] = [
    workRecord?.description,
    editionRecord?.description,
    bibRecord?.notes,
    editionRecord?.notes,
    bibRecord?.first_sentence
  ]
  for (const candidate of candidates) {
    const text = flattenDescription(candidate)
    if (text) return text
  }
  return ''
}

function flattenDescription(value: any): string {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'object') {
    if (typeof value.value === 'string') return value.value.trim()
    if (typeof value.text === 'string') return value.text.trim()
  }
  return ''
}
