'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { fetchByISBN, type OpenLibraryBook } from '@/lib/open-library'
import { notify } from '@/lib/notification'


interface IsbnLookupModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (book: OpenLibraryBook) => void
}

type Mode = 'input' | 'preview'

export default function IsbnLookupModal({
  isOpen,
  onClose,
  onApply
}: IsbnLookupModalProps) {
  const [mode, setMode] = useState<Mode>('input')
  const [isbn, setIsbn] = useState('')
  const [lastIsbn, setLastIsbn] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [book, setBook] = useState<OpenLibraryBook | null>(null)
  const [success, setSuccess] = useState(false)

  // Reset state every time the modal is re-opened so a
  // previous search doesn't bleed into a new one.
  useEffect(() => {
    if (!isOpen) {
      // Small delay so the close animation can play before
      // we wipe the form.
      const t = setTimeout(() => {
        setMode('input')
        setIsbn('')
        setLastIsbn('')
        setLoading(false)
        setError(null)
        setBook(null)
        setSuccess(false)
      }, 150)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  const handleSearch = useCallback(async () => {
    const cleaned = isbn.replace(/[^0-9Xx]/g, '').trim()
    if (!cleaned) {
      setError('Please enter an ISBN.')
      return
    }
    if (cleaned.length !== 10 && cleaned.length !== 13) {
      setError('ISBN must be 10 or 13 digits long.')
      return
    }

    setError(null)
    setLoading(true)
    setLastIsbn(cleaned)

    try {
      const result = await fetchByISBN(cleaned)
      if (!result) {
        setError(
          `No record found for ISBN ${cleaned} on Open Library. Try a different ISBN.`
        )
        setBook(null)
        return
      }
      setBook(result)
      setSuccess(true)
      // Briefly show a success flash, then flip to the
      // preview modal so the user can review before applying.
      setTimeout(() => {
        setSuccess(false)
        setMode('preview')
      }, 900)
    } catch (err) {
      console.error('Open Library lookup failed:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Lookup failed. Check your network and try again.'
      )
      setBook(null)
    } finally {
      setLoading(false)
    }
  }, [isbn])

  // Convenience: press Enter inside the ISBN field to submit.
  const onIsbnKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault()
      handleSearch()
    }
  }

  if (!isOpen) return null
  if (typeof document === 'undefined') return null

  // Render via portal at the document body level so the
  // overlay is never clipped or constrained by an ancestor
  // (transform / filter / overflow / perspective can all
  // turn `position: fixed` into a non-viewport-relative
  // box, which leaves a visible gap at the top).
  return createPortal(
    <div
      className="fixed inset-0 z-[1000] w-screen h-screen m-0 p-0 bg-black/50"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-center min-h-screen w-full p-4"
        onClick={(e) => e.stopPropagation()}
      >
      {mode === 'input' ? (
        // Step 1: ISBN input
        <div
          className="bg-white rounded-lg shadow-xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b">
            <div className="flex items-center gap-2">
              <i className="fas fa-barcode text-blue-600"></i>
              <h2 className="text-lg font-semibold text-gray-900">
                Look up book by ISBN
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
              aria-label="Close"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="p-5 space-y-3">
            <p className="text-sm text-gray-600">
              Enter the ISBN (10 or 13 digits) and we'll fetch the
              book record from Open Library and prefill the form
              fields for you.
            </p>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                ISBN
              </label>
              <div className="relative">
                <i className="fas fa-barcode absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  autoFocus
                  type="text"
                  value={isbn}
                  onChange={(e) => {
                    setIsbn(e.target.value)
                    if (error) setError(null)
                  }}
                  onKeyDown={onIsbnKeyDown}
                  placeholder="9780140328721"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
                <i className="fas fa-circle-exclamation mt-0.5"></i>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-2.5 text-sm text-green-700">
                <i className="fas fa-check-circle"></i>
                <span>Found a record for ISBN {lastIsbn}. Opening preview…</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-2">
              <p className="text-[11px] text-gray-500">
                Powered by{' '}
                <a
                  href="https://openlibrary.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Open Library
                </a>
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSearch}
                  disabled={loading || !isbn.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-1.5"></i>
                      Searching…
                    </>
                  ) : (
                    <>
                      <i className="fas fa-search mr-1.5"></i>
                      Search
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Step 2: Preview + actions
        <div
          className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b bg-gradient-to-r from-blue-50 to-white">
            <div className="flex items-center gap-3 min-w-0">
              {book?.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={book.coverUrl}
                  alt={`Cover for ${book.title}`}
                  className="w-10 h-14 object-cover rounded shadow-sm bg-gray-100"
                />
              ) : (
                <div className="w-10 h-14 rounded bg-blue-100 flex items-center justify-center">
                  <i className="fas fa-book text-blue-600"></i>
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 truncate">
                  {book?.title || 'Book preview'}
                </h2>
                <p className="text-xs text-gray-500 truncate">
                  ISBN {lastIsbn} · sourced from Open Library
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
              aria-label="Close"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {book && <PreviewTable book={book} />}
          </div>

          <div className="px-5 py-3 border-t bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-xs text-gray-500">
              Review the values, then apply them to the form.
            </span>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="outline" onClick={onClose}>
                <i className="fas fa-times mr-1.5"></i>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  // Flip back to step 1 with the previous
                  // ISBN prefilled so the user can correct a
                  // typo or try a different edition.
                  setIsbn(lastIsbn)
                  setMode('input')
                  setError(null)
                  setBook(null)
                  setSuccess(false)
                }}
              >
                <i className="fas fa-rotate-left mr-1.5"></i>
                New ISBN search
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  if (!book) return
                  // Apply the scraped fields, then close the
                  // modal so the user lands back on the
                  // populated form immediately.
                  onApply(book)
                  notify.success(
                    'Book data loaded',
                    'Open Library fields were applied to the form.'
                  )
                  onClose()
                }}
              >
                <i className="fas fa-file-import mr-1.5"></i>
                Use these data
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>,
    document.body
  )
}

