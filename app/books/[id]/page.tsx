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
  series_uniform_title?: string | null
  uniform_title?: string | null
  varying_form?: string | null
  alternate_title?: string | null
  authors?: Array<{ name: string; dates?: string; role?: string }>
  contributors?: Array<{ name: string; role?: string; dates?: string }>
  alternate_titles?: Array<{ title: string; type?: string }>
  links?: Array<{ url: string; description?: string }>
  digital_content?: Array<{ title: string; url?: string; file_type?: string }>
  notes?: string | Array<{ type: string; content: string }>
  created_at?: string
  updated_at?: string
  // Cached enrichment (set by the public catalogue API)
  other_details?: string | null
}

interface Copy {
  copy_id: number
  accession_number: string
  status: 'AVAILABLE' | 'BORROWED' | 'LOST' | 'DAMAGED' | 'MAINTENANCE'
  condition: 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED'
  location: string | null
  acquisition_date: string | null
}

interface PublicTransaction {
  transaction_id: number
  borrow_date: string | null
  due_date: string | null
  return_date: string | null
  status: string
  user_name: string | null
  user_type: string | null
  accession_number: string | null
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

const TX_STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-blue-50 text-blue-700 border-blue-300',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  OVERDUE: 'bg-red-50 text-red-700 border-red-300'
}

