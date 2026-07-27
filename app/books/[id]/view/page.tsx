'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { notify } from '@/lib/notification'

interface Book {
  book_id: number
  title: string
  book_author: string
  status: 'AVAILABLE' | 'BORROWED' | 'LOST' | 'DAMAGED'
  category?: { name: string } | string
  created_at?: string
  updated_at?: string
}

interface BorrowTransaction {
  transaction_id: number
  borrow_date?: string
  return_date?: string
  due_date?: string
  penalty: number
  book_id: number
  user?: {
    full_name: string
    account_id: string
  }
}

export default function BookViewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const bookId = params.id as string

  const [loading, setLoading] = useState(true)
  const [book, setBook] = useState<Book | null>(null)
  const [recentTransactions, setRecentTransactions] = useState<BorrowTransaction[]>([])

  useEffect(() => {
    if (status === 'loading' || !bookId) return
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/books/${bookId}`, { credentials: 'include' })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          await notify.error('Error', j.error || 'Failed to fetch book details')
          router.push('/books')
          return
        }
        const data = await res.json()
        const b = Array.isArray(data) ? data[0] : (data.data || data)
        setBook(b)

        const trxRes = await fetch('/api/borrowing-transactions', { credentials: 'include' })
        if (trxRes.ok) {
          const trxData = await trxRes.json()
          const list: BorrowTransaction[] = Array.isArray(trxData)
            ? trxData
            : (trxData.data?.data || trxData.data || [])
          const filtered = list
            .filter((t) => (t as any).book_id === parseInt(bookId))
            .sort((a, b) => new Date(b.borrow_date || b.return_date || '').getTime() - new Date(a.borrow_date || a.return_date || '').getTime())
            .slice(0, 5)
          setRecentTransactions(filtered)
        }
      } catch {
        await notify.error('Error', 'Network error occurred')
      } finally {
        setLoading(false)
      }
    })()
  }, [status, bookId, router])

  const formatDate = (d?: string) => (d ? new Date(d).toLocaleString() : '—')
  const display = (v: any) => (v === null || v === undefined || (typeof v === 'string' && v.trim() === '') ? '—' : v)

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-green-100 text-green-800 border-green-200'
      case 'BORROWED': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'LOST': return 'bg-red-100 text-red-800 border-red-200'
      case 'DAMAGED': return 'bg-orange-100 text-orange-800 border-orange-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const parseNotes = (n: any): Array<{ type?: string; content?: string }> => {
    if (!n) return []
    if (Array.isArray(n)) return n
    if (typeof n === 'string') {
      const t = n.trim()
      if ((t.startsWith('[') && t.endsWith(']')) || (t.startsWith('{') && t.endsWith('}'))) {
        try {
          const parsed = JSON.parse(t)
          if (Array.isArray(parsed)) return parsed
          if (parsed && typeof parsed === 'object') return [parsed]
        } catch {}
      }
      return [{ type: 'Note', content: n }]
    }
    return []
  }

  if (loading) {
    return (
      <div className="px-6 py-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Loading book details...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!book) {
    return (
      <div className="px-6 py-4">
        <div className="text-center py-12 text-gray-600">Book not found</div>
      </div>
    )
  }

  const notesList = parseNotes((book as any).notes).filter((n) => n.type !== 'Summary')
  const categoryName = typeof book.category === 'string' ? book.category : (book.category?.name || '—')
  const sectionName = typeof (book as any).section === 'string' ? (book as any).section : ((book as any).section?.name || '—')
  const primaryAuthor = (book as any).authors && (book as any).authors.length > 0 ? (book as any).authors[0].name : (book as any).book_author || 'Unknown'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <button
            onClick={() => router.back()}
            className="mt-1 flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 transition-colors"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight truncate">{book.title}</h1>
            {(book as any).subtitle && (
              <p className="text-sm text-gray-500 mt-0.5 truncate">{(book as any).subtitle}</p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusBadgeColor(book.status)}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                {book.status}
              </span>
              <span className="text-sm text-gray-600">by <Link href={`/books/authors/${encodeURIComponent(primaryAuthor)}`} className="hover:text-blue-600 hover:underline transition-colors">{primaryAuthor}</Link></span>
              <span className="text-gray-300">|</span>
              <span className="text-sm text-gray-500">{categoryName}</span>
              {(book as any).material_type && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="text-sm text-gray-500">{(book as any).material_type}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/books/${book.book_id}/edit`}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <i className="fas fa-edit mr-1.5"></i>Edit
          </Link>
          <Link
            href={`/books/${book.book_id}`}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <i className="fas fa-eye mr-1.5"></i>Public View
          </Link>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-1 space-y-6">
          {/* Quick Info */}
          <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Quick Info</h3>
            <div className="space-y-0">
              {(book as any).call_number && (
                <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                  <span className="text-sm text-gray-500">Call #</span>
                  <span className="text-sm font-mono font-medium text-gray-900">{(book as any).call_number}</span>
                </div>
              )}
              {(book as any).classification && (
                <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                  <span className="text-sm text-gray-500">DDC</span>
                  <span className="text-sm font-mono font-medium text-gray-900">
                    {(book as any).classification.code}
                    {((book as any).classification as any).name && (
                      <span className="font-sans text-gray-400 ml-1">— {((book as any).classification as any).name}</span>
                    )}
                  </span>
                </div>
              )}
              {(book as any).edition && (
                <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                  <span className="text-sm text-gray-500">Edition</span>
                  <span className="text-sm font-medium text-gray-900">{(book as any).edition}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                <span className="text-sm text-gray-500">Section</span>
                <span className="text-sm font-medium text-gray-900">{sectionName}</span>
              </div>
              <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                <span className="text-sm text-gray-500">Language</span>
                <span className="text-sm font-medium text-gray-900">{display((book as any).language)}</span>
              </div>
              <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                <span className="text-sm text-gray-500">Location</span>
                <span className="text-sm font-medium text-gray-900">{display((book as any).location)}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-gray-500">Copies</span>
                <span className="text-sm font-medium">
                  <span className="text-green-600">{display((book as any).copies_available)}</span>
                  <span className="text-gray-300 mx-1">/</span>
                  <span className="text-gray-900">{display((book as any).copies_total)}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Standard Numbers */}
          {((book as any).isbn || (book as any).issn || (book as any).lccn) && (
            <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Standard Numbers</h3>
              <div className="space-y-3">
                {(book as any).isbn && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-0.5">ISBN</label>
                    <p className="text-sm text-gray-900 font-mono">{(book as any).isbn}</p>
                  </div>
                )}
                {(book as any).issn && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-0.5">ISSN</label>
                    <p className="text-sm text-gray-900 font-mono">{(book as any).issn}</p>
                  </div>
                )}
                {(book as any).lccn && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-0.5">LCCN</label>
                    <p className="text-sm text-gray-900 font-mono">{(book as any).lccn}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Physical Description */}
          {((book as any).pages || (book as any).extent || (book as any).size) && (
            <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Physical Description</h3>
              <div className="space-y-0">
                {(book as any).pages && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500">Pages</span>
                    <span className="text-sm font-medium text-gray-900">{(book as any).pages}</span>
                  </div>
                )}
                {(book as any).extent && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500">Extent</span>
                    <span className="text-sm font-medium text-gray-900">{(book as any).extent}</span>
                  </div>
                )}
                {(book as any).size && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-500">Size</span>
                    <span className="text-sm font-medium text-gray-900">{(book as any).size}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Publication Information */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
                <i className="fas fa-book-open text-blue-600 text-xs"></i>
              </div>
              Publication Information
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-0.5">Publisher</label>
                <p className="text-sm text-gray-900">{display((book as any).publisher)}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-0.5">Publication Place</label>
                <p className="text-sm text-gray-900">{display((book as any).publication_place)}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-0.5">Publication Date</label>
                <p className="text-sm text-gray-900">{display((book as any).publication_date)}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-0.5">Year Published</label>
                <p className="text-sm text-gray-900">{display((book as any).year_published)}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-0.5">Edition</label>
                <p className="text-sm text-gray-900">{display((book as any).edition)}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-0.5">Language</label>
                <p className="text-sm text-gray-900">{display((book as any).language)}</p>
              </div>
            </div>
          </div>

          {/* Classification */}
          {((book as any).call_number || (book as any).classification) && (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
                  <i className="fas fa-tags text-blue-600 text-xs"></i>
                </div>
                Classification
              </h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                {(book as any).call_number && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-0.5">Call Number</label>
                    <p className="text-sm text-gray-900 font-mono">{(book as any).call_number}</p>
                  </div>
                )}
                {(book as any).classification && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-400 mb-0.5">DDC Code</label>
                      <p className="text-sm text-gray-900 font-mono">{(book as any).classification.code}</p>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-0.5">DDC Name</label>
                      <p className="text-sm text-gray-900">{((book as any).classification as any).name || '—'}</p>
                    </div>
                    {((book as any).classification as any).level && (
                      <div>
                        <label className="block text-xs text-gray-400 mb-0.5">DDC Level</label>
                        <p className="text-sm text-gray-900">{((book as any).classification as any).level}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Series & Reading Levels */}
          {((book as any).series_title || (book as any).interest_level || (book as any).lexile_code || (book as any).fountas_pinnell) && (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
                  <i className="fas fa-layer-group text-blue-600 text-xs"></i>
                </div>
                Series & Reading Levels
              </h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                {(book as any).series_title && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-0.5">Series Title</label>
                    <p className="text-sm text-gray-900">{(book as any).series_title}</p>
                  </div>
                )}
                {(book as any).volume_number && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-0.5">Volume Number</label>
                    <p className="text-sm text-gray-900">{(book as any).volume_number}</p>
                  </div>
                )}
                {(book as any).interest_level && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-0.5">Interest Level</label>
                    <p className="text-sm text-gray-900">{(book as any).interest_level}</p>
                  </div>
                )}
                {(book as any).lexile_code && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-0.5">Lexile Code</label>
                    <p className="text-sm text-gray-900">{(book as any).lexile_code}</p>
                  </div>
                )}
                {(book as any).fountas_pinnell && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-0.5">Fountas & Pinnell</label>
                    <p className="text-sm text-gray-900">{(book as any).fountas_pinnell}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {((book as any).description || (book as any).summary) && (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
                  <i className="fas fa-align-left text-blue-600 text-xs"></i>
                </div>
                Description
              </h3>
              {(book as any).description && (
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{(book as any).description}</p>
              )}
              {!((book as any).description) && (book as any).summary && (
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{(book as any).summary}</p>
              )}
            </div>
          )}

          {/* Notes — filter out Summary type since it's shown in Description */}
          {notesList.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-amber-900 mb-3 flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-amber-100 flex items-center justify-center">
                  <i className="fas fa-sticky-note text-amber-600 text-xs"></i>
                </div>
                Notes
              </h3>
              <ul className="space-y-2">
                {notesList.map((n, i) => (
                  <li key={i} className="text-sm text-amber-900">
                    {n.type && (
                      <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-medium mr-2">
                        {n.type}
                      </span>
                    )}
                    <span className="whitespace-pre-wrap">{n.content ?? ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Authors & Contributors */}
      {(Array.isArray((book as any).authors) && (book as any).authors.length > 0) || (Array.isArray((book as any).contributors) && (book as any).contributors.length > 0) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.isArray((book as any).authors) && (book as any).authors.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
                  <i className="fas fa-user-edit text-blue-600 text-xs"></i>
                </div>
                Authors
              </h3>
              <ul className="space-y-2">
                {(book as any).authors.map((a: any, idx: number) => (
                  <li key={idx} className="flex items-start">
                    <i className="fas fa-circle text-blue-400 text-xs mt-1.5 mr-3"></i>
                    <div>
                      <Link href={`/books/authors/${encodeURIComponent(a.name)}`} className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline transition-colors">{a.name}</Link>
                      {a.dates && <p className="text-xs text-gray-500">{a.dates}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray((book as any).contributors) && (book as any).contributors.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
                  <i className="fas fa-users text-blue-600 text-xs"></i>
                </div>
                Contributors
              </h3>
              <ul className="space-y-2">
                {(book as any).contributors.map((c: any, idx: number) => (
                  <li key={idx} className="flex items-start">
                    <i className="fas fa-circle text-blue-400 text-xs mt-1.5 mr-3"></i>
                    <div>
                      <Link href={`/books/authors/${encodeURIComponent(c.name)}`} className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline transition-colors">{c.name}</Link>
                      {(c.role || c.dates) && (
                        <p className="text-xs text-gray-500">{[c.role, c.dates].filter(Boolean).join(' • ')}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      {/* Alternate Titles & Links */}
      {(Array.isArray((book as any).alternate_titles) && (book as any).alternate_titles.length > 0) || (Array.isArray((book as any).links) && (book as any).links.length > 0) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.isArray((book as any).alternate_titles) && (book as any).alternate_titles.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
                  <i className="fas fa-heading text-blue-600 text-xs"></i>
                </div>
                Alternate Titles
              </h3>
              <ul className="space-y-2">
                {(book as any).alternate_titles.map((t: any, idx: number) => (
                  <li key={idx} className="flex items-start">
                    <i className="fas fa-circle text-blue-400 text-xs mt-1.5 mr-3"></i>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t.title}</p>
                      {t.type && <p className="text-xs text-gray-500">{t.type}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray((book as any).links) && (book as any).links.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
                  <i className="fas fa-link text-blue-600 text-xs"></i>
                </div>
                Links
              </h3>
              <ul className="space-y-2">
                {(book as any).links.map((l: any, idx: number) => (
                  <li key={idx}>
                    <a
                      className="flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <i className="fas fa-external-link-alt text-xs mr-2"></i>
                      {l.description || l.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      {/* Digital Content */}
      {Array.isArray((book as any).digital_content) && (book as any).digital_content.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
              <i className="fas fa-cloud text-blue-600 text-xs"></i>
            </div>
            Digital Content
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(book as any).digital_content.map((d: any, idx: number) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 mb-1">{d.title}</p>
                    {d.file_type && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {d.file_type}
                      </span>
                    )}
                  </div>
                  {d.url && (
                    <a
                      className="ml-3 text-blue-600 hover:text-blue-800 transition-colors"
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      title="Open"
                    >
                      <i className="fas fa-external-link-alt"></i>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
            <i className="fas fa-history text-blue-600 text-xs"></i>
          </div>
          Recent Transactions
        </h3>
        {recentTransactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <i className="fas fa-inbox text-3xl mb-3 text-gray-300"></i>
            <p className="text-sm">No recent transactions</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Borrowed</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Due</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Returned</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Penalty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentTransactions.map((t) => (
                  <tr key={t.transaction_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4 text-sm">
                      <div className="font-medium text-gray-900">{t.user?.full_name || '—'}</div>
                      <div className="text-xs text-gray-500">{t.user?.account_id || '—'}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(t.borrow_date)}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(t.due_date)}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      {t.return_date ? (
                        <span className="text-green-600">{formatDate(t.return_date)}</span>
                      ) : (
                        <span className="text-orange-600">Not returned</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      {t.penalty > 0 ? (
                        <span className="text-red-600 font-medium">₱{t.penalty}</span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
