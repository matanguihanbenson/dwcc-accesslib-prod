'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { Badge } from '@/components/ui/badge'
import { Pagination } from '@/components/ui/pagination'
import { notify } from '@/lib/notification'
import { useApiSWR } from '@/lib/hooks/useApi'

interface BorrowTransaction {
  transaction_id: number
  borrow_date: string
  due_date: string
  penalty: number
  copy?: { accession_number: string } | null
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
  department?: { department_id: number; name: string; code: string } | null
  office?: { office_id: number; name: string; code: string } | null
  borrower_representative?: string | null
  status: 'ACTIVE' | 'OVERDUE'
}

const SEARCH_OPTIONS: { value: string; label: string; placeholder: string }[] = [
  { value: 'all', label: 'All Fields', placeholder: 'Scan accession or enter any term...' },
  { value: 'accession', label: 'Accession #', placeholder: 'Scan or enter accession number...' },
  { value: 'title', label: 'Title', placeholder: 'Enter book title...' },
  { value: 'author', label: 'Author', placeholder: 'Enter author name...' },
  { value: 'user', label: 'User Name', placeholder: 'Enter user full name...' },
  { value: 'account_id', label: 'ID #', placeholder: 'Enter ID number...' }
]

const CONDITION_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'EXCELLENT', label: 'Excellent', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'GOOD', label: 'Good', color: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'FAIR', label: 'Fair', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { value: 'POOR', label: 'Poor', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'DAMAGED', label: 'Damaged', color: 'bg-red-50 text-red-700 border-red-200' }
]

