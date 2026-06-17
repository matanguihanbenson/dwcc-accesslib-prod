'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { notify } from '@/lib/notification'
import { PublicHeader, PublicFooter } from '@/components/layout'

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
  department?: {
    department_id: number
    name: string
  }
  office?: {
    office_id: number
    name: string
  }
  borrower_representative?: string
}

export default function BookDetailsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const bookId = params.id as string

  const [loading, setLoading] = useState(true)
  const [book, setBook] = useState<Book | null>(null)
  const [recentTransactions, setRecentTransactions] = useState<BorrowTransaction[]>([])
  const isAuthenticated = status === 'authenticated' && session?.user

  useEffect(() => {
    if (status === 'loading' || !bookId) return
    ;(async () => {
      try {
        setLoading(true)
        // Fetch book details
        const res = await fetch(`/api/books/${bookId}`, { credentials: 'include' })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          await notify.error('Error', j.error || 'Failed to fetch book details')
          router.back()
          return
        }
        const data = await res.json()
        const b = Array.isArray(data) ? data[0] : (data.data || data)
        setBook(b)

        // Fetch recent transactions only if authenticated (staff only)
        if (isAuthenticated) {
          const trxRes = await fetch('/api/borrowing-transactions', { credentials: 'include' })
          if (trxRes.ok) {
            const trxData = await trxRes.json()
            const list: BorrowTransaction[] = Array.isArray(trxData)
              ? trxData
              : (trxData.data?.data || trxData.data || [])
            const filtered = list
              .filter((t) => (t as any).book_id === parseInt(bookId))
              .sort((a, b) => new Date(b.borrow_date || b.return_date || '').getTime() - new Date(a.borrow_date || a.return_date || '').getTime())
              .slice(0, 3)
            setRecentTransactions(filtered)
          }
        }
      } catch {
        await notify.error('Error', 'Network error occurred')
      } finally {
        setLoading(false)
      }
    })()
  }, [status, bookId, router, isAuthenticated])

  const formatDate = (d?: string) => (d ? new Date(d).toLocaleDateString() : '—')
  const display = (v: any) => (v === null || v === undefined || (typeof v === 'string' && v.trim() === '') ? '—' : v)

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-green-100 text-green-800'
      case 'BORROWED':
        return 'bg-blue-100 text-blue-800'
      case 'LOST':
        return 'bg-red-100 text-red-800'
      case 'DAMAGED':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
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
        } catch {
          // fall through to wrap as plain note
        }
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

  const notesList = parseNotes((book as any).notes)

  const categoryName = typeof book.category === 'string' ? book.category : (book.category?.name || '—')
  const sectionName = typeof (book as any).section === 'string' ? (book as any).section : ((book as any).section?.name || '—')
  const primaryAuthor = (book as any).authors && (book as any).authors.length > 0 ? (book as any).authors[0].name : (book as any).book_author || 'Unknown'

  const isStaff = isAuthenticated && session?.user && ['ADMIN', 'STAFF', 'SUPER_ADMIN'].includes((session.user as any).role)

  return (
    <>
      {/* Public Header */}
      <PublicHeader showSubtitle={true} subtitle="Book Details" />

      {/* Breadcrumb Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center space-x-2 text-sm text-gray-600">
            <Link href="/browse" className="hover:text-green-600 transition-colors flex items-center">
              <i className="fas fa-arrow-left mr-2"></i>
              Browse
            </Link>
            <i className="fas fa-chevron-right text-xs"></i>
            <span className="text-gray-900 font-medium">{book.title}</span>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Hero Card */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg overflow-hidden mb-6">
            <div className="px-8 py-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-6">
                  <div className="flex-shrink-0">
                    <div className="h-24 w-24 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-xl">
                      <i className="fas fa-book text-white text-4xl"></i>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-3xl font-bold text-white mb-2">{book.title}</h2>
                    {(book as any).subtitle && (
                      <p className="text-lg text-blue-100 mb-2">{(book as any).subtitle}</p>
                    )}
                    <p className="text-blue-100 mb-3">by {primaryAuthor}</p>
                    <div className="flex items-center space-x-3">
                      {(book as any).copies_available > 0 ? (
                        <span className={`inline-flex items-center px-3 py-1.5 text-sm font-semibold rounded-full ${getStatusBadgeColor(book.status)} shadow-sm`}>
                          <i className="fas fa-circle text-xs mr-2"></i>
                          {book.status}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1.5 text-sm font-semibold rounded-full bg-red-100 text-red-800 shadow-sm">
                          <i className="fas fa-times-circle text-xs mr-2"></i>
                          UNAVAILABLE
                        </span>
                      )}
                      <span className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full bg-white/20 text-white backdrop-blur-sm">
                        <i className="fas fa-folder text-xs mr-2"></i>
                        {categoryName}
                      </span>
                      {(book as any).material_type && (
                        <span className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full bg-white/20 text-white backdrop-blur-sm">
                          <i className="fas fa-tag text-xs mr-2"></i>
                          {(book as any).material_type}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Key Info & Stats */}
            <div className="lg:col-span-1 space-y-6">
              {/* Quick Stats */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Quick Info</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Section</span>
                    <span className="text-sm font-medium text-gray-900">{sectionName}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Language</span>
                    <span className="text-sm font-medium text-gray-900">{display((book as any).language)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Location</span>
                    <span className="text-sm font-medium text-gray-900">{display((book as any).location)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-600">Copies</span>
                    {(book as any).copies_available > 0 ? (
                      <span className="text-sm font-medium text-gray-900">
                        <span className="text-green-600">{display((book as any).copies_available)}</span>
                        <span className="text-gray-400 mx-1">/</span>
                        {display((book as any).copies_total)}
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-red-600">
                        Unavailable (0/{display((book as any).copies_total)})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Authors */}
              {Array.isArray((book as any).authors) && (book as any).authors.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Authors</h3>
                  <ul className="space-y-3">
                    {(book as any).authors.map((a: any, idx: number) => (
                      <li key={idx} className="flex items-start">
                        <i className="fas fa-user text-blue-500 text-xs mt-1 mr-3"></i>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{a.name}</p>
                          {a.dates && <p className="text-xs text-gray-500">{a.dates}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Contributors */}
              {Array.isArray((book as any).contributors) && (book as any).contributors.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Contributors</h3>
                  <ul className="space-y-3">
                    {(book as any).contributors.map((c: any, idx: number) => (
                      <li key={idx} className="flex items-start">
                        <i className="fas fa-users text-blue-500 text-xs mt-1 mr-3"></i>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{c.name}</p>
                          {(c.role || c.dates) && (
                            <p className="text-xs text-gray-500">{[c.role, c.dates].filter(Boolean).join(' • ')}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Standard Numbers */}
              {((book as any).isbn || (book as any).issn || (book as any).lccn) && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Standard Numbers</h3>
                  <div className="space-y-3">
                    {(book as any).isbn && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">ISBN</label>
                        <p className="text-sm text-gray-900 font-mono">{(book as any).isbn}</p>
                      </div>
                    )}
                    {(book as any).issn && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">ISSN</label>
                        <p className="text-sm text-gray-900 font-mono">{(book as any).issn}</p>
                      </div>
                    )}
                    {(book as any).lccn && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">LCCN</label>
                        <p className="text-sm text-gray-900 font-mono">{(book as any).lccn}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Physical Description */}
              {((book as any).pages || (book as any).extent || (book as any).size) && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Physical Description</h3>
                  <div className="space-y-3">
                    {(book as any).pages && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Pages</span>
                        <span className="text-sm font-medium text-gray-900">{(book as any).pages}</span>
                      </div>
                    )}
                    {(book as any).extent && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Extent</span>
                        <span className="text-sm font-medium text-gray-900">{(book as any).extent}</span>
                      </div>
                    )}
                    {(book as any).size && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Size</span>
                        <span className="text-sm font-medium text-gray-900">{(book as any).size}</span>
                      </div>
                    )}
                    {(book as any).other_details && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Other Details</label>
                        <p className="text-sm text-gray-900">{(book as any).other_details}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Detailed Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Publication Information */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-5 flex items-center">
                  <i className="fas fa-book-open text-blue-600 mr-3"></i>
                  Publication Information
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Publisher</label>
                    <p className="text-sm text-gray-900">{display((book as any).publisher)}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Publication Place</label>
                    <p className="text-sm text-gray-900">{display((book as any).publication_place)}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Publication Date</label>
                    <p className="text-sm text-gray-900">{display((book as any).publication_date)}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Year Published</label>
                    <p className="text-sm text-gray-900">{display((book as any).year_published)}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Edition</label>
                    <p className="text-sm text-gray-900">{display((book as any).edition)}</p>
                  </div>
                </div>
              </div>

              {/* Series & Reading Levels */}
              {((book as any).series_title || (book as any).interest_level || (book as any).lexile_code || (book as any).fountas_pinnell) && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-5 flex items-center">
                    <i className="fas fa-layer-group text-blue-600 mr-3"></i>
                    Series & Reading Levels
                  </h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {(book as any).series_title && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Series Title</label>
                        <p className="text-sm text-gray-900">{(book as any).series_title}</p>
                      </div>
                    )}
                    {(book as any).volume_number && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Volume Number</label>
                        <p className="text-sm text-gray-900">{(book as any).volume_number}</p>
                      </div>
                    )}
                    {(book as any).interest_level && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Interest Level</label>
                        <p className="text-sm text-gray-900">{(book as any).interest_level}</p>
                      </div>
                    )}
                    {(book as any).lexile_code && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Lexile Code</label>
                        <p className="text-sm text-gray-900">{(book as any).lexile_code}</p>
                      </div>
                    )}
                    {(book as any).fountas_pinnell && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Fountas & Pinnell</label>
                        <p className="text-sm text-gray-900">{(book as any).fountas_pinnell}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Description & Summary */}
              {((book as any).description || (book as any).summary) && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-5 flex items-center">
                    <i className="fas fa-align-left text-blue-600 mr-3"></i>
                    Description
                  </h3>
                  {(book as any).description && (
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-500 mb-2">Description</label>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{(book as any).description}</p>
                    </div>
                  )}
                  {(book as any).summary && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2">Summary</label>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{(book as any).summary}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {notesList.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                  <h3 className="text-sm font-semibold text-amber-900 mb-3 flex items-center">
                    <i className="fas fa-sticky-note text-amber-600 mr-2"></i>
                    Notes
                  </h3>
                  <ul className="space-y-2">
                    {notesList.map((n, i) => (
                      <li key={i} className="text-sm text-amber-900">
                        {n.type && (
                          <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-xs font-medium mr-2">
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

          {/* Full Width Sections */}
          <div className="mt-6 space-y-6">
            {/* Alternate Titles & Links */}
            {(Array.isArray((book as any).alternate_titles) && (book as any).alternate_titles.length > 0) || (Array.isArray((book as any).links) && (book as any).links.length > 0) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.isArray((book as any).alternate_titles) && (book as any).alternate_titles.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <i className="fas fa-heading text-blue-600 mr-3"></i>
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
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <i className="fas fa-link text-blue-600 mr-3"></i>
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
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <i className="fas fa-cloud text-blue-600 mr-3"></i>
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

            {/* Recent Transactions - Staff Only */}
            {isStaff && recentTransactions.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <i className="fas fa-history text-blue-600 mr-3"></i>
                Recent Transactions
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Borrower</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Borrowed Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentTransactions.map((t) => (
                      <tr key={t.transaction_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4 text-sm">
                          <div className="font-medium text-gray-900">
                            {t.user?.full_name || t.department?.name || t.office?.name || '—'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {t.user?.account_id || 
                             (t.department && `Department: ${t.borrower_representative || 'N/A'}`) ||
                             (t.office && `Office: ${t.borrower_representative || 'N/A'}`) ||
                             '—'}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(t.borrow_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      <PublicFooter />
    </>
  )
}


