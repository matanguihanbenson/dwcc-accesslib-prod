'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PublicHeader, PublicFooter } from '@/components/layout'
import { LoadingScreen } from '@/components/ui/loading-spinner'
import { bookHref, parseSlug } from '@/lib/utils'

interface Book {
  book_id: number
  title: string
  subtitle?: string | null
  book_author: string
  status: 'AVAILABLE' | 'BORROWED' | 'LOST' | 'DAMAGED'
  category?: { name: string } | string
  material_type?: string
  isbn?: string | null
  issn?: string | null
  lccn?: string | null
  publisher?: string | null
  publication_place?: string | null
  year_published?: number | null
  publication_date?: string | null
  edition?: string | null
  pages?: number | null
  extent?: string | null
  size?: string | null
  language?: string | null
  description?: string | null
  summary?: string | null
  copies_total: number
  copies_available: number
  location?: string | null
  interest_level?: string | null
  lexile_code?: string | null
  fountas_pinnell?: string | null
  series_title?: string | null
  authors?: Array<{ name: string; dates?: string; role?: string }>
  notes?: string | Array<{ type: string; content: string }>
  created_at?: string
}

interface Copy {
  copy_id: number
  accession_number: string
  status: 'AVAILABLE' | 'BORROWED' | 'LOST' | 'DAMAGED' | 'MAINTENANCE'
  condition: 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED'
  location: string | null
  acquisition_date: string | null
}

const STATUS_STYLES: Record<Book['status'], string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-800',
  BORROWED: 'bg-blue-100 text-blue-800',
  LOST: 'bg-red-100 text-red-800',
  DAMAGED: 'bg-orange-100 text-orange-800'
}

const COPY_STATUS_STYLES: Record<Copy['status'], string> = {
  AVAILABLE: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  BORROWED: 'bg-blue-50 text-blue-700 border-blue-300',
  LOST: 'bg-red-50 text-red-700 border-red-300',
  DAMAGED: 'bg-orange-50 text-orange-700 border-orange-300',
  MAINTENANCE: 'bg-amber-50 text-amber-700 border-amber-300'
}

type TabKey = 'details' | 'copies'

function parseNotes(n: any): Array<{ type: string; content: string }> {
  if (!n) return []
  if (Array.isArray(n)) return n
  if (typeof n === 'string') {
    const t = n.trim()
    if ((t.startsWith('[') && t.endsWith(']')) || (t.startsWith('{') && t.endsWith('}'))) {
      try {
        const parsed = JSON.parse(t)
        if (Array.isArray(parsed)) return parsed
        if (parsed && typeof parsed === 'object') return [parsed]
      } catch {
        /* fall through */
      }
    }
    return [{ type: 'Note', content: n }]
  }
  return []
}

