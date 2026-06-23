'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useApiSWR, useApi } from '@/lib/hooks/useApi'
import { useCacheManager } from '@/lib/hooks/useCacheManager'
import { notify } from '@/lib/notification'
import Swal from 'sweetalert2'

interface Book {
  book_id: number
  title: string
  book_author: string
  isbn?: string
  category: string | { category_id: number; name: string; description?: string; created_at?: string }
  status: 'AVAILABLE' | 'BORROWED' | 'LOST' | 'DAMAGED' | 'UNAVAILABLE'
  copies_total?: number
  copies_available?: number
  created_at?: string
  updated_at?: string
}

interface BorrowTransaction {
  transaction_id: number
  borrow_date: string | null
  return_date?: string
  due_date: string
  penalty: number
  book: {
    book_id: number
    title: string
    book_author: string
    isbn?: string
    category?: { category_id: number; name: string; description?: string; created_at?: string }
    status: string
  }
  user: {
    user_id: number
    account_id: string
    full_name: string
    user_type: string
    status: string
  }
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'COMPLETED' | 'OVERDUE'
}

export default function BooksPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [books, setBooks] = useState<Book[]>([])
  const [pendingTransactions, setPendingTransactions] = useState<BorrowTransaction[]>([])
  const [borrowedBooks, setBorrowedBooks] = useState<BorrowTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)
  const [activeTab, setActiveTab] = useState<'books' | 'pending' | 'borrowed' | 'returns'>('books')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [showAddBookModal, setShowAddBookModal] = useState(false)
  const [showEditBookModal, setShowEditBookModal] = useState(false)
  const [selectedBookForEdit, setSelectedBookForEdit] = useState<Book | null>(null)
  const [editForm, setEditForm] = useState({
    title: '',
    book_author: '',
    category: '',
    isbn: '',
    publisher: '',
    publication_year: '',
    edition: '',
    pages: '',
    language: 'English',
    description: ''
  })
  const [isUpdating, setIsUpdating] = useState(false)

  const availableCategories = React.useMemo(() => {
    const unique = new Set<string>()
    for (const book of books) {
      const categoryName = typeof book.category === 'string' ? book.category : book.category?.name || ''
      const trimmed = categoryName.trim()
      if (trimmed) unique.add(trimmed)
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b))
  }, [books])

  // SWR for real-time pending transactions
  const { 
    data: pendingTransactionsData, 
    error: pendingError, 
    isLoading: pendingLoading,
    mutate: refreshPendingTransactions 
  } = useApiSWR<any>(
    authReady ? '/api/borrowing-transactions?status=PENDING_APPROVAL' : null,
    {
      refreshInterval: 3000, // Refresh every 3 seconds for real-time updates
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 1000,
    }
  )

  // SWR for real-time borrowed books
  const { 
    data: borrowedBooksData, 
    error: borrowedError, 
    isLoading: borrowedLoading,
    mutate: refreshBorrowedBooks 
  } = useApiSWR<any>(
    authReady ? '/api/borrowing-transactions?status=ACTIVE' : null,
    {
      refreshInterval: 5000, // Refresh every 5 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 1000,
    }
  )

  // Use SWR data or fallback to manual state with proper error handling
  const effectivePendingTransactions = React.useMemo(() => {
    if (!pendingTransactionsData) return pendingTransactions
    
    // Handle different API response formats
    if (Array.isArray(pendingTransactionsData)) {
      return pendingTransactionsData
    }
    
    // Check for nested data structures
    const transactions = pendingTransactionsData.transactions || 
                        pendingTransactionsData.data?.transactions || 
                        pendingTransactionsData.data || 
                        []
    
    return Array.isArray(transactions) ? transactions : []
  }, [pendingTransactionsData, pendingTransactions])

  const effectiveBorrowedBooks = React.useMemo(() => {
    if (!borrowedBooksData) return borrowedBooks
    
    // Handle different API response formats
    if (Array.isArray(borrowedBooksData)) {
      return borrowedBooksData
    }
    
    // Check for nested data structures
    const transactions = borrowedBooksData.transactions || 
                        borrowedBooksData.data?.transactions || 
                        borrowedBooksData.data || 
                        []
    
    return Array.isArray(transactions) ? transactions : []
  }, [borrowedBooksData, borrowedBooks])

  // Handle tab parameter from URL (for notifications)
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'pending' || tab === 'borrowed') {
      setActiveTab(tab)
    }
  }, [searchParams])
  const handleUpdateBookStatus = async (bookId: number, currentStatus: string, bookTitle: string) => {
    const options: Record<string, string> = {
      AVAILABLE: 'AVAILABLE',
      BORROWED: 'BORROWED',
      LOST: 'LOST',
      DAMAGED: 'DAMAGED',
    }
    const next = await notify.select(`Update Status for "${bookTitle}"`, options, 'Select new status')
    if (!next) return
    try {
      notify.loading('Updating status...')
      const res = await fetch(`/api/books/${bookId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: next })
      })
      if (res.ok) {
        notify.close()
        await notify.success('Success', 'Book status updated successfully')
        fetchBooks()
      } else {
        let msg = 'Failed to update status'
        try { const j = await res.json(); msg = j.error || j.message || msg } catch { const t = await res.text(); if (t) msg = t }
        notify.close()
        await notify.error('Error', msg)
      }
    } catch (e) {
      notify.close()
      await notify.error('Error', 'Network error occurred')
    }
  }

  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') {
        return
      }

      if (status === 'authenticated' && session?.user) {
        if (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF') {
          const lastLocation = localStorage.getItem('lastLocation') || '/dashboard'
          router.push(lastLocation)
          return
        }
        setAuthReady(true)
      } else {
        try {
          const response = await fetch('/api/users/profile', {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          })
          
          if (response.ok) {
            const userData = await response.json()
            if (userData.role !== 'ADMIN' && userData.role !== 'SUPER_ADMIN' && userData.role !== 'STAFF') {
              const lastLocation = localStorage.getItem('lastLocation') || '/dashboard'
              router.push(lastLocation)
              return
            }
            setAuthReady(true)
          } else {
            router.push('/login')
            return
          }
        } catch (error) {
          router.push('/login')
          return
        }
      }
    }

    checkAuth()
  }, [session, status, router])

  useEffect(() => {
    if (authReady) {
      fetchBooks()
      fetchPendingTransactions()
      fetchBorrowedBooks()
    }
  }, [authReady])

  useEffect(() => {
    localStorage.setItem('lastLocation', '/books')
  }, [])

  const fetchBooks = async () => {
    try {
      setLoading(true)
      
      const response = await fetch('/api/books', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        const list = Array.isArray(data) ? data : (data.data?.data || data.data || data.books || [])
        const normalized = list.map((b: any) => ({
          book_id: b.book_id,
          title: b.title,
          book_author: b.book_author,
          isbn: b.isbn,
          category: b.category?.name || b.category || '',
          status: b.copies_available === 0 ? 'UNAVAILABLE' : (b.status || 'AVAILABLE'),
          copies_total: b.copies_total || 0,
          copies_available: b.copies_available || 0,
          copies_borrowed: b.copies_borrowed || 0,
          created_at: b.created_at,
          updated_at: b.updated_at,
        }))
        setBooks(Array.isArray(normalized) ? normalized : [])
      } else {
        const errorData = await response.text()
        
        if (response.status === 403) {
          const lastLocation = localStorage.getItem('lastLocation') || '/dashboard'
          router.push(lastLocation)
        } else if (response.status === 401) {
          router.push('/login')
        } else {
          notify.error('Error', `Failed to fetch books: ${response.status}`)
        }
      }
    } catch (error) {
      notify.error('Error', 'Network error occurred while fetching books')
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingTransactions = async () => {
    try {
      // Add cache busting parameter to ensure fresh data
      const cacheBuster = `?status=PENDING_APPROVAL&_t=${Date.now()}`
      const response = await fetch(`/api/borrowing-transactions${cacheBuster}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        const list = Array.isArray(data) ? data : (data.data?.data || data.data || data.transactions || [])
        setPendingTransactions(Array.isArray(list) ? list : [])
      }
    } catch (error) {
    }
  }

  const fetchBorrowedBooks = async () => {
    try {
      // Add cache busting parameter to ensure fresh data
      const cacheBuster = `?status=ACTIVE&_t=${Date.now()}`
      const response = await fetch(`/api/borrowing-transactions${cacheBuster}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        const list = Array.isArray(data) ? data : (data.data?.data || data.data || data.transactions || [])
        setBorrowedBooks(Array.isArray(list) ? list : [])
      }
    } catch (error) {
    }
  }

  const handleAddBook = async () => {
    const titleResult = await Swal.fire({
      title: 'Add New Book',
      text: 'Enter the book title:',
      input: 'text',
      inputPlaceholder: 'Book title...',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) {
          return 'Please enter a book title'
        }
      }
    })
    
    if (!titleResult.isConfirmed || !titleResult.value) {
      return
    }
    const title = titleResult.value

    const authorResult = await Swal.fire({
      title: 'Add New Book',
      text: 'Enter the book author:',
      input: 'text',
      inputPlaceholder: 'Author name...',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) {
          return 'Please enter an author name'
        }
      }
    })
    
    if (!authorResult.isConfirmed || !authorResult.value) {
      return
    }
    const author = authorResult.value

    const categoryResult = await Swal.fire({
      title: 'Add New Book',
      text: 'Enter the book category:',
      input: 'text',
      inputPlaceholder: 'Category...',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) {
          return 'Please enter a category'
        }
      }
    })
    
    if (!categoryResult.isConfirmed || !categoryResult.value) {
      return
    }
    const category = categoryResult.value

    try {
      const response = await fetch('/api/books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          book_author: author.trim(),
          category: category.trim()
        })
      })

      if (response.ok) {
        notify.success('Success', 'Book added successfully')
        await fetchBooks()
      } else {
        const errorData = await response.json()
        notify.error('Error', errorData.error || 'Failed to add book')
      }
    } catch (error) {
      notify.error('Error', 'Network error occurred')
    }
  }

  const handleApproveTransaction = async (transactionId: number, action: 'approve' | 'reject') => {
    const result = await Swal.fire({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Transaction`,
      text: `Are you sure you want to ${action} this borrowing request?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: `Yes, ${action} it!`,
      cancelButtonText: 'Cancel'
    })

    if (result.isConfirmed) {
      try {
        const response = await fetch(`/api/borrowing-transactions/${transactionId}/${action}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: action === 'reject' ? JSON.stringify({ reason: '' }) : undefined,
        })

        if (response.ok) {
          notify.success('Success', `Transaction ${action}d successfully`)
          // Add a small delay to ensure database transaction is committed
          setTimeout(async () => {
            await fetchPendingTransactions()
            await fetchBorrowedBooks()
            await fetchBooks()
          }, 500)
        } else {
          const errorData = await response.json().catch(() => ({}))
          const errorMessage = errorData.error || errorData.details || `Failed to ${action} transaction`
          notify.error('Error', errorMessage)
        }
      } catch (error) {
        notify.error('Error', 'Network error occurred')
      }
    }
  }

  const handleApproveReturn = async (transactionId: number) => {
    const result = await Swal.fire({
      title: 'Approve Return',
      text: 'Are you sure you want to approve this book return?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, approve it!',
      cancelButtonText: 'Cancel'
    })

    if (result.isConfirmed) {
      try {
        const response = await fetch(`/api/borrowing-transactions/${transactionId}/return`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        })

        if (response.ok) {
          notify.success('Success', 'Return approved successfully')
          // Refresh SWR data for real-time updates
          refreshPendingTransactions()
          refreshBorrowedBooks()
          await fetchBooks()
        } else {
          notify.error('Error', 'Failed to approve return')
        }
      } catch (error) {
        notify.error('Error', 'Network error occurred')
      }
    }
  }

  const handleNotifyAdmin = async (transactionId: number) => {
    try {
      const response = await fetch('/api/notifications/notify-admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          transactionId,
          type: 'PENDING_BORROW_APPROVAL',
          message: 'A pending borrow request needs your approval'
        })
      })

      if (response.ok) {
        notify.success('Success', 'Admin notification sent successfully')
      } else {
        const errorData = await response.json().catch(() => ({}))
        notify.error('Error', errorData.error || 'Failed to send notification')
      }
    } catch (error) {
      notify.error('Error', 'Network error occurred')
    }
  }

  const handleEditBook = (book: Book) => {
    setSelectedBookForEdit(book)
    setEditForm({
      title: book.title || '',
      book_author: book.book_author || '',
      category: typeof book.category === 'string' ? book.category : book.category?.name || '',
      isbn: '',
      publisher: '',
      publication_year: '',
      edition: '',
      pages: '',
      language: 'English',
      description: ''
    })
    setShowEditBookModal(true)
  }

  const handleUpdateBook = async () => {
    if (!selectedBookForEdit) return
    
    if (!editForm.title.trim() || !editForm.book_author.trim() || !editForm.category.trim()) {
      notify.error('Validation Error', 'Title, Author, and Category are required fields')
      return
    }

    setIsUpdating(true)

    try {
      const updateData = {
        title: editForm.title.trim(),
        book_author: editForm.book_author.trim(),
        category: editForm.category.trim(),
        ...(editForm.isbn.trim() && { isbn: editForm.isbn.trim() }),
        ...(editForm.publisher.trim() && { publisher: editForm.publisher.trim() }),
        ...(editForm.publication_year && { publication_year: parseInt(editForm.publication_year) }),
        ...(editForm.edition.trim() && { edition: editForm.edition.trim() }),
        ...(editForm.pages && { pages: parseInt(editForm.pages) }),
        ...(editForm.language && { language: editForm.language }),
        ...(editForm.description.trim() && { description: editForm.description.trim() })
      }

      const response = await fetch(`/api/books/${selectedBookForEdit.book_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        notify.success('Success', 'Book updated successfully')
        setShowEditBookModal(false)
        setSelectedBookForEdit(null)
        await fetchBooks()
      } else {
        const errorData = await response.json()
        notify.error('Error', errorData.error || 'Failed to update book')
      }
    } catch (error) {
      notify.error('Error', 'Network error occurred')
    } finally {
      setIsUpdating(false)
    }
  }

  const filteredBooks = books.filter(book => {
    const categoryName = typeof book.category === 'string' ? book.category : book.category?.name || ''
    const matchesSearch = book.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.book_author?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      categoryName.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = !statusFilter || book.status === statusFilter
    const matchesCategory =
      !categoryFilter || categoryName.trim().toLowerCase() === categoryFilter.trim().toLowerCase()

    return matchesSearch && matchesStatus && matchesCategory
  })

  const totalPages = Math.ceil(filteredBooks.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentBooks = filteredBooks.slice(startIndex, endIndex)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, categoryFilter])

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
      case 'UNAVAILABLE':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'fa-check-circle text-green-600'
      case 'BORROWED':
        return 'fa-book-reader text-blue-600'
      case 'LOST':
        return 'fa-question-circle text-red-600'
      case 'DAMAGED':
        return 'fa-exclamation-triangle text-orange-600'
      case 'UNAVAILABLE':
        return 'fa-ban text-gray-600'
      default:
        return 'fa-circle text-gray-600'
    }
  }

  if (!authReady) {
    return (
      <div className="px-6 py-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Checking authentication...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-800">
              Book Management System
            </h1>
            <div className="flex gap-2">
              
              <Link 
                href="/books/archived-copies"
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center"
              >
                <i className="fas fa-archive mr-2"></i>
                Archived Copies
              </Link>
              {session?.user?.role === 'STAFF' && (
                <Link 
                  href="/books/return"
                  className="!bg-primary-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center"
                >
                  <i className="fas fa-undo mr-2"></i>
                  Return Books
                </Link>
              )}
              <Link 
                href="/books/add"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center"
              >
                <i className="fas fa-plus mr-2"></i>
                Add New Book
              </Link>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Manage book inventory, approve transactions, and track book status
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="px-6">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('books')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'books'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <i className="fas fa-book mr-2"></i>
              Books ({filteredBooks.length})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-4 px-1 border-b-2 font-medium text-sm relative ${
                activeTab === 'pending'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <i className="fas fa-clock mr-2"></i>
              Pending Approval ({effectivePendingTransactions.length})
              {effectivePendingTransactions.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {effectivePendingTransactions.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('borrowed')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'borrowed'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <i className="fas fa-hand-holding mr-2"></i>
              Borrowed Books ({effectiveBorrowedBooks.length})
            </button>
            {session?.user?.role === 'STAFF' && (
              <button
                onClick={() => window.location.href = '/books/return'}
                className="py-4 text-white border-b-2 bg-primary-600 px-4 border-transparent hover:bg-primary-700 font-medium text-sm"
              >
                <i className="fas fa-undo mr-2"></i>
                Return Books
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="py-4">
        {activeTab === 'books' ? (
          <>
            {/* Search and Filters */}
            <div className="mb-6 space-y-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Status</option>
                      <option value="AVAILABLE">Available</option>
                      <option value="BORROWED">Borrowed</option>
                      <option value="LOST">Lost</option>
                      <option value="DAMAGED">Damaged</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Categories</option>
                      {availableCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Per Page</label>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value))
                        setCurrentPage(1)
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={20}>20 per page</option>
                      <option value={50}>50 per page</option>
                      <option value={100}>100 per page</option>
                    </select>
                  </div>
                </div>

                <div className="lg:w-80">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                  <input
                    type="text"
                    placeholder="Search by title, author, or category..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Books Table */}
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="text-gray-500">Loading books...</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Book Details
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Author
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Copies
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {currentBooks.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                            {searchTerm || statusFilter || categoryFilter ? 'No books found matching your filters.' : 'No books found.'}
                          </td>
                        </tr>
                      ) : (
                        currentBooks.map((book) => (
                          <tr key={book.book_id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10">
                                  <div className="h-10 w-10 rounded bg-blue-500 flex items-center justify-center">
                                    <i className="fas fa-book text-white text-sm"></i>
                                  </div>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    {book.title}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    ISBN: {book.isbn || 'No ISBN'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {book.book_author}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                {typeof book.category === 'string' ? book.category : book.category?.name || 'N/A'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div className="space-y-1">
                                <div className="flex items-center text-xs">
                                  <span className="font-medium text-gray-600">Total:</span>
                                  <span className="ml-1">{(book as any).copies_total ?? 0}</span>
                                </div>
                                <div className="flex items-center text-xs">
                                  <span className="font-medium text-green-600">Available:</span>
                                  <span className="ml-1">{(book as any).copies_available ?? 0}</span>
                                </div>
                                <div className="flex items-center text-xs">
                                  <span className="font-medium text-blue-600">Borrowed:</span>
                                  <span className="ml-1">{(book as any).copies_borrowed ?? (((book as any).copies_total ?? 0) - ((book as any).copies_available ?? 0))}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <i className={`fas ${getStatusIcon(book.status)} mr-2`}></i>
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(book.status)}`}>
                                  {book.status.charAt(0) + book.status.slice(1).toLowerCase()}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex gap-1">
                                <Link
                                  href={`/books/${book.book_id}/view`}
                                  className="text-slate-600 hover:text-slate-900 px-2 py-1 text-sm border border-slate-600 hover:bg-slate-50 rounded transition-colors"
                                  title="View Book Details"
                                >
                                  <i className="fas fa-eye"></i>
                                </Link>
                                <Link
                                  href={`/books/${book.book_id}/edit`}
                                  className="text-blue-600 hover:text-blue-900 px-2 py-1 text-sm border border-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit Book"
                                >
                                  <i className="fas fa-edit"></i>
                                </Link>
                                
                                <Link
                                  href={`/books/${book.book_id}/copies?action=add`}
                                  className="text-green-600 hover:text-green-900 px-2 py-1 text-sm border border-green-600 hover:bg-green-50 rounded transition-colors"
                                  title="Add Stock"
                                >
                                  <i className="fas fa-plus-circle"></i>
                                </Link>
                                
                                <Link
                                  href={`/books/${book.book_id}/copies`}
                                  className="text-gray-600 hover:text-gray-900 px-2 py-1 text-sm border border-gray-600 hover:bg-gray-50 rounded transition-colors"
                                  title="Manage Copies"
                                >
                                  <i className="fas fa-list"></i>
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {!loading && filteredBooks.length > 0 && totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between bg-white px-4 py-3 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-sm font-medium text-gray-700">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredBooks.length)} of {filteredBooks.length} books
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>

                  <div className="flex items-center space-x-1">
                    {(() => {
                      const pages = [];
                      const maxPagesToShow = 7;
                      
                      if (totalPages <= maxPagesToShow) {
                        for (let i = 1; i <= totalPages; i++) {
                          pages.push(
                            <button
                              key={i}
                              onClick={() => setCurrentPage(i)}
                              className={`px-3 py-2 text-sm font-medium border rounded-md ${
                                currentPage === i
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {i}
                            </button>
                          );
                        }
                      } else {
                        pages.push(
                          <button
                            key={1}
                            onClick={() => setCurrentPage(1)}
                            className={`px-3 py-2 text-sm font-medium border rounded-md ${
                              currentPage === 1
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            1
                          </button>
                        );

                        if (currentPage > 3) {
                          pages.push(
                            <span key="ellipsis-start" className="px-2 text-gray-500">
                              ...
                            </span>
                          );
                        }

                        const startPage = Math.max(2, currentPage - 1);
                        const endPage = Math.min(totalPages - 1, currentPage + 1);

                        for (let i = startPage; i <= endPage; i++) {
                          pages.push(
                            <button
                              key={i}
                              onClick={() => setCurrentPage(i)}
                              className={`px-3 py-2 text-sm font-medium border rounded-md ${
                                currentPage === i
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {i}
                            </button>
                          );
                        }

                        if (currentPage < totalPages - 2) {
                          pages.push(
                            <span key="ellipsis-end" className="px-2 text-gray-500">
                              ...
                            </span>
                          );
                        }

                        pages.push(
                          <button
                            key={totalPages}
                            onClick={() => setCurrentPage(totalPages)}
                            className={`px-3 py-2 text-sm font-medium border rounded-md ${
                              currentPage === totalPages
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {totalPages}
                          </button>
                        );
                      }

                      return pages;
                    })()}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            )}
          </>
        ) : activeTab === 'pending' ? (
          <>
            {/* Pending Transactions */}
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b">
                <h3 className="text-lg font-medium text-gray-900">Pending Approval</h3>
                <p className="text-sm text-gray-600 mt-1">Review and approve borrowing requests waiting for approval</p>
              </div>
              
              {effectivePendingTransactions.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <i className="fas fa-clipboard-check text-4xl mb-4 text-gray-300"></i>
                  <div>No pending transactions</div>
                  <div className="text-sm mt-1">All transactions have been processed</div>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {effectivePendingTransactions.map((transaction) => (
                    <div key={transaction.transaction_id} className="p-6 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <div className="flex-shrink-0 h-12 w-12">
                              <div className="h-12 w-12 rounded bg-blue-500 flex items-center justify-center">
                                <i className="fas fa-book text-white"></i>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-lg font-medium text-gray-900">
                                {transaction.book.title}
                              </div>
                              <div className="text-sm text-gray-600">
                                by {transaction.book.book_author} • {transaction.book.category?.name}
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Borrower:</span>
                              {transaction.user ? (
                                <>
                                  <div className="font-medium">{transaction.user.full_name}</div>
                                  <div className="text-gray-500">{transaction.user.account_id} • {transaction.user.user_type}</div>
                                </>
                              ) : transaction.department ? (
                                <>
                                  <div className="font-medium">{transaction.department.name}</div>
                                  <div className="text-gray-500">
                                    {transaction.department.code} • Department
                                    {transaction.borrower_representative && ` • Rep: ${transaction.borrower_representative}`}
                                  </div>
                                </>
                              ) : transaction.office ? (
                                <>
                                  <div className="font-medium">{transaction.office.name}</div>
                                  <div className="text-gray-500">
                                    {transaction.office.code} • Office
                                    {transaction.borrower_representative && ` • Rep: ${transaction.borrower_representative}`}
                                  </div>
                                </>
                              ) : (
                                <div className="font-medium text-gray-400">N/A</div>
                              )}
                            </div>
                            <div>
                              <span className="text-gray-600">Dates:</span>
                              <div className="font-medium">Borrow: {transaction.borrow_date ? new Date(transaction.borrow_date).toLocaleDateString() : 'Not set'}</div>
                              <div className="text-gray-500">Due: {new Date(transaction.due_date).toLocaleDateString()}</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-2 ml-6">
                          {transaction.status === 'PENDING_APPROVAL' && (
                            <>
                              {(session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN') ? (
                                <>
                                  <button
                                    onClick={() => handleApproveTransaction(transaction.transaction_id, 'approve')}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                                  >
                                    <i className="fas fa-check mr-2"></i>
                                    Approve Borrow
                                  </button>
                                  <button
                                    onClick={() => handleApproveTransaction(transaction.transaction_id, 'reject')}
                                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                                  >
                                    <i className="fas fa-times mr-2"></i>
                                    Reject
                                  </button>
                                </>
                              ) : (
                                <>
                                  <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-md text-sm font-medium text-center">
                                    <i className="fas fa-clock mr-2"></i>
                                    Waiting for Approval
                                  </div>
                                  <button
                                    onClick={() => handleNotifyAdmin(transaction.transaction_id)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                                  >
                                    <i className="fas fa-bell mr-2"></i>
                                    Notify Admin
                                  </button>
                                </>
                              )}
                            </>
                          )}
                          {transaction.return_date && !transaction.status.includes('RETURNED') && session?.user?.role !== 'ADMIN' && (
                            <button
                              onClick={() => handleApproveReturn(transaction.transaction_id)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                            >
                              <i className="fas fa-undo mr-2"></i>
                              Approve Return
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {transaction.penalty > 0 && (
                        <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-md">
                          <div className="text-sm">
                            <i className="fas fa-exclamation-triangle text-orange-600 mr-2"></i>
                            <span className="text-orange-800">Penalty: ${Number(transaction.penalty || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Borrowed Books */}
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b">
                <h3 className="text-lg font-medium text-gray-900">Borrowed Books</h3>
                <p className="text-sm text-gray-600 mt-1">Currently borrowed books that are active</p>
              </div>
              
              {effectiveBorrowedBooks.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <i className="fas fa-hand-holding text-4xl mb-4 text-gray-300"></i>
                  <div>No borrowed books</div>
                  <div className="text-sm mt-1">No books are currently borrowed</div>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {effectiveBorrowedBooks.map((transaction) => (
                    <div key={transaction.transaction_id} className="p-6 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <div className="flex-shrink-0 h-12 w-12">
                              <div className="h-12 w-12 rounded bg-green-500 flex items-center justify-center">
                                <i className="fas fa-book text-white"></i>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-lg font-medium text-gray-900">
                                {transaction.book.title}
                              </div>
                              <div className="text-sm text-gray-600">
                                by {transaction.book.book_author} • {transaction.book.category?.name}
                              </div>
                            </div>
                          </div>
                          
                          <div className="ml-16 space-y-1">
                            <div className="text-sm text-gray-600">
                              <strong>Borrower:</strong>{' '}
                              {transaction.user ? (
                                `${transaction.user.full_name} (${transaction.user.account_id})`
                              ) : transaction.department ? (
                                `${transaction.department.name} (${transaction.department.code})${transaction.borrower_representative ? ` - Rep: ${transaction.borrower_representative}` : ''}`
                              ) : transaction.office ? (
                                `${transaction.office.name} (${transaction.office.code})${transaction.borrower_representative ? ` - Rep: ${transaction.borrower_representative}` : ''}`
                              ) : (
                                'N/A'
                              )}
                            </div>
                            <div className="text-sm text-gray-600">
                              <strong>Borrowed:</strong> {transaction.borrow_date ? new Date(transaction.borrow_date).toLocaleDateString() : 'N/A'}
                            </div>
                            <div className="text-sm text-gray-600">
                              <strong>Due:</strong> {transaction.due_date ? new Date(transaction.due_date).toLocaleDateString() : 'N/A'}
                            </div>
                            {transaction.due_date && new Date(transaction.due_date) < new Date() && (
                              <div className="text-sm text-red-600 font-medium">
                                OVERDUE by {Math.floor((new Date().getTime() - new Date(transaction.due_date).getTime()) / (1000 * 60 * 60 * 24))} days
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <span className={`px-2 py-2 text-xs font-medium rounded-md ${
                            transaction.due_date && new Date(transaction.due_date) < new Date() 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {transaction.due_date && new Date(transaction.due_date) < new Date() ? 'OVERDUE' : 'ACTIVE'}
                          </span>
                          
                          {/* Hide Process Return button for ADMIN users - only STAFF and SUPER_ADMIN can process returns */}
                          {session?.user?.role !== 'ADMIN' && (
                            <button
                              onClick={() => router.push(`/books/return?transaction_id=${transaction.transaction_id}`)}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
                            >
                              <i className="fas fa-undo mr-1"></i>
                              Process Return
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Edit Book Modal */}
      {showEditBookModal && selectedBookForEdit && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <i className="fas fa-edit mr-2 text-blue-600"></i>
                Edit Book
              </h3>
              <p className="text-sm text-gray-600 mt-1">Update book information</p>
            </div>

            <div className="px-6 py-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Book title"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Author *</label>
                  <input
                    type="text"
                    value={editForm.book_author}
                    onChange={(e) => setEditForm({...editForm, book_author: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Author name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <input
                    type="text"
                    value={editForm.category}
                    onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Book category"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
                    <input
                      type="text"
                      value={editForm.isbn}
                      onChange={(e) => setEditForm({...editForm, isbn: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="ISBN"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                    <select
                      value={editForm.language}
                      onChange={(e) => setEditForm({...editForm, language: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="English">English</option>
                      <option value="Filipino">Filipino</option>
                      <option value="Spanish">Spanish</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Publisher</label>
                  <input
                    type="text"
                    value={editForm.publisher}
                    onChange={(e) => setEditForm({...editForm, publisher: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Publisher name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Publication Year</label>
                    <input
                      type="number"
                      value={editForm.publication_year}
                      onChange={(e) => setEditForm({...editForm, publication_year: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Year"
                      min="1900"
                      max={new Date().getFullYear()}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pages</label>
                    <input
                      type="number"
                      value={editForm.pages}
                      onChange={(e) => setEditForm({...editForm, pages: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Number of pages"
                      min="1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Edition</label>
                  <input
                    type="text"
                    value={editForm.edition}
                    onChange={(e) => setEditForm({...editForm, edition: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Edition (e.g., 1st, 2nd, Revised)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Book description (optional)"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditBookModal(false)
                  setSelectedBookForEdit(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateBook}
                disabled={isUpdating || !editForm.title.trim() || !editForm.book_author.trim() || !editForm.category.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Updating...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save mr-2"></i>
                    Update Book
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
