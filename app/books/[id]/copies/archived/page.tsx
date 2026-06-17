'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notification'

interface BookCopy {
  copy_id: number
  accession_number: string
  barcode: string | null
  condition: 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED'
  status: 'AVAILABLE' | 'BORROWED' | 'LOST' | 'DAMAGED' | 'MAINTENANCE'
  location: string | null
  notes: string | null
  acquisition_date: string | null
  archived_at: string | null
  created_at: string
}

interface Book {
  book_id: number
  title: string
  isbn: string | null
  publisher: string | null
  year_published: number | null
  copies_total: number
  copies_available: number
  category: { name: string }
  authors: Array<{ name: string }>
}

export default function ArchivedCopiesPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params)
  const bookId = parseInt(resolvedParams.id)
  
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [book, setBook] = useState<Book | null>(null)
  const [archivedCopies, setArchivedCopies] = useState<BookCopy[]>([])
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)
  const userRole = (session?.user as any)?.role

  // Auth check
  useEffect(() => {
    if (status === 'loading') return

    if (status === 'authenticated' && session?.user) {
      const role = (session.user as any).role
      if (!['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(role)) {
        router.push('/dashboard')
        return
      }
      setAuthReady(true)
    } else {
      router.push('/login')
    }
  }, [session, status, router])

  useEffect(() => {
    if (authReady) {
      fetchData()
    }
  }, [bookId, authReady])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch book details
      const bookRes = await fetch(`/api/books/${bookId}`, {
        credentials: 'include'
      })
      if (bookRes.ok) {
        const bookData = await bookRes.json()
        setBook(bookData.data)
      }
      
      // Fetch archived copies
      const archivedRes = await fetch(`/api/books/${bookId}/copies/archived`, {
        credentials: 'include'
      })
      if (archivedRes.ok) {
        const archivedData = await archivedRes.json()
        setArchivedCopies(archivedData.data || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      await notify.error('Error', 'Failed to load archived copies')
    } finally {
      setLoading(false)
    }
  }

  const handleRestoreCopy = async (copyId: number) => {
    const confirmed = await notify.confirm(
      'Restore Copy',
      'Are you sure you want to restore this copy? It will be moved back to active copies.',
      { icon: 'warning' }
    )

    if (!confirmed) return

    try {
      const response = await fetch(`/api/books/${bookId}/copies/${copyId}/restore`, {
        method: 'PATCH',
        credentials: 'include'
      })
      
      if (response.ok) {
        await notify.success('Success', 'Copy restored successfully')
        fetchData()
      } else {
        const errorData = await response.json()
        await notify.error('Error', errorData.error || 'Failed to restore copy')
      }
    } catch (error) {
      await notify.error('Error', 'Network error occurred')
    }
  }

  const handlePermanentDelete = async (copyId: number) => {
    const confirmed = await notify.confirm(
      'Permanently Delete Copy',
      'This action cannot be undone. Are you sure you want to permanently delete this copy from the database?',
      { icon: 'warning' }
    )

    if (!confirmed) return

    try {
      const response = await fetch(`/api/books/${bookId}/copies/${copyId}/permanent`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      if (response.ok) {
        await notify.success('Success', 'Copy permanently deleted')
        fetchData()
      } else {
        const errorData = await response.json()
        await notify.error('Error', errorData.error || 'Failed to delete copy')
      }
    } catch (error) {
      await notify.error('Error', 'Network error occurred')
    }
  }

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
      case 'MAINTENANCE':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getConditionBadgeColor = (condition: string) => {
    switch (condition) {
      case 'GOOD':
        return 'bg-green-100 text-green-800'
      case 'FAIR':
        return 'bg-yellow-100 text-yellow-800'
      case 'POOR':
        return 'bg-orange-100 text-orange-800'
      case 'DAMAGED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (!authReady || loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <div className="text-sm text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!book) {
    return (
      <div className="p-8 text-center">
        <div className="text-gray-500">Book not found</div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/books/${bookId}/copies`)}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <i className="fas fa-arrow-left text-lg"></i>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Archived Copies</h1>
                <nav className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                  <Link href="/books" className="hover:text-gray-700">Books</Link>
                  <i className="fas fa-chevron-right text-xs"></i>
                  <Link href={`/books/${bookId}/copies`} className="hover:text-gray-700">{book.title}</Link>
                  <i className="fas fa-chevron-right text-xs"></i>
                  <span className="text-gray-900 font-medium">Archived</span>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4 space-y-6">
        {/* Book Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Book Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Title</p>
                <p className="font-semibold">{book.title}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Author(s)</p>
                <p className="font-semibold">
                  {book.authors?.map(a => a.name).join(', ') || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">ISBN</p>
                <p className="font-semibold">{book.isbn || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Archived Copies Table */}
        <Card>
          <CardHeader>
            <CardTitle>Archived Copies ({archivedCopies.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {archivedCopies.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No archived copies found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Accession Number</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Barcode</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Condition</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status (At Archive)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Archived Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {archivedCopies.map((copy) => (
                      <tr key={copy.copy_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {copy.accession_number}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {copy.barcode || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getConditionBadgeColor(copy.condition)}`}>
                            {copy.condition}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(copy.status)}`}>
                            {copy.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {copy.archived_at ? new Date(copy.archived_at).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex gap-2 items-center">
                            <button
                              onClick={() => handleRestoreCopy(copy.copy_id)}
                              className="text-green-600 hover:text-green-800 p-1"
                              title="Restore Copy"
                            >
                              <i className="fas fa-undo text-base"></i>
                            </button>
                            {userRole === 'SUPER_ADMIN' && (
                              <button
                                onClick={() => handlePermanentDelete(copy.copy_id)}
                                className="text-red-600 hover:text-red-800 p-1"
                                title="Permanently Delete"
                              >
                                <i className="fas fa-trash text-base"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
