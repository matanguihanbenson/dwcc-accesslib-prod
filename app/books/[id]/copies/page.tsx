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
  const [showEditModal, setShowEditModal] = useState(false)
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [showBulkEditModal, setShowBulkEditModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
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
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-5"
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
                    className="bg-blue-600 hover:bg-blue-700 text-sm px-4 py-5 text-white"
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
                                setShowEditModal(true)
                              }}
                              className="inline-flex items-center justify-center w-9 h-9 text-blue-600 bg-blue-100 hover:bg-blue-50 rounded-md transition-colors"
                              title="Edit Copy"
                            >
                              <i className="fas fa-pen-to-square"></i>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedCopy(copy)
                                setShowHistoryModal(true)
                              }}
                              className="inline-flex items-center justify-center w-9 h-9 bg-purple-100 text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                              title="View Borrowing History"
                            >
                              <i className="fas fa-clock-rotate-left"></i>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedCopy(copy)
                                setShowArchiveModal(true)
                              }}
                              className="inline-flex items-center justify-center w-9 h-9 bg-red-100 text-red-600 hover:bg-red-50 rounded-md transition-colors"
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

      {/* Edit Copy Modal */}
      {showEditModal && selectedCopy && (
        <EditCopyModal
          copy={selectedCopy}
          bookId={bookId}
          onClose={() => {
            setShowEditModal(false)
            setSelectedCopy(null)
          }}
          onSave={() => {
            setShowEditModal(false)
            setSelectedCopy(null)
            fetchBookAndCopies()
          }}
        />
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
                className='px-4 py-5 bg-gray-200'
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleArchiveCopy(selectedCopy.copy_id)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-5"
              >
                <i className="fas fa-archive mr-2"></i>
                Archive Copy
              </Button>
            </div>
          </div>
        </div>
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

      {/* Borrowing history modal — every transaction tied
          to one physical copy, paginated 10 per page,
          most-recent-first. Opened from the new history
          action in the copies table. */}
      {showHistoryModal && selectedCopy && (
        <BorrowingHistoryModal
          bookId={bookId}
          copy={selectedCopy}
          onClose={() => {
            setShowHistoryModal(false)
            setSelectedCopy(null)
          }}
        />
      )}
    </>
  )
}

