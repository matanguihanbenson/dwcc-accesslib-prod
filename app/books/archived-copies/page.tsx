'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { notify } from '@/lib/notification'

interface BookCopy {
  copy_id: number
  book_id: number
  accession_number: string
  barcode: string | null
  condition: 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED'
  status: 'AVAILABLE' | 'BORROWED' | 'LOST' | 'DAMAGED' | 'MAINTENANCE'
  location: string | null
  notes: string | null
  acquisition_date: string | null
  archived_at: string | null
  created_at: string
  book?: {
    book_id: number
    title: string
    book_author: string
    isbn: string | null
    category: { name: string } | null
  }
}

export default function AllArchivedCopiesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [archivedCopies, setArchivedCopies] = useState<BookCopy[]>([])
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [conditionFilter, setConditionFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCopies, setSelectedCopies] = useState<number[]>([])
  const userRole = (session?.user as any)?.role

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
    if (authReady) {
      fetchArchivedCopies()
    }
  }, [authReady])

  const fetchArchivedCopies = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/books/copies/archived/all', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setArchivedCopies(data.data || [])
        
        // Extract unique categories
        const uniqueCategories = Array.from(new Set(
          (data.data || [])
            .filter((copy: BookCopy) => copy.book?.category?.name)
            .map((copy: BookCopy) => copy.book!.category!.name)
        )) as string[]
        setCategories(uniqueCategories)
      } else {
        await notify.error('Error', 'Failed to fetch archived copies')
      }
    } catch (error) {
      console.error('Error fetching archived copies:', error)
      await notify.error('Error', 'Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async (copyId: number) => {
    try {
      const copy = archivedCopies.find(c => c.copy_id === copyId)
      if (!copy) return

      const response = await fetch(`/api/books/${copy.book_id}/copies/${copyId}/restore`, {
        method: 'POST',
        credentials: 'include'
      })
      
      if (response.ok) {
        await notify.success('Success', 'Copy restored successfully')
        fetchArchivedCopies()
      } else {
        const errorData = await response.json()
        await notify.error('Error', errorData.error || 'Failed to restore copy')
      }
    } catch (error) {
      await notify.error('Error', 'Network error occurred')
    }
  }

  const handleBulkRestore = async () => {
    if (selectedCopies.length === 0) {
      await notify.error('Error', 'No copies selected')
      return
    }

    try {
      const promises = selectedCopies.map(copyId => {
        const copy = archivedCopies.find(c => c.copy_id === copyId)
        if (!copy) return Promise.resolve()
        
        return fetch(`/api/books/${copy.book_id}/copies/${copyId}/restore`, {
          method: 'POST',
          credentials: 'include'
        })
      })

      await Promise.all(promises)
      await notify.success('Success', `Restored ${selectedCopies.length} cop${selectedCopies.length > 1 ? 'ies' : 'y'}`)
      setSelectedCopies([])
      fetchArchivedCopies()
    } catch (error) {
      await notify.error('Error', 'Failed to restore some copies')
    }
  }

  const handlePermanentDelete = async (copyId: number) => {
    const confirmed = await notify.confirm(
      'Permanent Delete',
      'Are you sure? This action cannot be undone!',
      'warning'
    )

    if (!confirmed) return

    try {
      const copy = archivedCopies.find(c => c.copy_id === copyId)
      if (!copy) return

      const response = await fetch(`/api/books/${copy.book_id}/copies/${copyId}/permanent`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      if (response.ok) {
        await notify.success('Success', 'Copy permanently deleted')
        fetchArchivedCopies()
      } else {
        const errorData = await response.json()
        await notify.error('Error', errorData.error || 'Failed to delete copy')
      }
    } catch (error) {
      await notify.error('Error', 'Network error occurred')
    }
  }

  const toggleSelectAll = () => {
    if (selectedCopies.length === filteredCopies.length) {
      setSelectedCopies([])
    } else {
      setSelectedCopies(filteredCopies.map(c => c.copy_id))
    }
  }

  const toggleSelectCopy = (copyId: number) => {
    setSelectedCopies(prev => 
      prev.includes(copyId) 
        ? prev.filter(id => id !== copyId)
        : [...prev, copyId]
    )
  }

  const getConditionBadgeColor = (condition: string) => {
    switch (condition) {
      case 'GOOD': return 'bg-green-100 text-green-800'
      case 'FAIR': return 'bg-yellow-100 text-yellow-800'
      case 'POOR': return 'bg-orange-100 text-orange-800'
      case 'DAMAGED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-green-100 text-green-800'
      case 'BORROWED': return 'bg-blue-100 text-blue-800'
      case 'LOST': return 'bg-red-100 text-red-800'
      case 'DAMAGED': return 'bg-orange-100 text-orange-800'
      case 'MAINTENANCE': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredCopies = archivedCopies.filter(copy => {
    const matchesSearch = !searchTerm || 
      copy.accession_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      copy.book?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      copy.book?.book_author.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = !statusFilter || copy.status === statusFilter
    const matchesCondition = !conditionFilter || copy.condition === conditionFilter
    const matchesCategory = !categoryFilter || copy.book?.category?.name === categoryFilter

    return matchesSearch && matchesStatus && matchesCondition && matchesCategory
  })

  if (loading || !authReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
          <p className="text-gray-600">Loading archived copies...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <i className="fas fa-arrow-left text-lg"></i>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Archived Book Copies</h1>
                <nav className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                  <Link href="/books" className="hover:text-gray-700">Books</Link>
                  <i className="fas fa-chevron-right text-xs"></i>
                  <span className="text-gray-900 font-medium">Archived Copies</span>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4 space-y-6">
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Search & Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search
                </label>
                <Input
                  type="text"
                  placeholder="Accession, title, author..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">All Status</option>
                  <option value="AVAILABLE">Available</option>
                  <option value="LOST">Lost</option>
                  <option value="DAMAGED">Damaged</option>
                  <option value="MAINTENANCE">Maintenance</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Condition
                </label>
                <select
                  value={conditionFilter}
                  onChange={(e) => setConditionFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">All Conditions</option>
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair</option>
                  <option value="POOR">Poor</option>
                  <option value="DAMAGED">Damaged</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
            {(searchTerm || statusFilter || conditionFilter || categoryFilter) && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('')
                    setStatusFilter('')
                    setConditionFilter('')
                    setCategoryFilter('')
                  }}
                  className="text-sm"
                >
                  <i className="fas fa-times mr-2"></i>
                  Clear Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Copies List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Archived Copies ({filteredCopies.length}/{archivedCopies.length})
              </CardTitle>
              {selectedCopies.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    onClick={handleBulkRestore}
                    className="bg-green-600 hover:bg-green-700 text-sm"
                  >
                    <i className="fas fa-undo mr-2"></i>
                    Restore Selected ({selectedCopies.length})
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedCopies([])}
                    className="text-sm"
                  >
                    Clear Selection
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filteredCopies.length === 0 ? (
              <div className="text-center py-12">
                <i className="fas fa-archive text-5xl text-gray-300 mb-4"></i>
                <h3 className="text-xl font-medium text-gray-900 mb-2">
                  {archivedCopies.length === 0 ? 'No archived copies' : 'No copies match your filters'}
                </h3>
                <p className="text-gray-600">
                  {archivedCopies.length === 0 
                    ? 'Archived book copies will appear here'
                    : 'Try adjusting your search or filters'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={filteredCopies.length > 0 && selectedCopies.length === filteredCopies.length}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Accession Number</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Book Title</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Author</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Condition</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Archived Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCopies.map((copy) => (
                      <tr key={copy.copy_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedCopies.includes(copy.copy_id)}
                            onChange={() => toggleSelectCopy(copy.copy_id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {copy.accession_number}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <Link 
                            href={`/books/${copy.book_id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {copy.book?.title || '—'}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {copy.book?.book_author || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                            {copy.book?.category?.name || '—'}
                          </span>
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
                          {copy.archived_at ? new Date(copy.archived_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex gap-1 items-center">
                            <button
                              onClick={() => handleRestore(copy.copy_id)}
                              className="inline-flex items-center justify-center w-8 h-8 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                              title="Restore Copy"
                            >
                              <i className="fas fa-undo"></i>
                            </button>
                            {userRole === 'SUPER_ADMIN' && (
                              <button
                                onClick={() => handlePermanentDelete(copy.copy_id)}
                                className="inline-flex items-center justify-center w-8 h-8 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="Permanently Delete"
                              >
                                <i className="fas fa-trash"></i>
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
    </div>
  )
}