export default function ReturnBooksPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const preSelectedTxnId = searchParams.get('transaction_id')

  const [searchTerm, setSearchTerm] = useState('')
  const [searchType, setSearchType] = useState('all')
  const [condition, setCondition] = useState('GOOD')
  const [notes, setNotes] = useState('')
  const [selectedTransaction, setSelectedTransaction] = useState<BorrowTransaction | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Pagination for the Active Transactions list. The full
  // `activeTransactions` array is kept as-is so the summary
  // cards (Active / Overdue / Due Today / Penalties) and the
  // auto-select-on-1-result logic continue to operate on the
  // unfiltered set. Only the rendered list is sliced.
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // Debounce ref for auto-lookup when typing
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Build the API endpoint. SWR refetches automatically when the
  // search term / type change, so typing alone updates the list.
  const apiEndpoint = useMemo(() => {
    if (!authReady) return null
    const params = new URLSearchParams()
    params.append('status', 'ACTIVE')
    if (searchTerm.trim()) {
      params.append('search', searchTerm.trim())
      params.append('searchType', searchType)
    }
    return `/api/borrowing-transactions?${params.toString()}`
  }, [authReady, searchTerm, searchType])

  const {
    data: transactionsResponse,
    isLoading: transactionsLoading,
    mutate: refreshTransactions
  } = useApiSWR<any>(apiEndpoint, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true
  })

  // Normalize the various response shapes into an array
  const activeTransactions: BorrowTransaction[] = useMemo(() => {
    if (!transactionsResponse) return []
    if (Array.isArray(transactionsResponse)) return transactionsResponse
    const txns =
      transactionsResponse.transactions ||
      transactionsResponse.data?.transactions ||
      transactionsResponse.data ||
      []
    return Array.isArray(txns) ? txns : []
  }, [transactionsResponse])

  // ---------- Summary stats for the top cards ----------
  // Counts come from the same `activeTransactions` list. Recomputed
  // on every refresh so the cards stay in sync with the list below.
  const stats = useMemo(() => {
    const total = activeTransactions.length
    let overdue = 0
    let dueToday = 0
    let onTime = 0
    let totalPenalty = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    for (const t of activeTransactions) {
      const due = new Date(t.due_date)
      const overdueDays = Math.ceil((Date.now() - due.getTime()) / (1000 * 60 * 60 * 24))
      if (overdueDays > 0) overdue++
      else if (due >= today && due < tomorrow) dueToday++
      else onTime++
      if (t.penalty && Number(t.penalty) > 0) totalPenalty += Number(t.penalty)
    }
    return { total, overdue, dueToday, onTime, totalPenalty }
  }, [activeTransactions])

  // ---------- Auth + role check (STAFF only) ----------
  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') return
      if (status === 'authenticated' && session?.user) {
        if (session.user.role !== 'STAFF') {
          await notify.error('Unauthorized', 'Only staff members can access the return books page')
          router.push('/books')
          return
        }
        setAuthReady(true)
        return
      }
      try {
        const response = await fetch('/api/users/profile', { credentials: 'include' })
        if (response.ok) {
          const userData = await response.json()
          if (userData.role !== 'STAFF') {
            await notify.error('Unauthorized', 'Only staff members can access the return books page')
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
    checkAuth()
  }, [session, status, router])

  // ---------- Pre-select from URL ?transaction_id=xxx ----------
  useEffect(() => {
    if (preSelectedTxnId && activeTransactions.length > 0 && !selectedTransaction) {
      const txnId = parseInt(preSelectedTxnId)
      const txn = activeTransactions.find((t) => t.transaction_id === txnId)
      if (txn) {
        setSelectedTransaction(txn)
        const borrowerName =
          txn.user?.full_name || txn.department?.name || txn.office?.name || 'Unknown borrower'
        notify.info('Transaction Selected', `Book: ${txn.book.title} - Borrower: ${borrowerName}`)
      }
    }
  }, [preSelectedTxnId, activeTransactions, selectedTransaction])

  // ---------- Auto-lookup with debounce ----------
  // After 500ms of no typing, if the input has 3+ chars and
  // there's exactly one result, auto-select it (quality of life
  // for barcode scans and known-IDs).
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    if (!searchTerm.trim()) {
      setSelectedTransaction(null)
      return
    }
    debounceTimerRef.current = setTimeout(() => {
      if (activeTransactions.length === 1 && searchTerm.trim().length >= 3) {
        setSelectedTransaction(activeTransactions[0])
      } else if (activeTransactions.length !== 1) {
        setSelectedTransaction(null)
      }
    }, 500)
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [activeTransactions, searchTerm])

  // Clear selection when the user changes search type so they
  // don't carry a stale selection across contexts.
  useEffect(() => {
    setSelectedTransaction(null)
  }, [searchType])

  const clearSearch = () => {
    setSearchTerm('')
    setSelectedTransaction(null)
    setCurrentPage(1)
  }

  // Reset to page 1 whenever the search term / type / page size
  // changes, so the user doesn't end up stranded on a page that
  // no longer exists after the result set shrinks.
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, searchType, itemsPerPage])

  // The list rendered in the table is a page-sized slice of
  // `activeTransactions`. The full list is still used for the
  // summary cards, the auto-select-on-1-result logic, and the
  // "X active" header.
  const totalTransactions = activeTransactions.length
  const totalPages = Math.max(1, Math.ceil(totalTransactions / itemsPerPage))
  // Clamp the current page into a valid range so a stale value
  // (e.g. after the data shrank) doesn't render an empty table.
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, totalTransactions)
  const pagedTransactions = activeTransactions.slice(startIndex, endIndex)

  // ---------- Process return ----------
  const processReturn = async () => {
    if (!selectedTransaction || submitting) return
    const confirmed = await notify.confirm(
      'Process Return',
      `Are you sure you want to process the return for "${selectedTransaction.book.title}"?`
    )
    if (!confirmed) return

    setSubmitting(true)
    try {
      const response = await fetch(
        `/api/borrowing-transactions/${selectedTransaction.transaction_id}/return`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            condition_on_return: condition,
            notes: notes.trim() || undefined
          })
        }
      )
      if (response.ok) {
        await notify.success('Success', 'Book return processed successfully')
        setSelectedTransaction(null)
        setSearchTerm('')
        setNotes('')
        setCondition('GOOD')
        refreshTransactions()
      } else {
        const errorData = await response.json()
        await notify.error('Error', errorData.error || 'Failed to process return')
      }
    } catch (error) {
      console.error('Return processing error:', error)
      await notify.error('Error', 'Network error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  // Calendar-day difference so a book due on June 21 and
  // checked on June 22 is "1 day overdue" — not 2 (the previous
  // Math.ceil-based math counted the fractional day and bumped
  // it up to 2 whenever the time-of-day put the diff over a
  // 24-hour window). We normalize both sides to midnight before
  // subtracting so the time-of-day doesn't matter.
  const calculateDaysOverdue = (dueDate: string) => {
    const due = new Date(dueDate)
    const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate())
    const now = new Date()
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const diffDays = Math.floor(
      (nowMidnight.getTime() - dueMidnight.getTime()) / (1000 * 60 * 60 * 24)
    )
    return diffDays > 0 ? diffDays : 0
  }

  // ---------- Borrowed-by display helpers ----------
  const getBorrowerName = (t: BorrowTransaction) =>
    t.user?.full_name || t.department?.name || t.office?.name || 'Unknown borrower'
  const getBorrowerId = (t: BorrowTransaction) =>
    t.user?.account_id || t.department?.code || t.office?.code || 'N/A'

  const currentSearchOption =
    SEARCH_OPTIONS.find((o) => o.value === searchType) || SEARCH_OPTIONS[0]

  // ---------- Auth gate ----------
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
    <div className="min-h-screen bg-gray-50">
      {/* Header — same pattern as the rest of the app */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="text-gray-600 hover:text-gray-900 transition-colors p-1.5 -ml-1.5 rounded-md hover:bg-gray-100"
                aria-label="Back"
              >
                <Icon name="fa-arrow-left" size="md" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-800">Return Books</h1>
                <p className="text-sm text-gray-600 mt-0.5">Process book returns and update inventory</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => router.push('/books/borrow')}
                variant="outline"
                className='bg-primary-600 hover:bg-primary-700 py-5 px-4 text-white'
                size="sm"
              >
                <Icon name="fa-plus" size="xs" className="mr-1.5" />
                Borrow
              </Button>
            {/*  */}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        <div className="max-w-6xl mx-auto space-y-4">

          {/* Summary stats — same pattern as lockers / overdue pages */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
                </div>
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Icon name="fa-book" size="md" className="text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Overdue</p>
                  <p className={`text-2xl font-bold mt-1 ${stats.overdue > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {stats.overdue}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  stats.overdue > 0 ? 'bg-red-50' : 'bg-gray-50'
                }`}>
                  <Icon
                    name="fa-exclamation-triangle"
                    size="md"
                    className={stats.overdue > 0 ? 'text-red-600' : 'text-gray-400'}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Due Today</p>
                  <p className={`text-2xl font-bold mt-1 ${stats.dueToday > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                    {stats.dueToday}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  stats.dueToday > 0 ? 'bg-amber-50' : 'bg-gray-50'
                }`}>
                  <Icon
                    name="fa-clock"
                    size="md"
                    className={stats.dueToday > 0 ? 'text-amber-600' : 'text-gray-400'}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Penalties</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    ₱{stats.totalPenalty.toFixed(2)}
                  </p>
                </div>
                <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                  <Icon name="fa-coins" size="md" className="text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Search — single unified field with a filter dropdown */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex flex-col md:flex-row gap-2">
                <div className="relative w-full md:w-48">
                  <Icon
                    name="fa-filter"
                    size="xs"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                  <select
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value)}
                    disabled={submitting}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none"
                  >
                    {SEARCH_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 relative">
                  <Icon
                    name="fa-search"
                    size="xs"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                  <input
                    value={searchTerm}
                    onChange={(e) =>
                      setSearchTerm(
                        searchType === 'accession' ? e.target.value.toUpperCase() : e.target.value
                      )
                    }
                    placeholder={currentSearchOption.placeholder}
                    className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') refreshTransactions()
                    }}
                    disabled={submitting}
                  />
                  {searchTerm && (
                    <button
                      onClick={clearSearch}
                      disabled={submitting}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                      aria-label="Clear search"
                    >
                      <Icon name="fa-times" size="xs" />
                    </button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Process Return — only when a transaction is selected */}
          {selectedTransaction && (() => {
            const daysOverdue = calculateDaysOverdue(selectedTransaction.due_date)
            const hasPenalty = selectedTransaction.penalty && Number(selectedTransaction.penalty) > 0
            return (
              <Card className="border-green-200 shadow-md ring-1 ring-green-100">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-green-50 to-white rounded-t-lg">
                  <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
                      <Icon name="fa-undo" size="xs" className="text-green-600" />
                    </span>
                    Process Return
                  </h3>
                  <button
                    onClick={() => setSelectedTransaction(null)}
                    disabled={submitting}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                    aria-label="Close"
                  >
                    <Icon name="fa-times" />
                  </button>
                </div>
                <CardContent className="pt-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5 pb-5 border-b border-gray-100">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Icon name="fa-book" size="xs" className="text-blue-600" />
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Book</h4>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">
                        {selectedTransaction.book.title}
                      </p>
                      <p className="text-xs text-gray-600">
                        by {selectedTransaction.book.book_author}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 pt-1">
                        <span>
                          <span className="text-gray-400">Accession:</span>{' '}
                          <span className="font-mono font-medium text-gray-700">
                            {selectedTransaction.copy?.accession_number || 'N/A'}
                          </span>
                        </span>
                        {selectedTransaction.book.isbn && (
                          <span>
                            <span className="text-gray-400">ISBN:</span>{' '}
                            <span className="font-mono text-gray-700">{selectedTransaction.book.isbn}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Icon name="fa-user" size="xs" className="text-purple-600" />
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Borrower</h4>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">
                        {getBorrowerName(selectedTransaction)}
                      </p>
                      <p className="text-xs text-gray-600 font-mono">
                        {getBorrowerId(selectedTransaction)}
                      </p>
                      {selectedTransaction.borrower_representative && (
                        <p className="text-xs text-gray-500">
                          <span className="text-gray-400">Rep:</span>{' '}
                          {selectedTransaction.borrower_representative}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 pt-1">
                        <span>
                          <span className="text-gray-400">Borrowed:</span>{' '}
                          {new Date(selectedTransaction.borrow_date).toLocaleDateString()}
                        </span>
                        <span>
                          <span className="text-gray-400">Due:</span>{' '}
                          {new Date(selectedTransaction.due_date).toLocaleDateString()}
                        </span>
                      </div>
                      {daysOverdue > 0 && (
                        <div className="pt-1">
                          <Badge variant="overdue" className="gap-1">
                            <Icon name="fa-exclamation-triangle" size="xs" />
                            Overdue by {daysOverdue} day{daysOverdue !== 1 ? 's' : ''}
                            {hasPenalty ? ` • ₱${Number(selectedTransaction.penalty).toFixed(2)}` : ''}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Return Condition
                      </label>
                      <div className="grid grid-cols-5 gap-1">
                        {CONDITION_OPTIONS.map((c) => {
                          const active = condition === c.value
                          return (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => setCondition(c.value)}
                              disabled={submitting}
                              className={`px-2 py-2 text-xs font-medium rounded border transition-all ${
                                active
                                  ? `${c.color} ring-2 ring-offset-1 ring-blue-400 border-transparent shadow-sm`
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {c.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Notes <span className="text-gray-400 font-normal">(Optional)</span>
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Notes about the book condition..."
                        rows={2}
                        disabled={submitting}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-5">
                    <Button
                      variant="outline"
                      className='px-4 py-5 bg-gray-200 hover:bg-gray-300'
                      onClick={() => setSelectedTransaction(null)}
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={processReturn}
                      disabled={submitting}
                      className="bg-green-600 hover:bg-green-700 text-white py-5 px-4"
                    >
                      {submitting ? (
                        <>
                          <Icon name="fa-spinner" size="xs" className="mr-1.5 fa-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Icon name="fa-check" size="xs" className="mr-1.5" />
                          Confirm Return
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })()}

          {/* Active transactions list */}
          <Card>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center">
                  <Icon name="fa-list" size="xs" className="text-gray-600" />
                </span>
                <h3 className="text-sm font-semibold text-gray-900">
                  {searchTerm.trim()
                    ? `Search Results (${activeTransactions.length})`
                    : `Active Transactions (${activeTransactions.length})`}
                </h3>
                {!searchTerm.trim() && stats.overdue > 0 && (
                  <Badge variant="overdue" className="ml-1">
                    {stats.overdue} overdue
                  </Badge>
                )}
              </div>
            </div>
            <CardContent className="pt-3">
              {transactionsLoading ? (
                <div className="text-center py-12 text-sm text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  Loading transactions...
                </div>
              ) : activeTransactions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Icon name="fa-check-circle" size="xl" className="text-green-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">
                    {searchTerm.trim() ? 'No transactions match your search.' : 'All books have been returned'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {searchTerm.trim()
                      ? 'Try a different keyword or filter'
                      : 'There are no active borrowing transactions at the moment'}
                  </p>
                </div>
              ) : (
                <>
                  <ul className="divide-y divide-gray-100">
                    {pagedTransactions.map((t) => {
                      const daysOverdue = calculateDaysOverdue(t.due_date)
                      const isSelected = selectedTransaction?.transaction_id === t.transaction_id
                      return (
                        <li
                          key={t.transaction_id}
                          onClick={() => setSelectedTransaction(t)}
                          className={`flex items-center gap-3 px-3 py-3 cursor-pointer rounded-md transition-all ${
                            isSelected
                              ? 'bg-blue-50 border border-blue-200 shadow-sm'
                              : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <div
                            className={`flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center ${
                              daysOverdue > 0
                                ? 'bg-red-100 text-red-600'
                                : 'bg-blue-100 text-blue-600'
                            }`}
                          >
                            <Icon name="fa-book" size="md" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {t.book.title}
                              </p>
                              {daysOverdue > 0 && (
                                <Badge variant="overdue" size="sm" className="flex-shrink-0">
                                  Overdue {daysOverdue}d
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate">
                              <span className="font-medium text-gray-700">{getBorrowerName(t)}</span>
                              <span className="mx-1.5 text-gray-300">·</span>
                              <span className="font-mono">{getBorrowerId(t)}</span>
                              <span className="mx-1.5 text-gray-300">·</span>
                              <span className="font-mono">{t.copy?.accession_number || 'N/A'}</span>
                              <span className="mx-1.5 text-gray-300">·</span>
                              Due {new Date(t.due_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            {isSelected ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white">
                                <Icon name="fa-check" size="xs" />
                              </span>
                            ) : (
                              <Icon name="fa-chevron-right" size="xs" className="text-gray-400" />
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>

                  {/* Pagination for the active transactions list. */}
                  <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <label htmlFor="rb-items-per-page" className="text-sm text-gray-600">
                        Per page
                      </label>
                      <select
                        id="rb-items-per-page"
                        value={itemsPerPage}
                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                        className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {[10, 20, 50, 100].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Pagination
                      currentPage={safePage}
                      totalPages={totalPages}
                      totalItems={totalTransactions}
                      itemsPerPage={itemsPerPage}
                      onPageChange={setCurrentPage}
                      className="flex-1 justify-end"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
