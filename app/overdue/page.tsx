'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import OverdueBooksTable from '@/components/overdue/OverdueBooksTable'
import OverdueLockerTable from '@/components/overdue/OverdueLockerTable'
import SendOverdueNotificationModal from '@/components/modals/SendOverdueNotificationModal'
import PaymentHistoryModal from '@/components/modals/PaymentHistoryModal'
import { Pagination } from '@/components/ui/pagination'
import { generateTransactionId } from '@/lib/utils'
import { notify } from '@/lib/notification'
import { UserRole } from '@/types'

interface OverdueBook {
  transaction_id: number
  borrow_date: string
  due_date: string
  penalty: number
  days_overdue: number
  calculated_penalty: number
  remaining_balance: number
  book: {
    title: string
    book_author: string
    category: string
  }
  user?: {
    user_id: number
    full_name: string
    email: string
    user_type: string
    course?: string
    department?: string
    contact_number?: string
    account_id: string
  } | null
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

interface OverdueLocker {
  transaction_id: number
  borrow_time: string
  penalty: number
  hours_used: number
  days_used: number
  calculated_penalty: number
  remaining_balance: number
  locker: {
    locker_number: string
    status: string
  }
  user: {
    user_id: number
    full_name: string
    email: string
    user_type: string
    course?: string
    department?: string
    contact_number?: string
    account_id: string
  }
}

interface OverdueData {
  overdue_books?: OverdueBook[]
  overdue_lockers?: OverdueLocker[]
  summary: {
    total_overdue_books: number
    total_overdue_lockers: number
    total_book_penalties: number
    total_locker_penalties: number
  }
}

export default function OverdueManagementPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [overdueData, setOverdueData] = useState<OverdueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)
  const [activeTab, setActiveTab] = useState<'books' | 'lockers' | 'history' | 'settings'>('books')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [paymentHistory, setPaymentHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all')
  const [historyTypeFilter, setHistoryTypeFilter] = useState('all')
  const [showNotificationModal, setShowNotificationModal] = useState(false)
  const [voidedList, setVoidedList] = useState<any[]>([])
  const [loadingVoided, setLoadingVoided] = useState(false)
  const [showVoidedModal, setShowVoidedModal] = useState(false)
  const [voidedSearch, setVoidedSearch] = useState('')
  // Pagination for the Fine Payment Records table. The summary
  // cards above the table continue to operate on the full
  // filtered set so the totals stay accurate; only the rows
  // actually rendered are sliced for the current page.
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1)
  const [historyItemsPerPage, setHistoryItemsPerPage] = useState(20)
  // Per-row "view detail" modal state for the Payment History
  // table. Same shape as the one used by OverdueBooksTable /
  // OverdueLockerTable so the action column on each surface
  // behaves consistently.
  const [paymentHistoryModal, setPaymentHistoryModal] = useState<{
    isOpen: boolean
    transactionId: number | null
    transactionType: 'BOOK' | 'LOCKER'
  }>({ isOpen: false, transactionId: null, transactionType: 'BOOK' })
  const [fineSettings, setFineSettings] = useState({
    book_fine_per_day: 5,
    locker_fine_per_hour: 20,
    max_book_fine: 100,
    max_locker_fine: 500,
    grace_period_days: 3,
    grace_period_hours: 2,
    grace_period_minutes: 15,
    max_locker_extensions: 1,
  })
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') {
        return
      }

      if (status === 'authenticated' && session?.user) {
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

  const fetchOverdueData = useCallback(async (type: 'all' | 'books' | 'lockers' = 'all') => {
    try {
      setLoading(true)
      
      const response = await fetch(`/api/overdue?type=${type}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setOverdueData(data)
      } else {
        const errorData = await response.text()
        
        if (response.status === 403) {
          router.push('/dashboard')
        } else if (response.status === 401) {
          router.push('/login')
        } else {
          await notify.error('Error', 'Failed to fetch overdue data')
        }
      }
    } catch (error) {
      await notify.error('Error', 'Network error occurred while fetching overdue data')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (authReady) {
      fetchOverdueData()
    }
  }, [authReady, fetchOverdueData])

  const fetchPaymentHistory = useCallback(async () => {
    try {
      setLoadingHistory(true)
      const response = await fetch('/api/overdue/payment-history', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setPaymentHistory(data.settlements || [])
      } else {
      }
    } catch (error) {
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  // Fetch the list of voided overdue penalties. The "View Voided"
  // button on the page header opens a modal that calls this. We
  // also refresh the count badge after a void so the page header
  // badge stays accurate without forcing a full reload.
  const fetchVoided = useCallback(async () => {
    setLoadingVoided(true)
    try {
      const response = await fetch('/api/overdue/voided')
      if (!response.ok) {
        throw new Error(`Failed to fetch voided list (${response.status})`)
      }
      const data = await response.json()
      setVoidedList(Array.isArray(data?.voided) ? data.voided : [])
    } catch (err) {
      console.error('Error fetching voided list:', err)
      setVoidedList([])
    } finally {
      setLoadingVoided(false)
    }
  }, [])

  useEffect(() => {
    if (showVoidedModal) {
      fetchVoided()
    }
  }, [showVoidedModal, fetchVoided])

  // Lightweight count poll: keeps the red badge on the "View Voided"
  // button in sync with voids done from the history tab without
  // forcing a hard refresh. We rely on the API's `count` field,
  // which the endpoint already returns, so the polling payload
  // stays small (server still returns rows up to `limit`, so we
  // cap it to 1 to keep the wire size tiny).
  const [voidedCount, setVoidedCount] = useState(0)
  useEffect(() => {
    if (!authReady) return
    let cancelled = false
    const refreshCount = async () => {
      try {
        const response = await fetch('/api/overdue/voided?limit=1')
        if (!response.ok) return
        const data = await response.json()
        if (cancelled) return
        if (typeof data?.count === 'number') {
          setVoidedCount(data.count)
        }
      } catch {
        // swallow polling errors
      }
    }
    refreshCount()
    const interval = setInterval(refreshCount, 30_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [authReady])

  useEffect(() => {
    if (authReady && activeTab === 'history') {
      fetchPaymentHistory()
    }
    if (authReady && activeTab === 'settings' && session?.user?.role === UserRole.ADMIN) {
      fetchFineSettings()
    }
  }, [authReady, activeTab, fetchPaymentHistory, session])

  const fetchFineSettings = async () => {
    try {
      setLoadingSettings(true)
      const response = await fetch('/api/system-settings', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setFineSettings(data.data.fines)
      }
    } catch (error) {
      await notify.error('Error', 'Failed to load fine settings')
    } finally {
      setLoadingSettings(false)
    }
  }

  const handleSaveFineSettings = async () => {
    try {
      setSavingSettings(true)
      const response = await fetch('/api/system-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fines: fineSettings }),
      })
      if (response.ok) {
        await notify.success('Success', 'Fine settings saved successfully')
      } else {
        const errorData = await response.json()
        await notify.error('Error', errorData.error || 'Failed to save settings')
      }
    } catch (error) {
      await notify.error('Error', 'Network error occurred while saving settings')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleFineSettingChange = (field: string, value: string) => {
    const numValue = parseFloat(value) || 0
    setFineSettings((prev) => ({
      ...prev,
      [field]: numValue,
    }))
  }

  const handleRefresh = () => {
    fetchOverdueData()
    if (activeTab === 'history') {
      fetchPaymentHistory()
    }
  }

  const filteredBooks = overdueData?.overdue_books?.filter(book => {
    const matchesSearch = 
      book.book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (book.user?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (book.user?.account_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.book.book_author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (book.department?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (book.office?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (book.borrower_representative || '').toLowerCase().includes(searchTerm.toLowerCase())

    const matchesFilter = 
      filterType === 'all' ||
      (filterType === 'student' && book.user?.user_type === 'STUDENT') ||
      (filterType === 'employee' && book.user?.user_type === 'EMPLOYEE') ||
      (filterType === 'critical' && book.days_overdue > 30)

    return matchesSearch && matchesFilter
  }) || []

  const filteredLockers = overdueData?.overdue_lockers?.filter(locker => {
    const matchesSearch = 
      locker.locker.locker_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      locker.user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      locker.user.account_id.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesFilter = 
      filterType === 'all' ||
      (filterType === 'student' && locker.user.user_type === 'STUDENT') ||
      (filterType === 'employee' && locker.user.user_type === 'EMPLOYEE') ||
      (filterType === 'critical' && locker.days_used > 7)

    return matchesSearch && matchesFilter
  }) || []

  const filteredPaymentHistory = paymentHistory.filter(record => {
    const matchesSearch =
      record.user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.user.account_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (record.transaction_type === 'BOOK' && record.transaction_details.book_title?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (record.transaction_type === 'LOCKER' && record.transaction_details.locker_number?.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = historyStatusFilter === 'all' || record.status === historyStatusFilter
    const matchesType = historyTypeFilter === 'all' || record.transaction_type === historyTypeFilter

    return matchesSearch && matchesStatus && matchesType
  })

  // Pagination over the filtered payment history. Reset to
  // page 1 when any filter or the page size changes so the
  // user doesn't end up stranded on a page that no longer
  // exists after the result set shrinks. The summary cards
  // above the table continue to use the full filtered set so
  // their totals stay accurate.
  useEffect(() => {
    setHistoryCurrentPage(1)
  }, [searchTerm, historyStatusFilter, historyTypeFilter, historyItemsPerPage, activeTab])

  const historyTotal = filteredPaymentHistory.length
  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / historyItemsPerPage))
  const historySafePage = Math.min(historyCurrentPage, historyTotalPages)
  const historyStartIndex = (historySafePage - 1) * historyItemsPerPage
  const historyEndIndex = Math.min(
    historyStartIndex + historyItemsPerPage,
    historyTotal
  )
  const pagedPaymentHistory = filteredPaymentHistory.slice(
    historyStartIndex,
    historyEndIndex
  )

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
                Overdue Management
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Monitor and manage overdue books and locker usage
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNotificationModal(true)}
                disabled={loading || !overdueData || (
                  overdueData.summary.total_overdue_books === 0 && 
                  overdueData.summary.total_overdue_lockers === 0
                )}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Send overdue notification emails"
              >
                <i className="fas fa-envelope"></i>
                Send Notifications
              </button>
              <button
                onClick={() => router.push('/user-penalties')}
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
              >
                <i className="fas fa-user-circle"></i>
                User Penalty Summary
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {overdueData && (
        <div className="px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-2xl font-bold text-red-600">
                {overdueData.summary.total_overdue_books}
              </div>
              <div className="text-sm text-gray-600">Overdue Books</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-2xl font-bold text-orange-600">
                {overdueData.summary.total_overdue_lockers}
              </div>
              <div className="text-sm text-gray-600">Overdue Lockers</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-2xl font-bold text-red-600">
                ₱{overdueData.summary.total_book_penalties.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Book Penalties</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-2xl font-bold text-orange-600">
                ₱{overdueData.summary.total_locker_penalties.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Locker Penalties</div>
            </div>
          </div>

          {/* Second row: financial totals — Total Fines, Paid,
              Remaining Unpaid. Sourced from the payment history
              so the numbers stay consistent with the "Payment
              History" tab. */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {(() => {
              const totalFines =
                Number(overdueData.summary.total_book_penalties || 0) +
                Number(overdueData.summary.total_locker_penalties || 0)
              const paid = paymentHistory.reduce(
                (sum, r) => sum + Number(r.amount_paid || 0),
                0
              )
              const remaining = Math.max(0, totalFines - paid)
              return (
                <>
                  <div className="bg-gradient-to-br from-primary-50 to-white p-4 rounded-lg shadow-sm border border-primary-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium text-primary-600 uppercase tracking-wide">
                          Total Fines
                        </div>
                        <div className="text-2xl font-bold text-primary-700 mt-1">
                          ₱{totalFines.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Book + Locker penalties
                        </div>
                      </div>
                      <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                        <i className="fas fa-coins text-primary-600"></i>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-white p-4 rounded-lg shadow-sm border border-green-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium text-green-600 uppercase tracking-wide">
                          Paid
                        </div>
                        <div className="text-2xl font-bold text-green-700 mt-1">
                          ₱{paid.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {totalFines > 0
                            ? `${Math.round((paid / totalFines) * 100)}% of total`
                            : 'No fines recorded'}
                        </div>
                      </div>
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <i className="fas fa-check-circle text-green-600"></i>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`p-4 rounded-lg shadow-sm border bg-gradient-to-br ${
                      remaining > 0
                        ? 'from-red-50 to-white border-red-100'
                        : 'from-gray-50 to-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div
                          className={`text-xs font-medium uppercase tracking-wide ${
                            remaining > 0 ? 'text-red-600' : 'text-gray-500'
                          }`}
                        >
                          Remaining Unpaid
                        </div>
                        <div
                          className={`text-2xl font-bold mt-1 ${
                            remaining > 0 ? 'text-red-700' : 'text-gray-700'
                          }`}
                        >
                          ₱{remaining.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {totalFines > 0
                            ? `${Math.round((remaining / totalFines) * 100)}% still outstanding`
                            : 'All settled'}
                        </div>
                      </div>
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          remaining > 0 ? 'bg-red-100' : 'bg-gray-100'
                        }`}
                      >
                        <i
                          className={`fas ${
                            remaining > 0
                              ? 'fa-exclamation-circle text-red-600'
                              : 'fa-check text-gray-500'
                          }`}
                        ></i>
                      </div>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-6 py-4">
        {/* Tabs + "View Voided" action button */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex items-end justify-between">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('books')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'books'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Overdue Books ({filteredBooks.length})
              </button>
              <button
                onClick={() => setActiveTab('lockers')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'lockers'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Overdue Lockers ({filteredLockers.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'history'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Payment History ({paymentHistory.length})
              </button>
              {session?.user?.role === UserRole.ADMIN && (
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'settings'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <i className="fas fa-cog mr-1"></i>
                  Fine Settings
                </button>
              )}
            </nav>

            {/* "View Voided" opens a modal listing every penalty
                that has been voided by an admin. Useful for audit
                review of who erased which borrower's fine, and
                why. Available to ADMIN and STAFF since both can
                trigger the void action on the history page. */}
            <button
              onClick={() => setShowVoidedModal(true)}
              className="mb-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 text-xs font-medium transition-colors"
              title="View all voided overdue penalties"
            >
              <i className="fas fa-ban"></i>
              View Voided
              {voidedCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white min-w-[18px]">
                  {voidedCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        {activeTab !== 'settings' && (
          <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
            <div className="flex flex-col lg:flex-row gap-3">
              {/* Search - Always visible */}
              <div className="flex-1">
                <div className="relative">
                  <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                  <input
                    type="text"
                    placeholder={
                      activeTab === 'books' ? "Search by name, ID, book title, author..." :
                      activeTab === 'lockers' ? "Search by name, ID, locker number..." :
                      "Search by name, ID, item..."
                    }
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Filters for Books/Lockers */}
              {(activeTab === 'books' || activeTab === 'lockers') && (
                <div className="flex gap-3">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="all">All Users</option>
                    <option value="student">Students Only</option>
                    <option value="employee">Employees Only</option>
                    <option value="critical">
                      {activeTab === 'books' ? 'Critical (30+ days)' : 'Critical (7+ days)'}
                    </option>
                  </select>
                </div>
              )}

              {/* Filters for Payment History */}
              {activeTab === 'history' && (
                <div className="flex gap-3">
                  <select
                    value={historyStatusFilter}
                    onChange={(e) => setHistoryStatusFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="all">All Status</option>
                    <option value="SETTLED">Settled</option>
                    <option value="PARTIAL">Partial</option>
                    <option value="PENDING">Pending</option>
                  </select>
                  <select
                    value={historyTypeFilter}
                    onChange={(e) => setHistoryTypeFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="all">All Types</option>
                    <option value="BOOK">Books</option>
                    <option value="LOCKER">Lockers</option>
                  </select>
                </div>
              )}

              {/* Clear Filters Button */}
              {(searchTerm || filterType !== 'all' || historyStatusFilter !== 'all' || historyTypeFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('')
                    setFilterType('all')
                    setHistoryStatusFilter('all')
                    setHistoryTypeFilter('all')
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                >
                  <i className="fas fa-times"></i>
                  Clear
                </button>
              )}
            </div>

            {/* Active Filters Display */}
            {(searchTerm || filterType !== 'all' || historyStatusFilter !== 'all' || historyTypeFilter !== 'all') && (
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                <span className="text-xs text-gray-500">Active filters:</span>
                {searchTerm && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                    <i className="fas fa-search"></i>
                    "{searchTerm}"
                  </span>
                )}
                {filterType !== 'all' && (activeTab === 'books' || activeTab === 'lockers') && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-700 rounded text-xs">
                    <i className="fas fa-user"></i>
                    {filterType === 'student' ? 'Students' : filterType === 'employee' ? 'Employees' : 'Critical'}
                  </span>
                )}
                {historyStatusFilter !== 'all' && activeTab === 'history' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                    <i className="fas fa-check-circle"></i>
                    {historyStatusFilter}
                  </span>
                )}
                {historyTypeFilter !== 'all' && activeTab === 'history' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
                    <i className={`fas fa-${historyTypeFilter === 'BOOK' ? 'book' : 'key'}`}></i>
                    {historyTypeFilter}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Content based on active tab */}
        {loading && activeTab !== 'history' && activeTab !== 'settings' ? (
          <div className="p-8 text-center">
            <div className="text-gray-500">Loading overdue data...</div>
          </div>
        ) : (
          <>
            {activeTab === 'books' && (
              <OverdueBooksTable 
                books={filteredBooks}
                onRefresh={handleRefresh}
                userEmail={session?.user?.email}
              />
            )}
            {activeTab === 'lockers' && (
              <OverdueLockerTable 
                lockers={filteredLockers}
                onRefresh={handleRefresh}
                userEmail={session?.user?.email}
              />
            )}
            {activeTab === 'history' && (
              <div className="space-y-6">
                {/* Summary Cards */}
                {!loadingHistory && filteredPaymentHistory.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg shadow-sm border p-4">
                      <div className="text-sm text-gray-600 mb-1">Total Fines Issued</div>
                      <div className="text-2xl font-bold text-gray-900">
                        ₱{filteredPaymentHistory.reduce((sum, r) => sum + r.penalty_amount, 0).toFixed(2)}
                      </div>
                      {filteredPaymentHistory.length < paymentHistory.length && (
                        <div className="text-xs text-gray-500 mt-1">of ₱{paymentHistory.reduce((sum, r) => sum + r.penalty_amount, 0).toFixed(2)} total</div>
                      )}
                    </div>
                    <div className="bg-white rounded-lg shadow-sm border p-4">
                      <div className="text-sm text-gray-600 mb-1">Total Paid</div>
                      <div className="text-2xl font-bold text-green-600">
                        ₱{filteredPaymentHistory.reduce((sum, r) => sum + r.amount_paid, 0).toFixed(2)}
                      </div>
                      {filteredPaymentHistory.length < paymentHistory.length && (
                        <div className="text-xs text-gray-500 mt-1">of ₱{paymentHistory.reduce((sum, r) => sum + r.amount_paid, 0).toFixed(2)} total</div>
                      )}
                    </div>
                    <div className="bg-white rounded-lg shadow-sm border p-4">
                      <div className="text-sm text-gray-600 mb-1">Outstanding Balance</div>
                      <div className="text-2xl font-bold text-red-600">
                        ₱{filteredPaymentHistory.reduce((sum, r) => sum + r.remaining_balance, 0).toFixed(2)}
                      </div>
                      {filteredPaymentHistory.length < paymentHistory.length && (
                        <div className="text-xs text-gray-500 mt-1">of ₱{paymentHistory.reduce((sum, r) => sum + r.remaining_balance, 0).toFixed(2)} total</div>
                      )}
                    </div>
                    <div className="bg-white rounded-lg shadow-sm border p-4">
                      <div className="text-sm text-gray-600 mb-1">Showing Records</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {filteredPaymentHistory.length}
                      </div>
                      {filteredPaymentHistory.length < paymentHistory.length && (
                        <div className="text-xs text-gray-500 mt-1">of {paymentHistory.length} total</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Payment Records Table */}
                <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                  <div className="px-6 py-4 border-b bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-900">Fine Payment Records</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Track all fine payments and outstanding balances for overdue items
                    </p>
                  </div>
                  {loadingHistory ? (
                    <div className="p-8 text-center">
                      <div className="text-gray-500">Loading payment history...</div>
                    </div>
                  ) : filteredPaymentHistory.length === 0 ? (
                    <div className="p-8 text-center">
                      <div className="text-gray-500">
                        {paymentHistory.length === 0 ? 'No payment records found' : 'No records match your filters'}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        {paymentHistory.length === 0 
                          ? 'Payment records will appear here when fines are paid'
                          : 'Try adjusting your search or filter criteria'}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Payment Information
                              <div className="text-[10px] font-normal text-gray-400 normal-case">Date &amp; Payment ID</div>
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              User / Borrower
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Overdue Item
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              <div>Total Fine</div>
                              <div className="text-[10px] font-normal text-gray-400 normal-case">Original amount</div>
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              <div>Amount Paid</div>
                              <div className="text-[10px] font-normal text-gray-400 normal-case">Payment made</div>
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              <div>Remaining</div>
                              <div className="text-[10px] font-normal text-gray-400 normal-case">Still owed</div>
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Payment Status
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pagedPaymentHistory.map((record) => (
                          <tr key={record.settlement_id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                {/* Payment Information: payment date
                                    on top, generated payment ID
                                    (BT-YYMM-NNNNNN) below in
                                    monospace so it stands out as a
                                    reference code. */}
                                <div className="text-gray-900 font-medium">
                                  {new Date(record.created_at).toLocaleDateString()}
                                </div>
                                <div className="text-[11px] text-gray-500 font-mono">
                                  {generateTransactionId(
                                    record.transaction_id,
                                    record.created_at
                                      ? new Date(record.created_at)
                                      : undefined
                                  )}
                                </div>
                                <div className="text-[10px] text-gray-400">
                                  {new Date(record.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-sm font-medium text-gray-900">{record.user.full_name}</div>
                                <div className="text-xs text-gray-500">{record.user.account_id}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    record.transaction_type === 'BOOK' ? 'bg-primary-100 text-primary-800' : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    <i className={`fas fa-${record.transaction_type === 'BOOK' ? 'book' : 'key'} mr-1`}></i>
                                    {record.transaction_type}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-900 mt-1">
                                  {record.transaction_type === 'BOOK'
                                    ? record.transaction_details.book_title
                                    : `Locker #${record.transaction_details.locker_number}`}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                                <div className="text-gray-900 font-medium">₱{record.penalty_amount.toFixed(2)}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                                <div className="text-green-600 font-bold">₱{record.amount_paid.toFixed(2)}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                                <div className={`font-bold ${record.remaining_balance > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                  ₱{record.remaining_balance.toFixed(2)}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-center">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                  record.status === 'SETTLED' ? 'bg-green-100 text-green-800' :
                                  record.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {record.status === 'SETTLED' && <i className="fas fa-check-circle mr-1"></i>}
                                  {record.status === 'PARTIAL' && <i className="fas fa-clock mr-1"></i>}
                                  {record.status === 'PENDING' && <i className="fas fa-exclamation-circle mr-1"></i>}
                                  {record.status}
                                </span>
                                {record.status === 'PARTIAL' && (
                                  <div className="text-[10px] text-gray-500 mt-1">
                                    {((record.amount_paid / record.penalty_amount) * 100).toFixed(0)}% paid
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-center">
                                {/* Actions: opens the existing
                                    PaymentHistoryModal so the user
                                    can inspect the full timeline,
                                    progress bar, and processed-by
                                    info for the row's underlying
                                    transaction. Mirrors the
                                    "View Payment History" icon
                                    button used by the Books and
                                    Lockers tables. */}
                                <button
                                  onClick={() =>
                                    setPaymentHistoryModal({
                                      isOpen: true,
                                      transactionId: record.transaction_id,
                                      transactionType: record.transaction_type
                                    })
                                  }
                                  className="text-primary-600 hover:text-primary-900 px-2 py-1 text-xs border border-primary-600 hover:bg-primary-50 rounded inline-flex items-center gap-1"
                                  title="View payment history / detail"
                                >
                                <i className="fas fa-history"></i>
                                <span>View</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Pagination for the payment history table. The
                      summary cards above the table keep using the
                      full filtered set so their totals stay
                      accurate; only the rendered rows are sliced. */}
                  {filteredPaymentHistory.length > 0 && (
                    <div className="px-4 py-3 border-t bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <label htmlFor="ph-items-per-page" className="text-sm text-gray-600">
                          Per page
                        </label>
                        <select
                          id="ph-items-per-page"
                          value={historyItemsPerPage}
                          onChange={(e) => setHistoryItemsPerPage(Number(e.target.value))}
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
                        currentPage={historySafePage}
                        totalPages={historyTotalPages}
                        totalItems={historyTotal}
                        itemsPerPage={historyItemsPerPage}
                        onPageChange={setHistoryCurrentPage}
                        className="flex-1 justify-end"
                      />
                    </div>
                  )}
                </div>


              </div>
            )}
            {activeTab === 'settings' && session?.user?.role === UserRole.ADMIN && (
              <div className="bg-white rounded-lg shadow-sm border">
                {loadingSettings ? (
                  <div className="p-8 text-center">
                    <div className="text-gray-500">Loading fine settings...</div>
                  </div>
                ) : (
                  <div className="p-6">
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">
                        Fine System Configuration
                      </h3>
                      <p className="text-sm text-gray-600">
                        Configure fine rates for books and lockers, grace periods, and maximum fine amounts.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">
                          Book Fine per Day (₱)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={fineSettings.book_fine_per_day}
                          onChange={(e) => handleFineSettingChange('book_fine_per_day', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">
                          Max Book Fine (₱)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={fineSettings.max_book_fine}
                          onChange={(e) => handleFineSettingChange('max_book_fine', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">
                          Book Grace Period (days)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={fineSettings.grace_period_days}
                          onChange={(e) => handleFineSettingChange('grace_period_days', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">
                          Locker Fine per Hour (₱)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={fineSettings.locker_fine_per_hour}
                          onChange={(e) => handleFineSettingChange('locker_fine_per_hour', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">
                          Max Locker Fine (₱)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={fineSettings.max_locker_fine}
                          onChange={(e) => handleFineSettingChange('max_locker_fine', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">
                          Locker Grace Period (hours)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={fineSettings.grace_period_hours}
                          onChange={(e) => handleFineSettingChange('grace_period_hours', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">
                          Additional Grace Period (minutes)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={fineSettings.grace_period_minutes}
                          onChange={(e) => handleFineSettingChange('grace_period_minutes', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">
                          Max Locker Extensions per Transaction
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={fineSettings.max_locker_extensions}
                          onChange={(e) => handleFineSettingChange('max_locker_extensions', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
                      <h4 className="font-medium text-gray-900 mb-2">
                        <i className="fas fa-info-circle text-blue-600 mr-2"></i>
                        Current Fine Structure:
                      </h4>
                      <div className="text-sm text-gray-700 space-y-1">
                        <p>
                          <strong>Books:</strong> ₱{fineSettings.book_fine_per_day}/day after {fineSettings.grace_period_days} day(s) grace period (Max: ₱{fineSettings.max_book_fine})
                        </p>
                        <p>
                          <strong>Lockers:</strong> ₱{fineSettings.locker_fine_per_hour}/hour after {fineSettings.grace_period_hours}h {fineSettings.grace_period_minutes}m grace period (Max: ₱{fineSettings.max_locker_fine})
                        </p>
                        <p>
                          <strong>Locker Extensions:</strong> Up to {fineSettings.max_locker_extensions} extension(s) allowed per locker transaction
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex justify-end">
                      <button
                        onClick={handleSaveFineSettings}
                        disabled={savingSettings}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {savingSettings ? (
                          <>
                            <i className="fas fa-spinner fa-spin"></i>
                            Saving...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-save"></i>
                            Save Settings
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Notification Modal */}
      <SendOverdueNotificationModal
        isOpen={showNotificationModal}
        onClose={() => {
          setShowNotificationModal(false)
          handleRefresh() // Refresh data after sending notifications
        }}
        overdueBooks={overdueData?.overdue_books || []}
        overdueLockers={overdueData?.overdue_lockers || []}
        userEmail={session?.user?.email || null}
      />

      {/* Per-row payment detail modal. Triggered by the "View"
          button in the Payment History table's Actions column.
          Same component used by the Books / Lockers tables so
          the experience is identical across surfaces. */}
      {paymentHistoryModal.isOpen && paymentHistoryModal.transactionId && (
        <PaymentHistoryModal
          isOpen={paymentHistoryModal.isOpen}
          onClose={() =>
            setPaymentHistoryModal({
              isOpen: false,
              transactionId: null,
              transactionType: 'BOOK'
            })
          }
          transactionId={paymentHistoryModal.transactionId}
          transactionType={paymentHistoryModal.transactionType}
        />
      )}

      {/* View Voided Modal: lists every overdue penalty that has
          been voided by an admin/staff. Reads from
          /api/overdue/voided. The "View Voided" button at the top
          of the page toggles this; we also call `fetchVoided()`
          whenever the modal is opened. */}
      {showVoidedModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowVoidedModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <i className="fas fa-ban text-red-600"></i>
                <h2 className="text-lg font-semibold text-gray-900">
                  Voided Overdue Penalties
                </h2>
                <span className="text-xs text-gray-500">
                  ({voidedList.length})
                </span>
              </div>
              <button
                onClick={() => setShowVoidedModal(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                  <input
                    type="text"
                    placeholder="Search by borrower name, ID, reason, or voided-by..."
                    value={voidedSearch}
                    onChange={(e) => setVoidedSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <button
                  onClick={fetchVoided}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  title="Refresh voided list"
                >
                  <i className="fas fa-rotate"></i>
                  Refresh
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingVoided ? (
                <div className="flex items-center justify-center py-16 text-gray-500">
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Loading voided transactions...
                </div>
              ) : voidedList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <i className="fas fa-inbox text-3xl mb-2"></i>
                  <p>No voided transactions found.</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Borrower</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Type</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Txn #</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600">Original Penalty</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Reason</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Voided By</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Voided At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {voidedList
                      .filter((v) => {
                        if (!voidedSearch.trim()) return true
                        const q = voidedSearch.toLowerCase()
                        const haystack = [
                          v.borrower?.full_name,
                          v.borrower?.account_id,
                          v.borrower?.email,
                          v.reason,
                          v.voided_by?.full_name,
                          v.voided_by?.account_id,
                          v.transaction_type,
                          String(v.transaction_id)
                        ]
                          .filter(Boolean)
                          .join(' ')
                          .toLowerCase()
                        return haystack.includes(q)
                      })
                      .map((v) => (
                        <tr key={v.settlement_id} className="hover:bg-gray-50">
                          <td className="px-4 py-2">
                            {v.borrower ? (
                              <div>
                                <div className="font-medium text-gray-900">
                                  {v.borrower.full_name || '—'}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {v.borrower.account_id}
                                  {v.borrower.user_type ? ` · ${v.borrower.user_type}` : ''}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400">Unknown</span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                              v.transaction_type === 'BOOK'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-primary-100 text-primary-700'
                            }`}>
                              <i className={`fas ${v.transaction_type === 'BOOK' ? 'fa-book' : 'fa-lock'}`}></i>
                              {v.transaction_type}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-600">#{v.transaction_id}</td>
                          <td className="px-4 py-2 text-right">
                            {Number(v.penalty_amount) > 0
                              ? `₱${Number(v.penalty_amount).toFixed(2)}`
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-2 max-w-xs">
                            <div className="truncate" title={v.reason}>
                              {v.reason || <span className="text-gray-400">(no reason given)</span>}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            {v.voided_by ? (
                              <div>
                                <div className="text-gray-900">{v.voided_by.full_name || '—'}</div>
                                <div className="text-xs text-gray-500">{v.voided_by.account_id}</div>
                              </div>
                            ) : (
                              <span className="text-gray-400">Unknown</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-gray-600">
                            {v.voided_at ? new Date(v.voided_at).toLocaleString() : '—'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-3 border-t bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
              <span>
                Showing the most recent voided penalties. The audit log retains the full history.
              </span>
              <button
                onClick={() => setShowVoidedModal(false)}
                className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
