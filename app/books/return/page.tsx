'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { notify } from '@/lib/notification'
import { useApiSWR, apiCache } from '@/lib/hooks/useApi'

interface BorrowTransaction {
  transaction_id: number
  borrow_date: string
  due_date: string
  penalty: number
  copy?: {
    accession_number: string
  } | null
  book: {
    book_id: number
    title: string
    book_author: string
    isbn?: string
    category?: { name: string }
  }
  user?: {
    user_id: number
    account_id: string
    full_name: string
    user_type: string
  } | null
  department?: {
    department_id: number
    name: string
    code: string
  } | null
  office?: {
    office_id: number
    name: string
    code: string
  } | null
  borrower_representative?: string | null
  status: 'ACTIVE' | 'OVERDUE'
}

export default function ReturnBooksPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const preSelectedTxnId = searchParams.get('transaction_id')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchType, setSearchType] = useState('all') // all, accession, title, user, account_id
  const [condition, setCondition] = useState('GOOD')
  const [notes, setNotes] = useState('')
  const [selectedTransaction, setSelectedTransaction] = useState<BorrowTransaction | null>(null)
  const [searching, setSearching] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  
  // Quick Accession Number lookup
  const [quickAccession, setQuickAccession] = useState('')
  const [accessionLookupLoading, setAccessionLookupLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'quick' | 'advanced'>('quick')
  
  // Control auto-select behavior with debouncing
  const MIN_AUTO_SELECT_LENGTH = 3 // minimum chars before auto-select
  const DEBOUNCE_MS = 500 // wait for user to finish typing
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  // Removed notification tracking for advanced search; keep logic simple

  // Build API endpoint for active transactions with search
  const buildApiEndpoint = () => {
    if (!authReady) return null
    
    const params = new URLSearchParams()
    params.append('status', 'ACTIVE')
    if (searchTerm.trim()) {
      params.append('search', searchTerm.trim())
      params.append('searchType', searchType)
    }
    return `/api/borrowing-transactions?${params.toString()}`
  }

  // SWR for active transactions
  const { 
    data: transactionsResponse, 
    error: transactionsError, 
    isLoading: transactionsLoading,
    mutate: refreshTransactions 
  } = useApiSWR<any>(buildApiEndpoint(), {
    refreshInterval: 5000, // Auto-refresh every 5 seconds
    revalidateOnFocus: true,
    revalidateOnReconnect: true
  })

  // Handle different response formats and ensure we get an array
  const activeTransactions = React.useMemo(() => {
    if (!transactionsResponse) return []
    
    // Handle different response formats
    if (Array.isArray(transactionsResponse)) {
      return transactionsResponse
    }
    
    // Check for nested data structures
    const transactions = transactionsResponse.transactions || 
                        transactionsResponse.data?.transactions || 
                        transactionsResponse.data || 
                        []
    
    return Array.isArray(transactions) ? transactions : []
  }, [transactionsResponse])

  // Auto-select transaction from URL parameter
  useEffect(() => {
    if (preSelectedTxnId && activeTransactions.length > 0 && !selectedTransaction) {
      const txnId = parseInt(preSelectedTxnId)
      const txn = activeTransactions.find((t: BorrowTransaction) => t.transaction_id === txnId)
      if (txn) {
        setSelectedTransaction(txn)
        setActiveTab('advanced')
        const borrowerName = txn.user?.full_name || txn.department?.name || txn.office?.name || 'Unknown borrower'
        notify.info('Transaction Selected', `Book: ${txn.book.title} - Borrower: ${borrowerName}`)
      }
    }
  }, [preSelectedTxnId, activeTransactions, selectedTransaction])

  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') return

      if (status === 'authenticated' && session?.user) {
        // Only STAFF can access return books page
        if (session.user.role !== 'STAFF') {
          notify.error('Unauthorized', 'Only staff members can access the return books page')
          router.push('/books')
          return
        }
        setAuthReady(true)
      } else {
        try {
          const response = await fetch('/api/users/profile', { credentials: 'include' })
          if (response.ok) {
            const userData = await response.json()
            // Only STAFF can access return books page
            if (userData.role !== 'STAFF') {
              notify.error('Unauthorized', 'Only staff members can access the return books page')
              router.push('/books')
              return
            }
            setAuthReady(true)
          } else {
            router.push('/login')
          }
        } catch {
          router.push('/login')
        }
      }
    }

    checkAuth()
  }, [session, status, router])

  useEffect(() => {
    if (authReady) {
      refreshTransactions()
    }
  }, [authReady, searchTerm, searchType, refreshTransactions])

  // Handle search with debouncing - removed old manual effect
  // SWR automatically handles the endpoint changes

  // Clear selection when search type changes
  useEffect(() => {
    setSelectedTransaction(null)
  }, [searchType])

  const clearSearch = () => {
  setSearchTerm('')
  setSelectedTransaction(null)
  }

  // Refresh function for manual updates
  const handleRefresh = () => {
  refreshTransactions()
  }

  // Quick Accession Number lookup
  const lookupTransactionByAccession = async (accession: string) => {
    if (!accession.trim()) return
    
    setAccessionLookupLoading(true)
    try {
      const response = await fetch(`/api/borrowing-transactions?status=ACTIVE&search=${encodeURIComponent(accession.trim())}&searchType=accession`)
      const result = await response.json()
      
      if (response.ok && result.success) {
        const transactions = Array.isArray(result.data) ? result.data : []
        
        if (transactions.length === 1) {
          setSelectedTransaction(transactions[0])
          notify.success('Transaction Found', `Found active transaction for Accession: ${accession}`)
        } else if (transactions.length === 0) {
          notify.info('No Transaction Found', `No active transaction found for Accession: ${accession}`)
          setSelectedTransaction(null)
        } else {
          notify.warning('Multiple Transactions', `Found ${transactions.length} transactions for this accession. Please select one from the list below.`)
          setSelectedTransaction(null)
        }
      } else {
        notify.error('Lookup Failed', result.error || 'Failed to lookup transaction')
        setSelectedTransaction(null)
      }
    } catch (error) {
      console.error('Accession lookup error:', error)
      notify.error('Error', 'Network error during lookup')
      setSelectedTransaction(null)
    } finally {
      setAccessionLookupLoading(false)
    }
  }

  // Auto-lookup effect for quick accession number with debouncing
  useEffect(() => {
    if (quickAccession.length >= 3) {
      const timeoutId = setTimeout(() => {
        lookupTransactionByAccession(quickAccession)
      }, 500)
      
      return () => clearTimeout(timeoutId)
    } else if (quickAccession.length === 0) {
      // Clear selection when accession is cleared
      setSelectedTransaction(null)
    }
  }, [quickAccession])

  // Handle transaction selection when searching
  // Handle search with debouncing and better auto-select logic
  useEffect(() => {
    // Simple debounce just to avoid rapid re-renders; no notifications or auto-select
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    if (!searchTerm.trim()) {
      setSelectedTransaction(null)
      return
    }
    debounceTimerRef.current = setTimeout(() => {
      // If exactly one result after debounce, select it automatically (quality-of-life)
      if (activeTransactions.length === 1 && searchTerm.trim().length >= MIN_AUTO_SELECT_LENGTH) {
        setSelectedTransaction(activeTransactions[0])
      } else if (activeTransactions.length !== 1) {
        // Leave selection to user
        setSelectedTransaction(null)
      }
    }, DEBOUNCE_MS)
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [activeTransactions, searchTerm])

  const processReturn = async () => {
    if (!selectedTransaction) {
      await notify.warning('Selection Required', 'Please select a transaction to process return')
      return
    }

    const confirmed = await notify.confirm(
      'Process Return',
      `Are you sure you want to process the return for "${selectedTransaction.book.title}"?`
    )

    if (!confirmed) return

    try {
      const response = await fetch(`/api/borrowing-transactions/${selectedTransaction.transaction_id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          condition_on_return: condition, 
          notes: notes.trim() || undefined 
        })
      })

      if (response.ok) {
        await notify.success('Success', 'Book return processed successfully')
        setSelectedTransaction(null)
        setQuickAccession('')
        setSearchTerm('')
        setNotes('')
        setCondition('GOOD')
        // Refresh the transactions list
        refreshTransactions()
        apiCache.invalidate('/api/borrowing-transactions')
      } else {
        const errorData = await response.json()
        await notify.error('Error', errorData.error || 'Failed to process return')
      }
    } catch (error) {
      console.error('Return processing error:', error)
      await notify.error('Error', 'Network error occurred')
    }
  }

  const calculateDaysOverdue = (dueDate: string) => {
    const due = new Date(dueDate)
    const now = new Date()
    const diffTime = now.getTime() - due.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays > 0 ? diffDays : 0
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
            <div>
              <h1 className="text-xl font-semibold text-gray-800">
                Return Books
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Process book returns and manage borrowing transactions
              </p>
            </div>
            <button
              onClick={() => router.back()}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              <i className="fas fa-arrow-left mr-2"></i>
              Back
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Tabs Header */}
          <div className="border-b border-gray-200 mb-4">
            <nav className="flex gap-4" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('quick')}
                className={`px-4 py-2 -mb-px text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'quick'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <i className="fas fa-qrcode mr-2"></i>
                Quick Accession Lookup
              </button>
              <button
                onClick={() => setActiveTab('advanced')}
                className={`px-4 py-2 -mb-px text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'advanced'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <i className="fas fa-search mr-2"></i>
                Advanced Search & Filter
              </button>
            </nav>
          </div>

          {/* Tab Panels */}
          {activeTab === 'quick' && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Quick Accession Lookup
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Scan or Enter Accession Number
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={quickAccession}
                        onChange={(e) => setQuickAccession(e.target.value.toUpperCase())}
                        placeholder="Scan barcode or enter accession number (e.g., LIB-000001)..."
                        className="font-mono"
                        disabled={accessionLookupLoading}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && quickAccession.trim()) {
                            lookupTransactionByAccession(quickAccession.trim())
                          }
                        }}
                      />
                      <Button
                        onClick={() => lookupTransactionByAccession(quickAccession.trim())}
                        disabled={accessionLookupLoading || !quickAccession.trim()}
                        className="px-6"
                      >
                        {accessionLookupLoading ? (
                          <>
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                            Looking up...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-search mr-2"></i>
                            Lookup
                          </>
                        )}
                      </Button>
                      {quickAccession && (
                        <Button
                          onClick={() => {
                            setQuickAccession('')
                            setSelectedTransaction(null)
                          }}
                          variant="outline"
                          className="px-3"
                          title="Clear Accession"
                        >
                          <i className="fas fa-times"></i>
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Start typing or scan a barcode to find the transaction
                    </p>
                  </div>

                  {/* Transaction Preview */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Found Transaction
                    </label>
                    {selectedTransaction ? (
                      <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-medium text-gray-900">{selectedTransaction.book.title}</h4>
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                            <i className="fas fa-check mr-1"></i>
                            Ready to Return
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p><strong>Accession:</strong> {selectedTransaction.copy?.accession_number || 'N/A'}</p>
                          <p><strong>ISBN:</strong> {selectedTransaction.book.isbn || 'N/A'}</p>
                          <p><strong>Author:</strong> {selectedTransaction.book.book_author}</p>
                          <p><strong>Borrower:</strong> {
                            selectedTransaction.user?.full_name ||
                            selectedTransaction.department?.name ||
                            selectedTransaction.office?.name ||
                            'Unknown borrower'
                          }</p>
                          <p><strong>ID:</strong> {
                            selectedTransaction.user?.account_id ||
                            selectedTransaction.department?.code ||
                            selectedTransaction.office?.code ||
                            'N/A'
                          }</p>
                          {selectedTransaction.borrower_representative && (
                            <p><strong>Representative:</strong> {selectedTransaction.borrower_representative}</p>
                          )}
                          <p><strong>Borrowed:</strong> {new Date(selectedTransaction.borrow_date).toLocaleDateString()}</p>
                          <p><strong>Due:</strong> {new Date(selectedTransaction.due_date).toLocaleDateString()}</p>
                          {calculateDaysOverdue(selectedTransaction.due_date) > 0 && (
                            <p className="text-red-600 font-medium">
                              <i className="fas fa-exclamation-triangle mr-1"></i>
                              Overdue by {calculateDaysOverdue(selectedTransaction.due_date)} days
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="border border-gray-200 bg-gray-50 rounded-lg p-4 text-center text-gray-500">
                        <i className="fas fa-qrcode text-2xl mb-2 text-gray-300"></i>
                        <p>No transaction found</p>
                        <p className="text-sm">Scan or enter an accession number to find the transaction</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Return Processing Section - shown when transaction is selected */}
                {selectedTransaction && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Process Return</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Return Condition
                        </label>
                        <select
                          value={condition}
                          onChange={(e) => setCondition(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="EXCELLENT">Excellent</option>
                          <option value="GOOD">Good</option>
                          <option value="FAIR">Fair</option>
                          <option value="POOR">Poor</option>
                          <option value="DAMAGED">Damaged</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Notes (Optional)
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Any additional notes about the book condition..."
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <Button
                        onClick={processReturn}
                        disabled={transactionsLoading}
                        className="w-full md:w-auto bg-green-600 hover:bg-green-700"
                        size="lg"
                      >
                        {transactionsLoading ? (
                          <>
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                            Processing Return...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-undo mr-2"></i>
                            Process Return
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'advanced' && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Advanced Search & Filter
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Search Filter
                      </label>
                      <select
                        value={searchType}
                        onChange={(e) => setSearchType(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Fields</option>
                        <option value="accession">Accession Number</option>
                        <option value="title">Book Title</option>
                        <option value="author">Book Author</option>
                        <option value="user">User Name</option>
                        <option value="account_id">ID Number</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {searchType === 'all' ? 'Search by Accession, Title, Author, User Name, or ID Number' :
                         searchType === 'accession' ? 'Search by Accession Number' :
                         searchType === 'title' ? 'Search by Book Title' :
                         searchType === 'author' ? 'Search by Book Author' :
                         searchType === 'user' ? 'Search by User Name' :
                         'Search by ID Number'}
                      </label>
                      <div className="flex gap-2">
                        <Input
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(searchType === 'accession' ? e.target.value.toUpperCase() : e.target.value)}
                          placeholder={
                            searchType === 'all' ? 'Scan accession or enter any search term...' :
                            searchType === 'accession' ? 'Scan or enter accession number...' :
                            searchType === 'title' ? 'Enter book title...' :
                            searchType === 'author' ? 'Enter author name...' :
                            searchType === 'user' ? 'Enter user full name...' :
                            'Enter ID number...'
                          }
                          onKeyPress={(e) => e.key === 'Enter' && setSearchTerm(e.currentTarget.value)}
                        />
                        <Button
                          onClick={() => {
                            if (searchTerm.trim()) refreshTransactions()
                          }}
                          disabled={transactionsLoading || searching || !searchTerm.trim()}
                          className="px-6"
                        >
                          {searching ? (
                            <>
                              <i className="fas fa-spinner fa-spin mr-2"></i>
                              Searching...
                            </>
                          ) : (
                            <>
                              <i className="fas fa-search mr-2"></i>
                              Search
                            </>
                          )}
                        </Button>
                        {searchTerm && (
                          <Button
                            onClick={clearSearch}
                            variant="outline"
                            className="px-3"
                            title="Clear search"
                          >
                            <i className="fas fa-times"></i>
                          </Button>
                        )}
                      </div>
                      {searchType !== 'all' && (
                        <p className="text-xs text-gray-500 mt-1">
                          Filtering by {searchType === 'accession' ? 'accession number' :
                                      searchType === 'title' ? 'book title' :
                                      searchType === 'author' ? 'book author' :
                                      searchType === 'user' ? 'user name' : 'ID number'} only
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Selected Transaction Preview */}
                  <div>
                    {selectedTransaction ? (
                      <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-medium text-gray-900">{selectedTransaction.book.title}</h4>
                          <button
                            onClick={() => setSelectedTransaction(null)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p><strong>Accession:</strong> {selectedTransaction.copy?.accession_number || 'N/A'}</p>
                          <p><strong>Author:</strong> {selectedTransaction.book.book_author}</p>
                          <p><strong>Borrower:</strong> {
                            selectedTransaction.user?.full_name ||
                            selectedTransaction.department?.name ||
                            selectedTransaction.office?.name ||
                            'Unknown borrower'
                          }</p>
                          <p><strong>ID:</strong> {
                            selectedTransaction.user?.account_id ||
                            selectedTransaction.department?.code ||
                            selectedTransaction.office?.code ||
                            'N/A'
                          }</p>
                          {selectedTransaction.borrower_representative && (
                            <p><strong>Representative:</strong> {selectedTransaction.borrower_representative}</p>
                          )}
                          <p><strong>Borrowed:</strong> {new Date(selectedTransaction.borrow_date).toLocaleDateString()}</p>
                          <p><strong>Due:</strong> {new Date(selectedTransaction.due_date).toLocaleDateString()}</p>
                          {calculateDaysOverdue(selectedTransaction.due_date) > 0 && (
                            <p className="text-red-600 font-medium">
                              <i className="fas fa-exclamation-triangle mr-1"></i>
                              Overdue by {calculateDaysOverdue(selectedTransaction.due_date)} days
                            </p>
                          )}
                          {selectedTransaction.penalty && Number(selectedTransaction.penalty) > 0 && (
                            <p className="text-orange-600 font-medium">
                              <i className="fas fa-dollar-sign mr-1"></i>
                              Penalty: ₱{Number(selectedTransaction.penalty).toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="border border-gray-200 bg-gray-50 rounded-lg p-4 text-center text-gray-500">
                        <i className="fas fa-book text-2xl mb-2 text-gray-300"></i>
                        <p>No transaction selected</p>
                        <p className="text-sm">Search and select a transaction to return</p>
                      </div>
                    )}

                    {selectedTransaction && (
                      <div className="mt-4">
                        <Button
                          onClick={processReturn}
                          disabled={transactionsLoading}
                          className="w-full bg-green-600 hover:bg-green-700"
                        >
                          {transactionsLoading ? (
                            <>
                              <i className="fas fa-spinner fa-spin mr-2"></i>
                              Processing Return...
                            </>
                          ) : (
                            <>
                              <i className="fas fa-undo mr-2"></i>
                              Process Return
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Process Return Section */}
                {selectedTransaction && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Process Return</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Return Condition
                        </label>
                        <select
                          value={condition}
                          onChange={(e) => setCondition(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="EXCELLENT">Excellent</option>
                          <option value="GOOD">Good</option>
                          <option value="FAIR">Fair</option>
                          <option value="POOR">Poor</option>
                          <option value="DAMAGED">Damaged</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Notes (Optional)
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Any additional notes about the book condition..."
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <Button
                        onClick={processReturn}
                        disabled={transactionsLoading}
                        className="w-full md:w-auto bg-green-600 hover:bg-green-700"
                        size="lg"
                      >
                        {transactionsLoading ? (
                          <>
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                            Processing Return...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-undo mr-2"></i>
                            Process Return
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Active Transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {searchTerm ? `Search Results (${activeTransactions.length})` : `Active Borrowing Transactions (${activeTransactions.length})`}
                </span>
                <div className="flex items-center gap-2">
                  {searchTerm && (
                    <span className="text-sm text-gray-500 mr-2">
                      Searching: "{searchTerm}"
                    </span>
                  )}
                  <Button 
                    onClick={handleRefresh} 
                    variant="outline" 
                    size="sm"
                    disabled={transactionsLoading}
                  >
                    <i className="fas fa-sync-alt mr-2"></i>
                    Refresh
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-gray-600">Loading transactions...</p>
                </div>
              ) : activeTransactions.length === 0 ? (
                <div className="text-center py-8">
                  <i className="fas fa-check-circle text-4xl text-green-300 mb-4"></i>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Transactions</h3>
                  <p className="text-gray-600">All books have been returned</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeTransactions.map((transaction) => {
                    const isOverdue = calculateDaysOverdue(transaction.due_date) > 0
                    const daysOverdue = calculateDaysOverdue(transaction.due_date)
                    const isSelected = selectedTransaction?.transaction_id === transaction.transaction_id

                    return (
                      <div
                        key={transaction.transaction_id}
                        onClick={() => setSelectedTransaction(transaction)}
                        className={`border rounded-lg p-4 cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-green-500 bg-green-50' 
                            : isOverdue 
                              ? 'border-red-200 bg-red-50 hover:border-red-300' 
                              : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <div className="flex-shrink-0 h-10 w-10">
                                <div className={`h-10 w-10 rounded flex items-center justify-center ${
                                  isOverdue ? 'bg-red-500' : 'bg-blue-500'
                                }`}>
                                  <i className="fas fa-book text-white text-sm"></i>
                                </div>
                              </div>
                              <div className="ml-4 flex-1">
                                <h4 className="text-sm font-medium text-gray-900">
                                  {transaction.book.title}
                                </h4>
                                <p className="text-sm text-gray-600">
                                  by {transaction.book.book_author}
                                </p>
                              </div>
                              {isSelected && (
                                <div className="flex-shrink-0">
                                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                    <i className="fas fa-check mr-1"></i>
                                    Selected
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            <div className="ml-14 space-y-1">
                              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                                <div>
                                  <strong>Accession:</strong> {transaction.copy?.accession_number || 'N/A'}
                                </div>
                                <div>
                                  <strong>Borrower:</strong> {
                                    transaction.user?.full_name ||
                                    transaction.department?.name ||
                                    transaction.office?.name ||
                                    'Unknown borrower'
                                  }
                                </div>
                                <div>
                                  <strong>ID:</strong> {
                                    transaction.user?.account_id ||
                                    transaction.department?.code ||
                                    transaction.office?.code ||
                                    'N/A'
                                  }
                                </div>
                                {transaction.borrower_representative && (
                                  <div className="col-span-2">
                                    <strong>Representative:</strong> {transaction.borrower_representative}
                                  </div>
                                )}
                                <div>
                                  <strong>Borrowed:</strong> {new Date(transaction.borrow_date).toLocaleDateString()}
                                </div>
                                <div>
                                  <strong>Due:</strong> {new Date(transaction.due_date).toLocaleDateString()}
                                </div>
                              </div>
                              
                              {isOverdue && (
                                <div className="text-sm text-red-600 font-medium mt-2">
                                  <i className="fas fa-exclamation-triangle mr-1"></i>
                                  Overdue by {daysOverdue} day{daysOverdue !== 1 ? 's' : ''}
                                  {transaction.penalty && Number(transaction.penalty) > 0 && ` • Penalty: ₱${Number(transaction.penalty).toFixed(2)}`}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}


