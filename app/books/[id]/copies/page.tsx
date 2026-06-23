'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

export default function BookCopiesPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params)
  const bookId = parseInt(resolvedParams.id)
  
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [book, setBook] = useState<Book | null>(null)
  const [copies, setCopies] = useState<BookCopy[]>([])
  const [archivedCount, setArchivedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showInitializeModal, setShowInitializeModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showConditionModal, setShowConditionModal] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [showBulkEditModal, setShowBulkEditModal] = useState(false)
  const [selectedCopy, setSelectedCopy] = useState<BookCopy | null>(null)
  const [addingCopies, setAddingCopies] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Bulk selection state
  const [selectedCopyIds, setSelectedCopyIds] = useState<number[]>([])
  
  // Form state for adding copies
  const [numberOfCopies, setNumberOfCopies] = useState(1)
  const [condition, setCondition] = useState<'GOOD' | 'FAIR' | 'POOR'>('GOOD')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')

  // Auth check
  useEffect(() => {
    if (status === 'loading') return

    if (status === 'authenticated' && session?.user) {
      const userRole = (session.user as any).role
      if (!['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(userRole)) {
        router.push('/dashboard')
        return
      }
      setAuthReady(true)
    } else {
      router.push('/login')
    }
  }, [session, status, router])

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setShowAddModal(true)
    }
  }, [searchParams])

  useEffect(() => {
    if (authReady) {
      fetchBookAndCopies()
    }
  }, [bookId, authReady])

  const fetchBookAndCopies = async () => {
    try {
      setLoading(true)
      
      // Sync book copy counts first to ensure accuracy
      await fetch(`/api/books/${bookId}/copies/sync`, {
        method: 'POST',
        credentials: 'include'
      })
      
      // Fetch book details
      const bookRes = await fetch(`/api/books/${bookId}`, {
        credentials: 'include'
      })
      if (bookRes.ok) {
        const bookData = await bookRes.json()
        setBook(bookData.data)
      }
      
      // Fetch book copies
      const copiesRes = await fetch(`/api/books/${bookId}/copies`, {
        credentials: 'include'
      })
      if (copiesRes.ok) {
        const copiesData = await copiesRes.json()
        setCopies(copiesData.data)
      }
      
      // Fetch archived count
      const archivedRes = await fetch(`/api/books/${bookId}/copies/archived`, {
        credentials: 'include'
      })
      if (archivedRes.ok) {
        const archivedData = await archivedRes.json()
        setArchivedCount(archivedData.data?.length || 0)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      await notify.error('Error', 'Failed to load book copies')
    } finally {
      setLoading(false)
    }
  }

  const handleAddCopies = async () => {
    try {
      setAddingCopies(true)
      
      const response = await fetch(`/api/books/${bookId}/copies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          numberOfCopies,
          condition,
          location,
          notes
        })
      })
      
      if (response.ok) {
        await notify.success('Success', `Added ${numberOfCopies} cop${numberOfCopies > 1 ? 'ies' : 'y'} successfully`)
        setShowAddModal(false)
        setNumberOfCopies(1)
        setCondition('GOOD')
        setLocation('')
        setNotes('')
        fetchBookAndCopies()
      } else {
        const error = await response.json()
        await notify.error('Error', error.error || 'Failed to add copies')
      }
    } catch (error) {
      await notify.error('Error', 'Network error occurred')
    } finally {
      setAddingCopies(false)
    }
  }

  const handleInitializeExistingCopies = async () => {
    if (!book) return
    
    try {
      setAddingCopies(true)
      
      const response = await fetch(`/api/books/${bookId}/copies/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          numberOfCopies: book.copies_total,
          condition: 'GOOD'
        })
      })
      
      if (response.ok) {
        await notify.success('Success', `Initialized ${book.copies_total} existing cop${book.copies_total > 1 ? 'ies' : 'y'}`)
        setShowInitializeModal(false)
        fetchBookAndCopies()
      } else {
        const error = await response.json()
        await notify.error('Error', error.error || 'Failed to initialize copies')
      }
    } catch (error) {
      await notify.error('Error', 'Network error occurred')
    } finally {
      setAddingCopies(false)
    }
  }

  const handleUpdateCopyStatus = async (copyId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/books/${bookId}/copies/${copyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      })
      
      if (response.ok) {
        await notify.success('Success', 'Copy status updated')
        setShowStatusModal(false)
        setSelectedCopy(null)
        fetchBookAndCopies()
      } else {
        const errorData = await response.json()
        await notify.error('Error', errorData.error || 'Failed to update copy status')
      }
    } catch (error) {
      await notify.error('Error', 'Network error occurred')
    }
  }

  const handleArchiveCopy = async (copyId: number) => {
    try {
      const response = await fetch(`/api/books/${bookId}/copies/${copyId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      if (response.ok) {
        await notify.success('Success', 'Copy archived successfully')
        setShowArchiveModal(false)
        setSelectedCopy(null)
        fetchBookAndCopies()
      } else {
        const errorData = await response.json()
        await notify.error('Error', errorData.error || 'Failed to archive copy')
      }
    } catch (error) {
      await notify.error('Error', 'Network error occurred')
    }
  }

  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (selectedCopyIds.length === 0) {
      await notify.error('Error', 'No copies selected')
      return
    }

    try {
      const response = await fetch(`/api/books/${bookId}/copies/bulk-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          copyIds: selectedCopyIds,
          status: newStatus
        })
      })
      
      if (response.ok) {
        await notify.success('Success', `Updated status of ${selectedCopyIds.length} cop${selectedCopyIds.length > 1 ? 'ies' : 'y'}`)
        setSelectedCopyIds([])
        fetchBookAndCopies()
      } else {
        const errorData = await response.json()
        await notify.error('Error', errorData.error || 'Failed to update copies')
      }
    } catch (error) {
      await notify.error('Error', 'Network error occurred')
    }
  }

  const handleBulkLocationUpdate = async (newLocation: string) => {
    if (selectedCopyIds.length === 0) {
      await notify.error('Error', 'No copies selected')
      return
    }

    try {
      const response = await fetch(`/api/books/${bookId}/copies/bulk-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          copyIds: selectedCopyIds,
          location: newLocation
        })
      })
      
      if (response.ok) {
        await notify.success('Success', `Updated location of ${selectedCopyIds.length} cop${selectedCopyIds.length > 1 ? 'ies' : 'y'}`)
        setSelectedCopyIds([])
        fetchBookAndCopies()
      } else {
        const errorData = await response.json()
        await notify.error('Error', errorData.error || 'Failed to update copies')
      }
    } catch (error) {
      await notify.error('Error', 'Network error occurred')
    }
  }

  const handleBulkArchive = async () => {
    if (selectedCopyIds.length === 0) {
      await notify.error('Error', 'No copies selected')
      return
    }

    const confirmed = await notify.confirm(
      'Archive Copies',
      `Are you sure you want to archive ${selectedCopyIds.length} selected cop${selectedCopyIds.length > 1 ? 'ies' : 'y'}?`,
      { icon: 'warning' }
    )

    if (!confirmed) return

    try {
      // Use the bulk-update endpoint so the operation is
      // atomic and updates the book totals in one shot.
      const response = await fetch(`/api/books/${bookId}/copies/bulk-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          copyIds: selectedCopyIds,
          archive: true
        })
      })

      const data = response.ok ? await response.json() : null
      if (response.ok) {
        await notify.success('Success', `Archived ${data?.data?.updatedCount ?? selectedCopyIds.length} cop${selectedCopyIds.length > 1 ? 'ies' : 'y'}`)
        setSelectedCopyIds([])
        fetchBookAndCopies()
      } else {
        const errorData = data || {}
        await notify.error('Error', errorData.error || 'Failed to archive copies')
      }
    } catch (error) {
      await notify.error('Error', 'Network error occurred')
    }
  }

  // Update a single copy's location
  const handleUpdateCopyLocation = async (copyId: number, newLocation: string) => {
    try {
      const response = await fetch(`/api/books/${bookId}/copies/${copyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ location: newLocation })
      })
      
      if (response.ok) {
        await notify.success('Success', 'Location updated')
        setShowLocationModal(false)
        setSelectedCopy(null)
        fetchBookAndCopies()
      } else {
        const errorData = await response.json()
        await notify.error('Error', errorData.error || 'Failed to update location')
      }
    } catch (error) {
      await notify.error('Error', 'Network error occurred')
    }
  }

  const toggleSelectAll = () => {
    if (selectedCopyIds.length === copies.length) {
      setSelectedCopyIds([])
    } else {
      setSelectedCopyIds(copies.map(c => c.copy_id))
    }
  }

  const toggleSelectCopy = (copyId: number) => {
    if (selectedCopyIds.includes(copyId)) {
      setSelectedCopyIds(selectedCopyIds.filter(id => id !== copyId))
    } else {
      setSelectedCopyIds([...selectedCopyIds, copyId])
    }
  }

  const filteredCopies = copies.filter((copy) => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return true
    return (
      copy.accession_number.toLowerCase().includes(term) ||
      (copy.barcode || '').toLowerCase().includes(term) ||
      (copy.location || '').toLowerCase().includes(term) ||
      (copy.notes || '').toLowerCase().includes(term) ||
      copy.status.toLowerCase().includes(term) ||
      copy.condition.toLowerCase().includes(term)
    )
  })

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
                onClick={() => router.push('/books')}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <i className="fas fa-arrow-left text-lg"></i>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Manage Book Copies</h1>
                <nav className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                  <Link href="/books" className="hover:text-gray-700">Books</Link>
                  <i className="fas fa-chevron-right text-xs"></i>
                  <span className="text-gray-900 font-medium">{book.title}</span>
                </nav>
              </div>
            </div>
            <div className="flex gap-3">
              {archivedCount > 0 && (
                <Button
                  onClick={() => router.push(`/books/${bookId}/copies/archived`)}
                  className="bg-gray-600 hover:bg-gray-700"
                >
                  <i className="fas fa-archive mr-2"></i>
                  View Archived ({archivedCount})
                </Button>
              )}
              <Button
                onClick={() => setShowAddModal(true)}
                className="bg-primary-600 hover:bg-primary-700 text-white py-5 px-4"
              >
                <i className="fas fa-plus mr-2"></i>
                Add Stock
              </Button>
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
              <div>
                <p className="text-sm text-gray-600">Category</p>
                <p className="font-semibold">{book.category?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Copies</p>
                <p className="font-semibold text-blue-600">{book.copies_total}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Available Copies</p>
                <p className="font-semibold text-green-600">{book.copies_available}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Copies Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <CardTitle>Book Copies ({filteredCopies.length}/{copies.length})</CardTitle>
              <div className="w-full md:w-64">
                <Input
                  type="text"
                  placeholder="Search copies (accession, barcode, status, location...)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="py-2"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Bulk Action Toolbar — keep it tidy: a single
                "Bulk edit" button opens a modal with all the
                available operations instead of stacking
                every action inline. */}
            {selectedCopyIds.length > 0 && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                  <i className="fas fa-check-square text-blue-600"></i>
                  <span className="text-sm font-medium text-blue-900">
                    {selectedCopyIds.length} cop{selectedCopyIds.length > 1 ? 'ies' : 'y'} selected
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => setShowBulkEditModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-sm py-1.5"
                  >
                    <i className="fas fa-pen-to-square mr-1.5"></i>
                    Bulk edit ({selectedCopyIds.length})
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedCopyIds([])}
                    className="text-sm py-1.5"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={copies.length > 0 && selectedCopyIds.length === copies.length}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Accession Number</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Condition</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acquisition Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {copies.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center">
                        {book.copies_total > 0 ? (
                          <div className="space-y-3">
                            <p className="text-gray-600">
                              This book has {book.copies_total} cop{book.copies_total > 1 ? 'ies' : 'y'} but no individual copy records found.
                            </p>
                            <p className="text-sm text-gray-500">
                              This usually means the book was added before the copy tracking system was implemented.
                            </p>
                            <Button
                              onClick={() => setShowInitializeModal(true)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <i className="fas fa-sync mr-2"></i>
                              Initialize {book.copies_total} Cop{book.copies_total > 1 ? 'ies' : 'y'}
                            </Button>
                          </div>
                        ) : (
                          <div className="text-gray-500">
                            No copies found. Click &quot;Add Stock&quot; to add book copies.
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : filteredCopies.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        No copies match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredCopies.map((copy) => (
                      <tr key={copy.copy_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedCopyIds.includes(copy.copy_id)}
                            onChange={() => toggleSelectCopy(copy.copy_id)}
                            className="rounded border-gray-300"
                            disabled={copy.status === 'BORROWED'}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {copy.accession_number}
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
                          {copy.location || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {copy.acquisition_date ? new Date(copy.acquisition_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex gap-1 items-center">
                            <button
                              onClick={() => {
                                setSelectedCopy(copy)
                                setShowStatusModal(true)
                              }}
                              className="inline-flex items-center justify-center w-8 h-8 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="Update Status"
                              disabled={copy.status === 'BORROWED'}
                            >
                              <i className="fas fa-sync-alt"></i>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedCopy(copy)
                                setShowConditionModal(true)
                              }}
                              className="inline-flex items-center justify-center w-8 h-8 text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                              title="Update Condition"
                              disabled={copy.status === 'BORROWED'}
                            >
                              <i className="fas fa-star-half-alt"></i>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedCopy(copy)
                                setShowLocationModal(true)
                              }}
                              className="inline-flex items-center justify-center w-8 h-8 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                              title="Edit Location"
                            >
                              <i className="fas fa-map-marker-alt"></i>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedCopy(copy)
                                setShowArchiveModal(true)
                              }}
                              className="inline-flex items-center justify-center w-8 h-8 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Archive Copy"
                              disabled={copy.status === 'BORROWED'}
                            >
                              <i className="fas fa-archive"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Stock Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Book Stock</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Copies
                </label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={numberOfCopies}
                  onChange={(e) => setNumberOfCopies(parseInt(e.target.value) || 1)}
                />
                <p className="text-xs text-gray-500 mt-1">Accession numbers will be auto-generated</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Condition
                </label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair</option>
                  <option value="POOR">Poor</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location (Optional)
                </label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Shelf A-5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                  placeholder="Additional notes about these copies"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowAddModal(false)}
                disabled={addingCopies}
                className='px-4 py-5 bg-gray-200 hover:bg-gray-300'
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddCopies}
                disabled={addingCopies}
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-5"
              >
                {addingCopies ? 'Adding...' : `Add ${numberOfCopies} ${numberOfCopies > 1 ? 'Copies' : 'Copy'}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Initialize Copies Modal */}
      {showInitializeModal && book && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Initialize Existing Copies</h2>
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex items-start">
                  <i className="fas fa-exclamation-triangle text-yellow-600 mt-1 mr-3"></i>
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium mb-1">This will create {book.copies_total} individual copy records</p>
                    <p>Each copy will be assigned a unique accession number. This is a one-time setup for books added before the copy tracking system.</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-700">
                  <strong>Book:</strong> {book.title}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  <strong>Copies to initialize:</strong> {book.copies_total}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  <strong>Initial condition:</strong> Good
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  <strong>Initial status:</strong> Available
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowInitializeModal(false)}
                disabled={addingCopies}
              >
                Cancel
              </Button>
              <Button
                onClick={handleInitializeExistingCopies}
                disabled={addingCopies}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {addingCopies ? 'Initializing...' : 'Initialize Copies'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {showStatusModal && selectedCopy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Update Copy Status</h2>
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                <p className="text-sm text-gray-700">
                  <strong>Accession Number:</strong> {selectedCopy.accession_number}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  <strong>Current Status:</strong> <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusBadgeColor(selectedCopy.status)}`}>
                    {selectedCopy.status}
                  </span>
                </p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Select New Status:</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleUpdateCopyStatus(selectedCopy.copy_id, 'AVAILABLE')}
                    disabled={selectedCopy.status === 'BORROWED'}
                    className="flex items-center justify-center gap-2 p-4 border-2 border-green-300 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="fas fa-check-circle text-green-600 text-xl"></i>
                    <span className="font-medium text-green-800">Available</span>
                  </button>
                  
                  <button
                    onClick={() => handleUpdateCopyStatus(selectedCopy.copy_id, 'BORROWED')}
                    disabled={selectedCopy.status === 'BORROWED'}
                    className="flex items-center justify-center gap-2 p-4 border-2 border-blue-300 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="fas fa-book text-blue-600 text-xl"></i>
                    <span className="font-medium text-blue-800">Borrowed</span>
                  </button>
                  
                  <button
                    onClick={() => handleUpdateCopyStatus(selectedCopy.copy_id, 'LOST')}
                    disabled={selectedCopy.status === 'BORROWED'}
                    className="flex items-center justify-center gap-2 p-4 border-2 border-red-300 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="fas fa-times-circle text-red-600 text-xl"></i>
                    <span className="font-medium text-red-800">Lost</span>
                  </button>
                  
                  <button
                    onClick={() => handleUpdateCopyStatus(selectedCopy.copy_id, 'DAMAGED')}
                    disabled={selectedCopy.status === 'BORROWED'}
                    className="flex items-center justify-center gap-2 p-4 border-2 border-orange-300 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="fas fa-exclamation-triangle text-orange-600 text-xl"></i>
                    <span className="font-medium text-orange-800">Damaged</span>
                  </button>
                  
                  <button
                    onClick={() => handleUpdateCopyStatus(selectedCopy.copy_id, 'MAINTENANCE')}
                    disabled={selectedCopy.status === 'BORROWED'}
                    className="flex items-center justify-center gap-2 p-4 border-2 border-yellow-300 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed col-span-2"
                  >
                    <i className="fas fa-wrench text-yellow-600 text-xl"></i>
                    <span className="font-medium text-yellow-800">Maintenance</span>
                  </button>
                </div>
              </div>
              
              {selectedCopy.status === 'BORROWED' && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm text-blue-800">
                    <i className="fas fa-info-circle mr-2"></i>
                    Cannot change status of borrowed copy. Please return the book first.
                  </p>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowStatusModal(false)
                  setSelectedCopy(null)
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Condition Update Modal */}
      {showConditionModal && selectedCopy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Update Copy Condition</h2>
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                <p className="text-sm text-gray-700">
                  <strong>Accession Number:</strong> {selectedCopy.accession_number}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  <strong>Current Condition:</strong> <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getConditionBadgeColor(selectedCopy.condition)}`}>
                    {selectedCopy.condition}
                  </span>
                </p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Select New Condition:</p>
                <div className="space-y-2">
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch(`/api/books/${bookId}/copies/${selectedCopy.copy_id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ condition: 'GOOD' })
                        })
                        
                        if (response.ok) {
                          await notify.success('Success', 'Condition updated to Good')
                          setShowConditionModal(false)
                          setSelectedCopy(null)
                          fetchBookAndCopies()
                        } else {
                          const errorData = await response.json()
                          await notify.error('Error', errorData.error || 'Failed to update condition')
                        }
                      } catch (error) {
                        await notify.error('Error', 'Network error occurred')
                      }
                    }}
                    disabled={selectedCopy.status === 'BORROWED'}
                    className="w-full flex items-center justify-between p-3 border-2 border-green-300 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="flex items-center gap-2">
                      <i className="fas fa-check-circle text-green-600"></i>
                      <span className="font-medium text-green-800">Good</span>
                    </span>
                    <span className="text-xs text-green-700">Excellent condition, fully functional</span>
                  </button>
                  
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch(`/api/books/${bookId}/copies/${selectedCopy.copy_id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ condition: 'FAIR' })
                        })
                        
                        if (response.ok) {
                          await notify.success('Success', 'Condition updated to Fair')
                          setShowConditionModal(false)
                          setSelectedCopy(null)
                          fetchBookAndCopies()
                        } else {
                          const errorData = await response.json()
                          await notify.error('Error', errorData.error || 'Failed to update condition')
                        }
                      } catch (error) {
                        await notify.error('Error', 'Network error occurred')
                      }
                    }}
                    disabled={selectedCopy.status === 'BORROWED'}
                    className="w-full flex items-center justify-between p-3 border-2 border-yellow-300 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="flex items-center gap-2">
                      <i className="fas fa-exclamation-circle text-yellow-600"></i>
                      <span className="font-medium text-yellow-800">Fair</span>
                    </span>
                    <span className="text-xs text-yellow-700">Shows wear, still usable</span>
                  </button>
                  
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch(`/api/books/${bookId}/copies/${selectedCopy.copy_id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ condition: 'POOR' })
                        })
                        
                        if (response.ok) {
                          await notify.success('Success', 'Condition updated to Poor')
                          setShowConditionModal(false)
                          setSelectedCopy(null)
                          fetchBookAndCopies()
                        } else {
                          const errorData = await response.json()
                          await notify.error('Error', errorData.error || 'Failed to update condition')
                        }
                      } catch (error) {
                        await notify.error('Error', 'Network error occurred')
                      }
                    }}
                    disabled={selectedCopy.status === 'BORROWED'}
                    className="w-full flex items-center justify-between p-3 border-2 border-orange-300 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="flex items-center gap-2">
                      <i className="fas fa-times-circle text-orange-600"></i>
                      <span className="font-medium text-orange-800">Poor</span>
                    </span>
                    <span className="text-xs text-orange-700">Heavily worn, needs attention</span>
                  </button>
                  
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch(`/api/books/${bookId}/copies/${selectedCopy.copy_id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ condition: 'DAMAGED' })
                        })
                        
                        if (response.ok) {
                          await notify.success('Success', 'Condition updated to Damaged')
                          setShowConditionModal(false)
                          setSelectedCopy(null)
                          fetchBookAndCopies()
                        } else {
                          const errorData = await response.json()
                          await notify.error('Error', errorData.error || 'Failed to update condition')
                        }
                      } catch (error) {
                        await notify.error('Error', 'Network error occurred')
                      }
                    }}
                    disabled={selectedCopy.status === 'BORROWED'}
                    className="w-full flex items-center justify-between p-3 border-2 border-red-300 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="flex items-center gap-2">
                      <i className="fas fa-ban text-red-600"></i>
                      <span className="font-medium text-red-800">Damaged</span>
                    </span>
                    <span className="text-xs text-red-700">Not usable, requires repair</span>
                  </button>
                </div>
              </div>
              
              {selectedCopy.status === 'BORROWED' && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm text-blue-800">
                    <i className="fas fa-info-circle mr-2"></i>
                    Cannot change condition of borrowed copy.
                  </p>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowConditionModal(false)
                  setSelectedCopy(null)
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveModal && selectedCopy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Archive Copy</h2>
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex items-start">
                  <i className="fas fa-exclamation-triangle text-red-600 mt-1 mr-3"></i>
                  <div className="text-sm text-red-800">
                    <p className="font-medium mb-1">Are you sure you want to archive this copy?</p>
                    <p>Archived copies can be restored from the archived view.</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                <p className="text-sm text-gray-700">
                  <strong>Accession Number:</strong> {selectedCopy.accession_number}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  <strong>Status:</strong> {selectedCopy.status}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  <strong>Condition:</strong> {selectedCopy.condition}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowArchiveModal(false)
                  setSelectedCopy(null)
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleArchiveCopy(selectedCopy.copy_id)}
                className="bg-red-600 hover:bg-red-700"
              >
                <i className="fas fa-archive mr-2"></i>
                Archive Copy
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Location Modal (single copy) */}
      {showLocationModal && selectedCopy && (
        <LocationEditModal
          copy={selectedCopy}
          onClose={() => {
            setShowLocationModal(false)
            setSelectedCopy(null)
          }}
          onSave={(value) => handleUpdateCopyLocation(selectedCopy.copy_id, value)}
        />
      )}

      {/* Bulk Edit Modal — one place to choose status,
          location, or archive for the selected copies. */}
      {showBulkEditModal && (
        <BulkEditModal
          count={selectedCopyIds.length}
          copies={copies.filter((c) => selectedCopyIds.includes(c.copy_id))}
          onClose={() => setShowBulkEditModal(false)}
          onStatus={(newStatus) => {
            setShowBulkEditModal(false)
            handleBulkStatusUpdate(newStatus)
          }}
          onLocation={(newLocation) => {
            setShowBulkEditModal(false)
            handleBulkLocationUpdate(newLocation)
          }}
          onArchive={() => {
            setShowBulkEditModal(false)
            handleBulkArchive()
          }}
        />
      )}
    </>
  )
}