// ---------- Preview table ----------

function PreviewTable({ book }: { book: OpenLibraryBook }) {
  const Row = ({ label, value }: { label: string; value: string }) =>
    value ? (
      <div className="flex items-start gap-3 py-1.5">
        <div className="w-32 flex-shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide pt-0.5">
          {label}
        </div>
        <div className="text-sm text-gray-900 break-words flex-1 min-w-0">
          {value}
        </div>
      </div>
    ) : null

  const coAuthorsList =
    book.coAuthors.length > 0 ? book.coAuthors.join(', ') : ''
  const publishersList =
    book.publishers.length > 0 ? book.publishers.join(', ') : ''
  const placesList =
    book.publishPlaces.length > 0 ? book.publishPlaces.join(', ') : ''
  const subjectsList =
    book.subjects.length > 0
      ? book.subjects.slice(0, 12).join(', ') + (book.subjects.length > 12 ? '…' : '')
      : ''
  const ids = [
    book.isbn13.length > 0 ? `ISBN-13: ${book.isbn13.join(', ')}` : '',
    book.isbn10.length > 0 ? `ISBN-10: ${book.isbn10.join(', ')}` : '',
    book.lccn.length > 0 ? `LCCN: ${book.lccn.join(', ')}` : '',
    book.issn.length > 0 ? `ISSN: ${book.issn.join(', ')}` : '',
    book.oclc.length > 0 ? `OCLC: ${book.oclc.join(', ')}` : ''
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="divide-y divide-gray-100">
      <Section title="Brief Title">
        <Row label="Title" value={book.title} />
        <Row label="Subtitle" value={book.subtitle} />
        <Row label="Primary Author" value={book.primaryAuthor} />
        {coAuthorsList && (
          <Row label="Added Entries" value={coAuthorsList} />
        )}
      </Section>

      <Section title="Title Information">
        <Row label="Publisher" value={publishersList} />
        <Row label="Place" value={placesList} />
        <Row label="Publication Date" value={book.publishDateRaw} />
        <Row label="Material Type" value={book.materialType} />
        <Row label="Subtype" value={book.subtype} />
        <Row label="Pages" value={book.numberOfPages} />
        <Row
          label="Physical"
          value={[book.physicalDimensions, book.weight]
            .filter(Boolean)
            .join(' · ')}
        />
      </Section>

      <Section title="Identifiers">
        <Row label="ISBN" value={book.isbn} />
        <Row label="Other" value={ids} />
      </Section>

      {subjectsList && (
        <Section title="Subjects (optional notes)">
          <p className="text-xs text-gray-600 leading-relaxed">
            {subjectsList}
          </p>
        </Section>
      )}

      {book.description && (
        <Section title="Description / Summary">
          <p className="text-xs text-gray-700 leading-relaxed">
            {truncate(book.description, 600)}
          </p>
        </Section>
      )}
    </div>
  )
}

function truncate(text: string, max: number): string {
  if (!text) return ''
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max - 1).trimEnd() + '…'
}

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

// ---------- Local button (so this file is self-contained) ----------

function Button({
  children,
  onClick,
  disabled,
  className = '',
  variant = 'default'
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
  variant?: 'default' | 'outline'
}) {
  const base =
    'inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const styles =
    variant === 'outline'
      ? 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
      : 'text-white'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </button>
  )
}