type TabKey = 'brief' | 'full' | 'copies' | 'marc' | 'history'

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
  const [tab, setTab] = useState<TabKey>('brief')
  const [copies, setCopies] = useState<Copy[]>([])
  const [copiesLoading, setCopiesLoading] = useState(false)
  const [transactions, setTransactions] = useState<PublicTransaction[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

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
  // opened, so the first paint of the brief view is fast.
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

  // Lazy-load the borrowing history when the "History" tab
  // is opened.
  useEffect(() => {
    if (tab !== 'history' || !book) return
    const bookId = book.book_id

    const controller = new AbortController()
    setHistoryLoading(true)
    ;(async () => {
      try {
        const res = await fetch(
          `/api/public/books/${bookId}/transactions?limit=20`,
          {
            signal: controller.signal,
            cache: 'no-store'
          }
        )
        if (res.ok) {
          const data = await res.json()
          setTransactions(data.data || [])
        }
      } catch {
        /* aborted */
      } finally {
        setHistoryLoading(false)
      }
    })()
    return () => controller.abort()
  }, [tab, book])

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
  const notesList = useMemo(
    () =>
      book
        ? parseNotes((book as any).notes).filter(
            (n) => n.type !== 'Summary' && (n.content || '').trim().length > 0
          )
        : [],
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50/30 via-white to-primary-50/40">
      <PublicHeader showBrowseLink={true} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
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
        <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
          <TabButton active={tab === 'brief'} onClick={() => setTab('brief')}>
            Brief Info
          </TabButton>
          <TabButton active={tab === 'full'} onClick={() => setTab('full')}>
            Full Info
          </TabButton>
          <TabButton active={tab === 'copies'} onClick={() => setTab('copies')}>
            Copies ({book.copies_total || copies.length})
          </TabButton>
          <TabButton active={tab === 'marc'} onClick={() => setTab('marc')}>
            MARC View
          </TabButton>
          <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
            Borrowing History
          </TabButton>
        </div>

        {tab === 'brief' && (
          <BriefInfoTab
            book={book}
            categoryName={categoryName}
            primaryAuthor={primaryAuthor}
          />
        )}

        {tab === 'full' && (
          <FullInfoTab
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

        {tab === 'marc' && (
          <MarcTab
            book={book}
            categoryName={categoryName}
            primaryAuthor={primaryAuthor}
            notesList={notesList}
          />
        )}

        {tab === 'history' && (
          <HistoryTab
            transactions={transactions}
            loading={historyLoading}
          />
        )}
      </main>

      <PublicFooter />
    </div>
  )
}
{/* 
   
*/}
// ============================================================================
// Shared UI helpers
// ============================================================================
function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-sm font-medium rounded-md border whitespace-nowrap transition-colors ${
        active
          ? 'bg-primary-600 text-white border-primary-600'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}

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
    <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-x-3 px-3 py-1.5">
      <div className="text-gray-500">{label}</div>
      <div className={`text-gray-900 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}

function EmptyState({
  icon,
  message
}: {
  icon: string
  message: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-8 text-center">
      <i className={`${icon} text-2xl text-gray-300 mb-2`}></i>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}

// ============================================================================
// Brief Info tab — only the most important quick info
// ============================================================================
function BriefInfoTab({
  book,
  categoryName,
  primaryAuthor
}: {
  book: Book
  categoryName: string | null
  primaryAuthor: string
}) {
  return (
    <div className="space-y-4">
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
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full ${
              STATUS_STYLES[book.status]
            }`}
          >
            <i className="fas fa-circle text-[8px]"></i>
            {book.status}
          </span>
          {categoryName && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
              <i className="fas fa-folder text-[10px]"></i>
              {categoryName}
            </span>
          )}
          {book.material_type && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
              <i className="fas fa-tag text-[10px]"></i>
              {book.material_type}
            </span>
          )}
        </div>
      </div>

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
          </span>
        </div>
        {book.publisher && (
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="text-gray-500">Published</span>
            <span className="text-gray-900">
              {book.publisher}
              {book.year_published ? `, ${book.year_published}` : ''}
            </span>
          </div>
        )}
        {book.isbn && (
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="text-gray-500">ISBN</span>
            <span className="font-mono text-gray-900 text-xs">{book.isbn}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Full Info tab — every field on the book record
// ============================================================================
function FullInfoTab({
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

      {/* Title block */}
      <FieldSection title="Title">
        <Field label="Title" value={book.title} />
        <Field label="Subtitle" value={book.subtitle} />
        <Field label="Uniform title" value={book.uniform_title} />
        <Field label="Varying form" value={book.varying_form} />
        <Field label="Series uniform title" value={book.series_uniform_title} />
        {book.alternate_titles && book.alternate_titles.length > 0 && (
          <Field
            label="Alternate title(s)"
            value={book.alternate_titles
              .map((t) => `${t.title}${t.type ? ` (${t.type})` : ''}`)
              .join(', ')}
          />
        )}
      </FieldSection>

      {/* Authors & contributors */}
      <FieldSection title="Authors & Contributors">
        <Field label="Primary author" value={primaryAuthor} />
        {book.authors && book.authors.length > 1 && (
          <Field
            label="Additional authors"
            value={book.authors
              .slice(1)
              .map((a) => a.name + (a.dates ? ` (${a.dates})` : ''))
              .join(', ')}
          />
        )}
        {book.contributors && book.contributors.length > 0 && (
          <div className="px-3 py-2 grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-x-3">
            <div className="text-gray-500">Contributors</div>
            <div className="space-y-2">
              {book.contributors.map((c, idx) => (
                <div key={idx} className="text-sm">
                  <div className="text-gray-900 font-medium">{c.name}</div>
                  {(c.role || c.dates) && (
                    <div className="text-xs text-gray-500">
                      {[c.role, c.dates].filter(Boolean).join(' • ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </FieldSection>

      {/* Standard numbers */}
      <FieldSection title="Standard Numbers">
        <Field label="ISBN" value={book.isbn} mono />
        <Field label="ISSN" value={book.issn} mono />
        <Field label="LCCN" value={book.lccn} mono />
      </FieldSection>

      {/* Publication */}
      <FieldSection title="Publication">
        <Field label="Publisher" value={book.publisher} />
        <Field label="Place" value={book.publication_place} />
        <Field label="Year" value={book.year_published?.toString()} />
        <Field label="Publication date" value={book.publication_date} />
        <Field label="Edition" value={book.edition} />
        <Field label="Material type" value={book.material_type} />
      </FieldSection>

      {/* Physical description */}
      <FieldSection title="Physical Description">
        <Field label="Pages" value={book.pages?.toString()} />
        <Field label="Extent" value={book.extent} />
        <Field label="Size" value={book.size} />
        <Field label="Other details" value={book.other_details} />
        <Field label="Language" value={book.language} />
        <Field label="Location" value={book.location} />
      </FieldSection>

      {/* Series & reading level */}
      <FieldSection title="Series & Reading Level">
        <Field label="Series title" value={book.series_title} />
        <Field label="Interest level" value={book.interest_level} />
        <Field label="Lexile" value={book.lexile_code} />
        <Field label="Fountas & Pinnell" value={book.fountas_pinnell} />
      </FieldSection>

      {/* Classification */}
      <FieldSection title="Classification">
        <Field label="Category" value={categoryName} />
        <Field label="Status" value={book.status} />
        <Field
          label="Copies"
          value={`${book.copies_available} available of ${book.copies_total} total`}
        />
      </FieldSection>

      {/* Content */}
      {(book.summary || book.description || notesList.length > 0) && (
        <FieldSection title="Content">
          {book.summary && <Field label="Summary" value={book.summary} />}
          {book.description && (
            <Field label="Description" value={book.description} />
          )}
          {notesList.length > 0 && (
            <Field
              label="Notes"
              value={notesList
                .map((n) => `${n.type && n.type !== 'Note' ? `[${n.type}] ` : ''}${n.content}`)
                .join(' • ')}
            />
          )}
        </FieldSection>
      )}

      {/* Digital content & links */}
      {((book.digital_content && book.digital_content.length > 0) ||
        (book.links && book.links.length > 0)) && (
        <FieldSection title="Resources">
          {book.digital_content &&
            book.digital_content.length > 0 && (
              <Field
                label="Digital content"
                value={book.digital_content
                  .map(
                    (d) =>
                      `${d.title}${d.file_type ? ` (${d.file_type})` : ''}`
                  )
                  .join(', ')}
              />
            )}
          {book.links && book.links.length > 0 && (
            <Field
              label="Links"
              value={book.links
                .map((l) => l.description || l.url)
                .join(', ')}
            />
          )}
        </FieldSection>
      )}

      {/* Metadata */}
      <FieldSection title="Metadata">
        {book.created_at && (
          <Field
            label="Created at"
            value={new Date(book.created_at).toLocaleString()}
          />
        )}
        {book.updated_at && (
          <Field
            label="Updated at"
            value={new Date(book.updated_at).toLocaleString()}
          />
        )}
      </FieldSection>
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
      <EmptyState
        icon="fas fa-inbox"
        message={`No individual copies have been registered for ${bookTitle} yet.`}
      />
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
              <span className="font-mono text-[10px] text-gray-500">
                {c.condition}
              </span>
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
                  {c.location || <span className="text-gray-400">—</span>}
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
// MARC View tab — classic library catalog record
// ============================================================================
function MarcTab({
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
                    book.publication_date
                      ? `, ${book.publication_date}`
                      : book.year_published
                      ? `, ${book.year_published}`
                      : ''
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
// Borrowing History tab — viewable by everyone
// Paginated client-side at 10 per page.
// ============================================================================
function HistoryTab({
  transactions,
  loading
}: {
  transactions: PublicTransaction[]
  loading: boolean
}) {
  const [page, setPage] = useState(1)
  const itemsPerPage = 10

  // Reset to page 1 whenever the underlying data changes
  // so the visitor always sees the most recent items first.
  useEffect(() => {
    setPage(1)
  }, [transactions])

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mb-2"></div>
        <p className="text-sm text-gray-500">Loading history…</p>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon="fas fa-history"
        message="No borrowing history yet for this book."
      />
    )
  }

  const totalPages = Math.max(1, Math.ceil(transactions.length / itemsPerPage))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * itemsPerPage
  const pageRows = transactions.slice(startIndex, startIndex + itemsPerPage)
  const pageEnd = Math.min(startIndex + itemsPerPage, transactions.length)

  // Build a smart ellipsis page-number list: 1 … 4 5 6 … 12
  const pageNumbers: (number | '…')[] = []
  const window = 1
  const first = 1
  const last = totalPages
  const left = Math.max(first + 1, safePage - window)
  const right = Math.min(last - 1, safePage + window)
  pageNumbers.push(first)
  if (left > first + 1) pageNumbers.push('…')
  else if (left === first + 1) pageNumbers.push(first + 1)
  for (let i = left; i <= right; i++) {
    if (i > first && i < last) pageNumbers.push(i)
  }
  if (right < last - 1) pageNumbers.push('…')
  else if (right === last - 1) pageNumbers.push(last - 1)
  if (last > first && !pageNumbers.includes(last)) pageNumbers.push(last)

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Showing <span className="font-medium text-gray-700">
          {startIndex + 1}–{pageEnd}
        </span>{' '}
        of {transactions.length} transactions for this title (newest
        first). Names shown for context only — this list is public
        to anyone visiting the catalogue.
      </p>
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {pageRows.map((t) => (
            <div key={t.transaction_id} className="p-3">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-sm font-medium text-gray-900 truncate">
                  {t.user_name || '—'}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded border ${
                    TX_STATUS_STYLES[t.status] ||
                    'bg-gray-50 text-gray-700 border-gray-300'
                  }`}
                >
                  {t.status}
                </span>
              </div>
              <div className="text-xs text-gray-600 space-y-0.5">
                <div>
                  <span className="text-gray-500">Accession #:</span>{' '}
                  <span className="font-mono font-semibold text-gray-800">
                    {t.accession_number || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Borrowed:</span>{' '}
                  {formatDate(t.borrow_date)}
                </div>
                <div>
                  <span className="text-gray-500">Due:</span>{' '}
                  {formatDate(t.due_date)}
                </div>
                <div>
                  <span className="text-gray-500">Returned:</span>{' '}
                  {t.return_date ? (
                    formatDate(t.return_date)
                  ) : (
                    <span className="text-amber-700">Not yet</span>
                  )}
                </div>
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
                  Borrower
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Accession #
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Borrowed
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Due
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Returned
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageRows.map((t) => (
                <tr key={t.transaction_id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm text-gray-900">
                    {t.user_name || '—'}
                  </td>
                  <td className="px-3 py-2 text-sm font-mono font-semibold text-gray-800">
                    {t.accession_number || '—'}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">
                    {formatDate(t.borrow_date)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">
                    {formatDate(t.due_date)}
                  </td>
                  <td className="px-3 py-2 text-sm whitespace-nowrap">
                    {t.return_date ? (
                      <span className="text-emerald-700">
                        {formatDate(t.return_date)}
                      </span>
                    ) : (
                      <span className="text-amber-700">Not yet</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded border ${
                        TX_STATUS_STYLES[t.status] ||
                        'bg-gray-50 text-gray-700 border-gray-300'
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination — Google-style ⏮ 1 2 3 … N ⏭ */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
          <p className="text-xs text-gray-500">
            Page <span className="font-semibold text-gray-700">{safePage}</span>{' '}
            of <span className="font-semibold text-gray-700">{totalPages}</span>
          </p>
          <nav
            className="flex items-center gap-1 flex-wrap"
            aria-label="Borrowing history pagination"
          >
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={safePage === 1}
              className="px-2.5 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              title="First page"
            >
              <i className="fas fa-angles-left"></i>
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
            >
              <i className="fas fa-chevron-left text-xs"></i>
              Prev
            </button>
            {pageNumbers.map((p, idx) =>
              p === '…' ? (
                <span
                  key={`gap-${idx}`}
                  className="px-2 text-gray-400 select-none"
                >
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  aria-current={p === safePage ? 'page' : undefined}
                  className={`min-w-[36px] h-[34px] px-2 text-sm font-semibold rounded transition-colors ${
                    p === safePage
                      ? 'bg-primary-600 text-white border border-primary-600 hover:bg-primary-700'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
            >
              Next
              <i className="fas fa-chevron-right text-xs"></i>
            </button>
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={safePage === totalPages}
              className="px-2.5 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Last page"
            >
              <i className="fas fa-angles-right"></i>
            </button>
          </nav>
        </div>
      )}
    </div>
  )
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