// ============================================================
// Location edit modal (single copy)
// ============================================================
function LocationEditModal({
  copy,
  onClose,
  onSave
}: {
  copy: BookCopy
  onClose: () => void
  onSave: (value: string) => void
}) {
  const [value, setValue] = useState(copy.location || '')

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fas fa-map-marker-alt text-emerald-600"></i>
            <h2 className="text-lg font-semibold text-gray-900">
              Edit Location
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
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-sm">
            <p className="text-gray-700">
              <strong>Accession #:</strong> {copy.accession_number}
            </p>
            <p className="text-gray-500 text-xs mt-1">
              Current: {copy.location || '— no location set —'}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              New location
            </label>
            <Input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g., Shelf A-5"
              maxLength={120}
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Leave blank to clear the location.
            </p>
          </div>
        </div>

        <div className="px-5 py-3 border-t bg-gray-50 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => onSave(value.trim())}
          >
            <i className="fas fa-save mr-1.5"></i>
            Save Location
          </Button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Bulk Edit Modal — a single, tidy place to perform any of
// the three bulk operations. Replaces the old toolbar that
// stacked status / location / archive buttons inline.
// ============================================================
type BulkOp = 'status' | 'location' | 'archive'

function BulkEditModal({
  count,
  copies,
  onClose,
  onStatus,
  onLocation,
  onArchive
}: {
  count: number
  copies: BookCopy[]
  onClose: () => void
  onStatus: (newStatus: string) => void
  onLocation: (newLocation: string) => void
  onArchive: () => void
}) {
  const [op, setOp] = useState<BulkOp>('status')
  const [newStatus, setNewStatus] = useState('AVAILABLE')
  const [newLocation, setNewLocation] = useState('')
  const [clearingLocation, setClearingLocation] = useState(false)

  const hasBorrowed = copies.some((c) => c.status === 'BORROWED')
  const uniqueLocations = Array.from(
    new Set(
      copies
        .map((c) => c.location || '')
        .filter((l) => l.length > 0)
    )
  )

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fas fa-pen-to-square text-blue-600"></i>
            <h2 className="text-lg font-semibold text-gray-900">
              Bulk edit {count} cop{count > 1 ? 'ies' : 'y'}
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

        <div className="p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-800">
            <i className="fas fa-info-circle mr-1.5"></i>
            Choose <strong>one</strong> operation, then click Apply. Each
            operation runs in a single transaction.
          </div>

          {/* Operation picker */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <OpButton
              active={op === 'status'}
              icon="fa-sync-alt"
              color="blue"
              label="Status"
              sublabel="Mark as Available / Lost / etc."
              onClick={() => setOp('status')}
            />
            <OpButton
              active={op === 'location'}
              icon="fa-map-marker-alt"
              color="emerald"
              label="Location"
              sublabel="Re-shelve or clear"
              onClick={() => setOp('location')}
            />
            <OpButton
              active={op === 'archive'}
              icon="fa-archive"
              color="red"
              label="Archive"
              sublabel="Soft-delete selected"
              onClick={() => setOp('archive')}
              disabled={hasBorrowed}
              disabledReason={hasBorrowed ? 'Contains borrowed copies' : undefined}
            />
          </div>

          {/* Operation body */}
          {op === 'status' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                New status
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="AVAILABLE">Available</option>
                <option value="LOST">Lost</option>
                <option value="DAMAGED">Damaged</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
              {hasBorrowed && (
                <p className="text-xs text-amber-700">
                  <i className="fas fa-exclamation-triangle mr-1"></i>
                  Borrowed copies in the selection will be skipped automatically.
                </p>
              )}
            </div>
          )}

          {op === 'location' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                New location
              </label>
              <Input
                value={clearingLocation ? '' : newLocation}
                onChange={(e) => {
                  setClearingLocation(false)
                  setNewLocation(e.target.value)
                }}
                placeholder="e.g., Shelf A-5"
                maxLength={120}
                disabled={clearingLocation}
              />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={clearingLocation}
                  onChange={(e) => {
                    setClearingLocation(e.target.checked)
                    if (e.target.checked) setNewLocation('')
                  }}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                Clear existing location
              </label>
              {uniqueLocations.length > 0 && (
                <p className="text-[11px] text-gray-500">
                  Current locations in selection:{' '}
                  {uniqueLocations.slice(0, 4).join(' · ')}
                  {uniqueLocations.length > 4 && '…'}
                </p>
              )}
            </div>
          )}

          {op === 'archive' && (
            <div className="space-y-2">
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
                <i className="fas fa-exclamation-triangle mr-1.5"></i>
                Archiving removes the copies from the active list. They
                can be restored from the Archived Copies view.
              </div>
              {hasBorrowed && (
                <p className="text-xs text-amber-700">
                  <i className="fas fa-exclamation-triangle mr-1"></i>
                  Borrowed copies will be skipped automatically.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t bg-gray-50 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {op === 'status' && (
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => onStatus(newStatus)}
              disabled={!newStatus}
            >
              <i className="fas fa-check mr-1.5"></i>
              Apply to {count}
            </Button>
          )}
          {op === 'location' && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => onLocation(clearingLocation ? '' : newLocation)}
              disabled={!clearingLocation && !newLocation.trim()}
            >
              <i className="fas fa-check mr-1.5"></i>
              Apply to {count}
            </Button>
          )}
          {op === 'archive' && (
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={onArchive}
            >
              <i className="fas fa-archive mr-1.5"></i>
              Archive {count}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function OpButton({
  active,
  icon,
  color,
  label,
  sublabel,
  onClick,
  disabled,
  disabledReason
}: {
  active: boolean
  icon: string
  color: 'blue' | 'emerald' | 'red'
  label: string
  sublabel: string
  onClick: () => void
  disabled?: boolean
  disabledReason?: string
}) {
  const colorMap: Record<string, { ring: string; bg: string; text: string; border: string }> = {
    blue: {
      ring: 'ring-blue-500',
      bg: 'bg-blue-50',
      text: 'text-blue-800',
      border: 'border-blue-500'
    },
    emerald: {
      ring: 'ring-emerald-500',
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-500'
    },
    red: {
      ring: 'ring-red-500',
      bg: 'bg-red-50',
      text: 'text-red-800',
      border: 'border-red-500'
    }
  }
  const c = colorMap[color]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      className={`flex flex-col items-start text-left p-3 rounded-lg border-2 transition-colors ${
        active
          ? `${c.border} ${c.bg}`
          : 'border-gray-200 hover:border-gray-300 bg-white'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className={`flex items-center gap-2 font-semibold text-sm ${active ? c.text : 'text-gray-700'}`}>
        <i className={`fas ${icon}`}></i>
        {label}
      </span>
      <span className="text-[11px] text-gray-500 mt-0.5 leading-tight">
        {sublabel}
      </span>
    </button>
  )
}