// ============================================================
// Location edit modal (single copy)
// ============================================================
function EditCopyModal({
  copy,
  bookId,
  onClose,
  onSave
}: {
  copy: BookCopy
  bookId: number
  onClose: () => void
  onSave: () => void
}) {
  const [accessionNumber, setAccessionNumber] = useState(copy.accession_number)
  const [status, setStatus] = useState(copy.status)
  const [condition, setCondition] = useState(copy.condition)
  const [location, setLocation] = useState(copy.location || '')
  const [acquisitionDate, setAcquisitionDate] = useState(
    copy.acquisition_date ? copy.acquisition_date.split('T')[0] : ''
  )
  const [saving, setSaving] = useState(false)

  // Accession number real-time checking
  const [accessionCheck, setAccessionCheck] = useState<{
    checking: boolean
    exists: boolean
    message: string
  }>({ checking: false, exists: false, message: '' })

  useEffect(() => {
    const trimmed = accessionNumber.trim().toUpperCase()
    if (!trimmed || trimmed === copy.accession_number) {
      setAccessionCheck({ checking: false, exists: false, message: '' })
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setAccessionCheck(prev => ({ ...prev, checking: true }))
      try {
        const res = await fetch(
          `/api/books/${bookId}/copies/check-accession?accession_number=${encodeURIComponent(trimmed)}`,
          { credentials: 'include', signal: controller.signal }
        )
        if (res.ok) {
          const data = await res.json()
          setAccessionCheck({
            checking: false,
            exists: data.data.exists,
            message: data.data.exists
              ? `Accession number "${trimmed}" is already in use`
              : ''
          })
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          setAccessionCheck({ checking: false, exists: false, message: '' })
        }
      }
    }, 400)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [accessionNumber, copy.accession_number, bookId])

  const isBorrowed = copy.status === 'BORROWED'
  const hasChanges =
    accessionNumber.trim().toUpperCase() !== copy.accession_number ||
    status !== copy.status ||
    condition !== copy.condition ||
    location.trim() !== (copy.location || '') ||
    acquisitionDate !== (copy.acquisition_date ? copy.acquisition_date.split('T')[0] : '')

  const canSave = hasChanges && !accessionCheck.exists && !accessionCheck.checking && !saving

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const body: any = {}
      const trimmedAN = accessionNumber.trim().toUpperCase()
      if (trimmedAN !== copy.accession_number) body.accession_number = trimmedAN
      if (status !== copy.status) body.status = status
      if (condition !== copy.condition) body.condition = condition
      if (location.trim() !== (copy.location || '')) body.location = location.trim()
      const origDate = copy.acquisition_date ? copy.acquisition_date.split('T')[0] : ''
      if (acquisitionDate !== origDate) {
        body.acquisition_date = acquisitionDate || null
      }

      if (Object.keys(body).length === 0) {
        onClose()
        return
      }

      const res = await fetch(`/api/books/${bookId}/copies/${copy.copy_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      })

      if (res.ok) {
        await notify.success('Success', 'Copy updated')
        onSave()
      } else {
        const err = await res.json()
        await notify.error('Error', err.error || 'Failed to update copy')
      }
    } catch {
      await notify.error('Error', 'Network error occurred')
    } finally {
      setSaving(false)
    }
  }

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
            <h2 className="text-lg font-semibold text-gray-900">Edit Copy</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Close">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Accession Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Accession Number</label>
            <div className="relative">
              <Input
                value={accessionNumber}
                onChange={(e) => setAccessionNumber(e.target.value.toUpperCase())}
                placeholder="e.g., 2024-0001"
                maxLength={20}
                className={
                  accessionCheck.exists
                    ? 'border-red-500 focus:ring-red-500'
                    : accessionNumber.trim().toUpperCase() !== copy.accession_number && !accessionCheck.exists && !accessionCheck.checking
                      ? 'border-green-500 focus:ring-green-500'
                      : ''
                }
              />
              {accessionCheck.checking && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <i className="fas fa-spinner fa-spin text-gray-400"></i>
                </div>
              )}
              {!accessionCheck.checking && accessionNumber.trim().toUpperCase() !== copy.accession_number && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {accessionCheck.exists ? (
                    <i className="fas fa-times-circle text-red-500"></i>
                  ) : (
                    <i className="fas fa-check-circle text-green-500"></i>
                  )}
                </div>
              )}
            </div>
            {accessionCheck.message && (
              <p className="text-xs text-red-600 mt-1">{accessionCheck.message}</p>
            )}
          </div>

          {/* Status & Condition row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BookCopy['status'])}
                disabled={isBorrowed}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="AVAILABLE">Available</option>
                <option value="BORROWED">Borrowed</option>
                <option value="LOST">Lost</option>
                <option value="DAMAGED">Damaged</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
              {isBorrowed && (
                <p className="text-xs text-amber-600 mt-1">
                  <i className="fas fa-info-circle mr-1"></i>
                  Return the book first to change status.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as BookCopy['condition'])}
                disabled={isBorrowed}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="EXCELLENT">Excellent</option>
                <option value="GOOD">Good</option>
                <option value="FAIR">Fair</option>
                <option value="POOR">Poor</option>
                <option value="DAMAGED">Damaged</option>
                <option value="MISSING">Missing</option>
              </select>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Shelf A-5"
              maxLength={120}
            />
            <p className="text-xs text-gray-500 mt-1">Leave blank to clear.</p>
          </div>

          {/* Acquisition Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Acquisition Date</label>
            <input
              type="date"
              value={acquisitionDate}
              onChange={(e) => setAcquisitionDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Leave blank if unknown.</p>
          </div>
        </div>

        <div className="px-5 py-4 border-t bg-gray-50 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="bg-gray-200 px-4 py-5">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="bg-blue-600 text-white px-4 py-5 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <><i className="fas fa-spinner fa-spin mr-2"></i>Saving...</>
            ) : (
              <><i className="fas fa-save mr-2"></i>Save Changes</>
            )}
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
          <Button variant="outline" onClick={onClose} className='bg-gray-200 px-4 py-5'>
            Cancel
          </Button>
          {op === 'status' && (
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-5"
              onClick={() => onStatus(newStatus)}
              disabled={!newStatus}
            >
              <i className="fas fa-check mr-1.5"></i>
              Apply to {count}
            </Button>
          )}
          {op === 'location' && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-5"
              onClick={() => onLocation(clearingLocation ? '' : newLocation)}
              disabled={!clearingLocation && !newLocation.trim()}
            >
              <i className="fas fa-check mr-1.5"></i>
              Apply to {count}
            </Button>
          )}
          {op === 'archive' && (
            <Button
              className="bg-red-600 text-white px-4 py-5 hover:bg-red-700"
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

// ============================================================
// Borrowing history modal (per-copy)
// ============================================================
//
// Shows every `bookTransaction` row tied to a single physical
// copy, paginated 10 per page, ordered most-recent-first. The
// modal owns its own fetch + pagination state so opening it
// for a different copy (e.g. via the previous "next" /
// "previous" arrows if they were ever added) starts from a
// clean page 1.
interface BorrowHistoryTransaction {
  transaction_id: number
  borrow_date: string | null
  return_date: string | null
  due_date: string | null
  status: string
  penalty: number | string
  user: {
    user_id: number
    full_name: string | null
    account_id: string
    user_type: string
  } | null
}

interface BorrowHistoryPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const STATUS_BADGE: Record<string, string> = {
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
  ACTIVE: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-800',
  REJECTED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
}

function BorrowingHistoryModal({
  bookId,
  copy,
  onClose
}: {
  bookId: number
  copy: BookCopy
  onClose: () => void
}) {
  const [page, setPage] = useState(1)
  const [transactions, setTransactions] = useState<BorrowHistoryTransaction[]>([])
  const [pagination, setPagination] = useState<BorrowHistoryPagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Refetch whenever the page changes. The modal resets `page`
  // back to 1 every time it opens (see the useEffect below),
  // so we don't need to depend on `copy` here — a re-open
  // triggers a fresh fetch on page 1.
  useEffect(() => {
    let cancelled = false
    const fetchHistory = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(
          `/api/books/${bookId}/copies/${copy.copy_id}?page=${page}&limit=10`,
          { credentials: 'include' }
        )
        if (cancelled) return
        if (!response.ok) {
          throw new Error(`Failed to load history (${response.status})`)
        }
        const body = await response.json()
        if (cancelled) return
        // `createSuccessResponse` wraps the payload under `data`,
        // so the pagination block sits at `body.data.pagination`.
        const data = body?.data || {}
        setTransactions(Array.isArray(data.transactions) ? data.transactions : [])
        setPagination(
          data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 }
        )
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load history')
          setTransactions([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchHistory()
    return () => {
      cancelled = true
    }
  }, [bookId, copy.copy_id, page])

  // Reset to page 1 every time the modal opens with a new copy,
  // so we never land on a stale page index that doesn't exist
  // for the freshly-loaded copy.
  useEffect(() => {
    setPage(1)
  }, [copy.copy_id])

  const formatDate = (value: string | null | undefined) => {
    if (!value) return '—'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatCurrency = (value: number | string | null | undefined) => {
    const n = Number(value || 0)
    return `₱${n.toFixed(2)}`
  }

  const startIndex = (pagination.page - 1) * pagination.limit
  const endIndex = Math.min(startIndex + pagination.limit, pagination.total)
  const showPagination = pagination.totalPages > 1

  // Compact page-number strip (1 ... 4 5 6 ... 10). Avoids the
  // wider Pagination component from /components/ui/pagination
  // because the modal header already has its own close button
  // and the row count line — a small inline control reads
  // better here.
  const pageNumbers = (() => {
    const pages: (number | '…')[] = []
    const total = pagination.totalPages
    const cur = pagination.page
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i)
      return pages
    }
    pages.push(1)
    if (cur > 4) pages.push('…')
    const start = Math.max(2, cur - 1)
    const end = Math.min(total - 1, cur + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    if (cur < total - 3) pages.push('…')
    pages.push(total)
    return pages
  })()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              <i className="fas fa-clock-rotate-left text-purple-600 mr-2"></i>
              Borrowing History
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Accession <span className="font-medium">{copy.accession_number}</span>
              {copy.location ? (
                <>
                  {' · '}
                  <span className="text-gray-500">{copy.location}</span>
                </>
              ) : null}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            title="Close"
          >
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-10 text-center text-sm text-gray-500">
              <i className="fas fa-spinner fa-spin mr-2 text-purple-600"></i>
              Loading borrowing history...
            </div>
          ) : error ? (
            <div className="p-10 text-center text-sm text-red-600">
              <i className="fas fa-exclamation-triangle mr-2"></i>
              {error}
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">
              <i className="fas fa-book text-3xl text-gray-300 mb-3"></i>
              <p>No borrowing history yet for this copy.</p>
              <p className="text-xs text-gray-400 mt-1">
                Once a borrower checks out this copy, their transaction will appear here.
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Borrower
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Borrowed
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Returned
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Penalty
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((tx) => (
                  <tr key={tx.transaction_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">
                        {tx.user?.full_name || 'Unknown borrower'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {tx.user?.account_id || '—'}
                        {tx.user?.user_type ? ` · ${tx.user.user_type}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDate(tx.borrow_date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDate(tx.due_date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDate(tx.return_date)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                          STATUS_BADGE[tx.status] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      {formatCurrency(tx.penalty)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-gray-600">
            {pagination.total > 0 ? (
              <>
                Showing <span className="font-medium">{startIndex + 1}</span>–
                <span className="font-medium">{endIndex}</span> of{' '}
                <span className="font-medium">{pagination.total}</span>{' '}
                {pagination.total === 1 ? 'transaction' : 'transactions'}
              </>
            ) : (
              'No transactions'
            )}
          </div>
          {showPagination && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page === 1}
                className="px-2 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous page"
              >
                <i className="fas fa-chevron-left"></i>
              </button>
              {pageNumbers.map((p, idx) =>
                p === '…' ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 text-gray-400 text-sm"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1 text-sm border rounded-md ${
                      pagination.page === p
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() =>
                  setPage((p) => Math.min(pagination.totalPages, p + 1))
                }
                disabled={pagination.page === pagination.totalPages}
                className="px-2 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next page"
              >
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}