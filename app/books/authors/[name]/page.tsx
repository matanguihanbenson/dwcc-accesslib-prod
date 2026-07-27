'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { PageLayout, PageHeader } from '@/components/layout/PageLayout'

interface BookEntry {
  book_id: number
  title: string
  role: string
}

interface Person {
  name: string
  dates: string | null
  roles: string[]
  books: BookEntry[]
  cutter_numbers: string[]
}

interface Classification {
  code: string
  name?: string
}

interface BookWithClassification extends BookEntry {
  classification?: Classification
  call_number?: string
  category?: { name: string }
  year_published?: string
}

export default function AuthorDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const authorName = decodeURIComponent(params.name as string)

  const [books, setBooks] = useState<BookWithClassification[]>([])
  const [loading, setLoading] = useState(true)
  const [person, setPerson] = useState<Person | null>(null)
  const [sortField, setSortField] = useState<'title' | 'call_number' | 'year'>('title')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    if (status !== 'authenticated' || !authorName) return
    ;(async () => {
      try {
        const res = await fetch('/api/authors', { credentials: 'include' })
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        const found = (data.data?.people || data.people || []).find(
          (p: Person) => p.name.toLowerCase() === authorName.toLowerCase()
        )
        if (found) {
          setPerson(found)
          const bookDetails = await Promise.all(
            found.books.map(async (b: BookEntry) => {
              try {
                const bookRes = await fetch(`/api/books/${b.book_id}`, { credentials: 'include' })
                if (!bookRes.ok) return { ...b }
                const bookData = await bookRes.json()
                const book = Array.isArray(bookData) ? bookData[0] : (bookData.data || bookData)
                return {
                  ...b,
                  classification: book?.classification,
                  call_number: book?.call_number,
                  category: book?.category,
                  year_published: book?.year_published,
                }
              } catch {
                return { ...b }
              }
            })
          )
          setBooks(bookDetails)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    })()
  }, [status, authorName])

  const sortedBooks = [...books].sort((a, b) => {
    let cmp = 0
    if (sortField === 'title') cmp = a.title.localeCompare(b.title)
    else if (sortField === 'call_number') cmp = (a.call_number || '').localeCompare(b.call_number || '')
    else if (sortField === 'year') cmp = (a.year_published || '').localeCompare(b.year_published || '')
    return sortOrder === 'asc' ? cmp : -cmp
  })

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortOrder('asc') }
  }

  if (loading) {
    return (
      <div className="px-6 py-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Loading author details...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!person) {
    return (
      <div className="px-6 py-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <i className="fas fa-user-slash text-4xl mb-3 text-gray-300"></i>
          <p className="text-sm text-gray-600">Author not found</p>
          <Link href="/books/authors" className="text-blue-600 hover:underline text-sm mt-3 inline-block">
            Back to Authors
          </Link>
        </div>
      </div>
    )
  }

  return (
    <PageLayout>
      <div className="bg-white shadow-sm border-b mb-6">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 transition-colors"
              >
                <i className="fas fa-arrow-left"></i>
              </button>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-user text-blue-500 text-xl"></i>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{person.name}</h1>
                  {person.dates && (
                    <p className="text-sm text-gray-500 mt-0.5">{person.dates}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    {person.roles.map((role) => (
                      <span
                        key={role}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          role === 'Author'
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : role === 'Editor'
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : 'bg-purple-100 text-purple-800 border-purple-200'
                        }`}
                      >
                        {role}
                      </span>
                    ))}
                    <span className="text-sm text-gray-500">
                      {person.books.length} {person.books.length === 1 ? 'book' : 'books'}
                    </span>
                    {person.cutter_numbers.length > 0 && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span className="text-xs font-mono text-gray-500">
                          Cutter{person.cutter_numbers.length > 1 ? 's' : ''}: {person.cutter_numbers.join(', ')}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <Link
              href="/books/authors"
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors inline-flex items-center"
            >
              <i className="fas fa-arrow-left mr-2"></i>
              All Authors
            </Link>
          </div>
        </div>
      </div>

      {/* Books Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
              <i className="fas fa-book text-blue-600 text-xs"></i>
            </div>
            Books
            <span className="text-xs font-normal text-gray-500 ml-1">
              ({sortedBooks.length} {sortedBooks.length === 1 ? 'title' : 'titles'})
            </span>
          </h2>
        </div>
        {sortedBooks.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            <i className="fas fa-inbox text-3xl mb-3 text-gray-300"></i>
            <p className="text-sm">No books found for this author.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => toggleSort('title')}
                  >
                    <div className="flex items-center gap-1">
                      Title
                      {sortField === 'title' && (
                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'} text-blue-600`}></i>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Role
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => toggleSort('call_number')}
                  >
                    <div className="flex items-center gap-1">
                      Call #
                      {sortField === 'call_number' && (
                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'} text-blue-600`}></i>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Classification
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Category
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => toggleSort('year')}
                  >
                    <div className="flex items-center gap-1">
                      Year
                      {sortField === 'year' && (
                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'} text-blue-600`}></i>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedBooks.map((book) => (
                  <tr key={book.book_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <Link
                        href={`/books/${book.book_id}/view`}
                        className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
                      >
                        {book.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        book.role === 'Author'
                          ? 'bg-blue-100 text-blue-800'
                          : book.role === 'Editor'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-purple-100 text-purple-800'
                      }`}>
                        {book.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-900">
                      {book.call_number || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-900">
                      {book.classification?.code || '—'}
                      {book.classification?.name && (
                        <span className="font-sans text-gray-400 ml-1">— {book.classification.name}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {book.category?.name || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {book.year_published || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageLayout>
  )
}