export default function BookDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const slugParam = (params?.id as string) || ''

  const [loading, setLoading] = useState(true)
  const [book, setBook] = useState<Book | null>(null)
  const [tab, setTab] = useState<TabKey>('details')
  const [copies, setCopies] = useState<Copy[]>([])
  const [copiesLoading, setCopiesLoading] = useState(false)

  // Resolve the slug and fetch the book.
  useEffect(() => {
    const { id } = parseSlug(slugParam)
    if (!id) {
      setLoading(false)
      return
    }

    const controller = new AbortController()
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/books/${id}`, {
          credentials: 'include',
          signal: controller.signal,
          cache: 'no-store'
        })
        if (!res.ok) {
          setBook(null)
        } else {
          const data = await res.json()
          const b = Array.isArray(data) ? data[0] : (data.data || data)
          setBook(b)
        }
      } catch {
        /* aborted */
      } finally {
        setLoading(false)
      }
    })()
    return () => controller.abort()
  }, [slugParam])

  // Lazy-load the copies list only when the "Copies" tab is
  // opened, so the first paint of the details view is fast.
  useEffect(() => {
    if (tab !== 'copies' || !book) return
    const bookId = book.book_id

    const controller = new AbortController()
    setCopiesLoading(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/public/books/${bookId}/copies`, {
          signal: controller.signal,
          cache: 'no-store'
        })
        if (res.ok) {
          const data = await res.json()
          setCopies(data.data || [])
        }
      } catch {
        /* aborted */
      } finally {
        setCopiesLoading(false)
      }
    })()
    return () => controller.abort()
  }, [tab, book])

  // Derive display values
  const categoryName = useMemo(
    () =>
      typeof book?.category === 'string'
        ? book.category
        : book?.category?.name || null,
    [book]
  )
  const primaryAuthor = useMemo(
    () =>
      book?.authors && book.authors.length > 0
        ? book.authors[0].name
        : book?.book_author || 'Unknown',
    [book]
  )

  if (loading) return <LoadingScreen message="Loading book…" />

  if (!book) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <PublicHeader showBrowseLink={true} />
        <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <i className="fas fa-book-open text-5xl text-gray-300 mb-4"></i>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Book not found</h1>
          <p className="text-gray-600 mb-6">
            The book you're looking for might have been moved or archived.
          </p>
          <button
            type="button"
            onClick={() => router.push('/browse')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 transition-colors"
          >
            <i className="fas fa-arrow-left text-xs"></i>
            Back to Browse
          </button>
        </main>
        <PublicFooter />
      </div>
    )
  }

  // Filter out "Summary" notes — the summary is already
  // rendered in its own block, and mixing it into the notes
  // list would duplicate the content.
  const notesList = parseNotes((book as any).notes).filter(
    (n) => n.type !== 'Summary' && (n.content || '').trim().length > 0
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50/30 via-white to-primary-50/40">
      <PublicHeader showBrowseLink={true} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-gray-500 mb-4">
          <a href="/browse" className="hover:text-primary-700 transition-colors">
            Browse
          </a>
          <i className="fas fa-chevron-right text-[10px]"></i>
          {categoryName && (
            <>
              <a
                href={`/browse?category=${encodeURIComponent(categoryName)}`}
                className="hover:text-primary-700 transition-colors truncate max-w-[200px]"
              >
                {categoryName}
              </a>
              <i className="fas fa-chevron-right text-[10px]"></i>
            </>
          )}
          <span className="text-gray-900 font-medium truncate">{book.title}</span>
        </nav>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-3">
          <button
            type="button"
            onClick={() => setTab('details')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
              tab === 'details'
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            [Title Details]
          </button>
          <button
            type="button"
            onClick={() => setTab('copies')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
              tab === 'copies'
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            [Copies] ({book.copies_total || copies.length})
          </button>
        </div>

        {tab === 'details' && (
          <DetailsTab
            book={book}
            categoryName={categoryName}
            primaryAuthor={primaryAuthor}
            notesList={notesList}
          />
        )}

        {tab === 'copies' && (
          <CopiesTab
            copies={copies}
            loading={copiesLoading}
            bookTitle={book.title}
          />
        )}
      </main>

      <PublicFooter />
    </div>
  )
}

// ============================================================================
// Title Details tab — classic MARC-style catalog record
// ============================================================================
function DetailsTab({
  book,
  categoryName,
  primaryAuthor,
  notesList
}: {
  book: Book
  categoryName: string | null
  primaryAuthor: string
  notesList: Array<{ type: string; content: string }>
}) {
  return (
    <div className="space-y-4">
      {/* Title block */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
          {book.title}
        </h1>
        {book.subtitle && (
          <p className="text-base text-gray-600 mt-1">{book.subtitle}</p>
        )}
        <p className="text-sm text-gray-700 mt-1">
          by <span className="font-semibold">{primaryAuthor}</span>
        </p>
      </div>

      {/* Quick info row — call #, location, copies */}
      <div className="rounded-md border border-gray-200 bg-white divide-y divide-gray-100 text-sm">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="text-gray-500">Call #</span>
          <span className="font-mono text-gray-900">
            {book.lccn || book.isbn || '—'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="text-gray-500">Sublocation</span>
          <span className="text-gray-900">
            {book.location || categoryName || '—'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="text-gray-500">Local copies available</span>
          <span className="text-gray-900">
            <span className="font-semibold text-primary-700">
              {book.copies_available}
            </span>{' '}
            of {book.copies_total || 0}
            <span
              className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                STATUS_STYLES[book.status]
              }`}
            >
              {book.status}
            </span>
          </span>
        </div>
      </div>

      {/* Publication Info */}
      {(book.publisher ||
        book.edition ||
        book.extent ||
        book.pages ||
        book.isbn ||
        book.material_type) && (
        <FieldSection title="Publication Info">
          <Field
            label="Published"
            value={
              book.publisher
                ? `${book.publication_place ? book.publication_place + ' : ' : ''}${book.publisher}${
                    book.publication_date ? `, ${book.publication_date}` : book.year_published ? `, ${book.year_published}` : ''
                  }`
                : book.publication_place || book.year_published || book.publication_date
                ? `${book.publication_place || ''}${
                    book.publication_place ? ' : ' : ''
                  }${book.year_published || book.publication_date || ''}`
                : null
            }
          />
          <Field label="Edition" value={book.edition} />
          <Field
            label="Format"
            value={
              book.extent ||
              (book.pages ? `${book.pages} pages` : null) ||
              (book.size ? book.size : null) ||
              (book.material_type ? book.material_type : null)
            }
          />
          <Field
            label="Content type term"
            value={book.material_type || (book.pages ? 'text' : null)}
          />
          <Field
            label="Media type term"
            value={book.pages ? 'unmediated' : null}
          />
          <Field label="ISBN" value={book.isbn} mono />
          {book.issn && <Field label="ISSN" value={book.issn} mono />}
          {book.lccn && <Field label="LCCN" value={book.lccn} mono />}
        </FieldSection>
      )}

      {/* Additional Info */}
      {(book.language ||
        book.interest_level ||
        book.lexile_code ||
        book.fountas_pinnell ||
        book.series_title ||
        book.authors ||
        book.summary ||
        book.description ||
        notesList.length > 0) && (
        <FieldSection title="Additional Info">
          {book.language && <Field label="Language" value={book.language} />}
          {book.interest_level && (
            <Field label="Interest grade level" value={book.interest_level} />
          )}
          {book.lexile_code && <Field label="Lexile" value={book.lexile_code} />}
          {book.fountas_pinnell && (
            <Field label="Fountas & Pinnell" value={book.fountas_pinnell} />
          )}
          {book.series_title && (
            <Field label="Series" value={book.series_title} />
          )}
          {book.authors && book.authors.length > 1 && (
            <Field
              label="Contributors"
              value={book.authors
                .slice(1)
                .map((a) => a.name + (a.dates ? ` (${a.dates})` : ''))
                .join(', ')}
            />
          )}

          {/* Summary / description */}
          {(book.summary || book.description) && (
            <div className="py-1.5">
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-x-3">
                <div className="text-gray-500">Summary</div>
                <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">
                  {book.summary || book.description}
                </p>
              </div>
            </div>
          )}

          {/* Notes — Summary type filtered out */}
          {notesList.length > 0 && (
            <div className="py-1.5">
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-x-3">
                <div className="text-gray-500">Notes</div>
                <ul className="space-y-1">
                  {notesList.map((n, i) => (
                    <li
                      key={i}
                      className="text-gray-900 leading-relaxed whitespace-pre-wrap"
                    >
                      {n.type && n.type !== 'Note' && (
                        <span className="inline-block mr-1.5 px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 text-[10px] font-semibold uppercase tracking-wider align-middle">
                          {n.type}
                        </span>
                      )}
                      {n.content}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </FieldSection>
      )}

      {/* Subject headings / category */}
      {categoryName && (
        <FieldSection title="Subject">
          <Field label="Category" value={categoryName} />
          {book.material_type && (
            <Field label="Material type" value={book.material_type} />
          )}
        </FieldSection>
      )}
    </div>
  )
}

// ============================================================================
// Copies tab — accession-level inventory
// ============================================================================
function CopiesTab({
  copies,
  loading,
  bookTitle
}: {
  copies: Copy[]
  loading: boolean
  bookTitle: string
}) {
  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mb-2"></div>
        <p className="text-sm text-gray-500">Loading copies…</p>
      </div>
    )
  }

  if (copies.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-8 text-center">
        <i className="fas fa-inbox text-2xl text-gray-300 mb-2"></i>
        <p className="text-sm text-gray-500">
          No individual copies have been registered for{' '}
          <span className="font-medium text-gray-700">{bookTitle}</span> yet.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-gray-100">
        {copies.map((c) => (
          <div key={c.copy_id} className="p-3">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-mono font-semibold text-sm text-gray-900">
                {c.accession_number}
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${
                  COPY_STATUS_STYLES[c.status]
                }`}
              >
                {c.status}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="font-mono text-[10px] text-gray-500">{c.condition}</span>
              {c.location && (
                <span className="inline-flex items-center gap-1">
                  <i className="fas fa-map-marker-alt text-gray-400"></i>
                  {c.location}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Accession #
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Condition
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Acquired
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {copies.map((c) => (
              <tr key={c.copy_id} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2 font-mono font-semibold text-gray-900">
                  {c.accession_number}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${
                      COPY_STATUS_STYLES[c.status]
                    }`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-gray-700">
                  {c.condition}
                </td>
                <td className="px-3 py-2 text-gray-700">
                  {c.location || (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {c.acquisition_date
                    ? new Date(c.acquisition_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================================
// Small catalog-style field row: bold label, monospaced value
// ============================================================================
function FieldSection({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[11px] font-semibold text-primary-700 uppercase tracking-wider">
          {title}
        </span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      <div className="rounded-md border border-gray-200 bg-white divide-y divide-gray-100 text-sm">
        {children}
      </div>
    </section>
  )
}

function Field({
  label,
  value,
  mono = false
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
}) {
  if (!value) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-x-3 px-3 py-1.5">
      <div className="text-gray-500">{label}</div>
      <div className={`text-gray-900 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}
