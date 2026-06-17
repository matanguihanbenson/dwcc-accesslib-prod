'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { notify } from '@/lib/notification'

interface PenaltyDetail {
  settlement_id: number | null
  transaction_id: number
  transaction_type: 'BOOK' | 'LOCKER'
  item_name: string
  item_author?: string
  item_location?: string
  penalty_amount: number
  amount_paid: number
  remaining_balance: number
  status: 'PENDING' | 'PARTIAL' | 'SETTLED'
  due_date?: string
  return_date?: string | null
  borrow_time?: string
  return_time?: string | null
  created_at: string
  is_returned?: boolean
  hours_overdue?: number
}

interface UserPenaltyData {
  user: {
    full_name: string
    account_id: string
    email: string
    user_type: string
  } | null
  book_penalties: PenaltyDetail[]
  locker_penalties: PenaltyDetail[]
  summary: {
    total_book_penalties: number
    total_locker_penalties: number
    total_penalties: number
    book_count: number
    locker_count: number
    total_count: number
  }
}

export default function UserPenaltiesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialUserId = searchParams.get('user_id')
  const initialAccountId = searchParams.get('account_id')

  const [userIdInput, setUserIdInput] = useState(initialAccountId || '')
  const [userId, setUserId] = useState<number | null>(initialUserId ? parseInt(initialUserId) : null)
  const [summaryData, setSummaryData] = useState<UserPenaltyData | null>(null)
  const [loading, setLoading] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [selectedSettlements, setSelectedSettlements] = useState<number[]>([])
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') return

      if (status === 'authenticated' && session?.user) {
        console.log('Session ready for user penalties')
        setAuthReady(true)
      } else {
        router.push('/login')
      }
    }

    checkAuth()
  }, [session, status, router])

  useEffect(() => {
    if (authReady && initialUserId && !isNaN(parseInt(initialUserId))) {
      fetchUserSummary(parseInt(initialUserId))
    }
  }, [authReady, initialUserId])

  const fetchUserSummary = async (uid: number) => {
    if (!uid || isNaN(uid)) {
      notify.error('Error', 'Invalid user ID')
      return
    }
    
    setLoading(true)
    try {
      console.log('Fetching summary for user ID:', uid)
      const response = await fetch(`/api/overdue/user-summary/${uid}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setSummaryData(data.data)
        setUserId(uid)
        // Pre-select all pending penalties (use settlement_id or transaction_id as fallback)
        const allIds = [
          ...data.data.book_penalties.map((p: any) => p.settlement_id || p.transaction_id),
          ...data.data.locker_penalties.map((p: any) => p.settlement_id || p.transaction_id)
        ]
        setSelectedSettlements(allIds)
      } else {
        const error = await response.json()
        notify.error('Error', error.error || 'Failed to fetch user summary')
        setSummaryData(null)
      }
    } catch (error) {
      notify.error('Error', 'Failed to load user penalty summary')
      setSummaryData(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userIdInput.trim()) {
      notify.error('Error', 'Please enter a User ID or ID Number')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/staff/users/lookup?account_id=${encodeURIComponent(userIdInput.trim())}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const result = await response.json()
        console.log('User lookup result:', result)
        
        const user = result.data?.user || result.user || result.data
        console.log('Extracted user object:', user)
        
        if (user && user.user_id && !isNaN(user.user_id)) {
          const numericUserId = typeof user.user_id === 'string' ? parseInt(user.user_id) : user.user_id
          fetchUserSummary(numericUserId)
        } else {
          notify.error('Error', 'User ID not found in response')
          setLoading(false)
        }
      } else {
        notify.error('Error', 'User not found')
        setLoading(false)
      }
    } catch (error) {
      console.error('Search error:', error)
      notify.error('Error', 'Failed to search for user')
      setLoading(false)
    }
  }

  const toggleSettlement = (settlementId: number | null, transactionId: number) => {
    // Use transaction_id as identifier (settlement_id might be null for unreturned items)
    const identifier = settlementId || transactionId
    setSelectedSettlements(prev =>
      prev.includes(identifier)
        ? prev.filter(id => id !== identifier)
        : [...prev, identifier]
    )
  }

  const toggleSelectAll = () => {
    if (!summaryData) return
    const allIds = [
      ...summaryData.book_penalties.map((p: any) => p.settlement_id || p.transaction_id),
      ...summaryData.locker_penalties.map((p: any) => p.settlement_id || p.transaction_id)
    ]
    setSelectedSettlements(prev => 
      prev.length === allIds.length ? [] : allIds
    )
  }

  const calculateSelectedTotal = () => {
    if (!summaryData) return 0
    const bookTotal = summaryData.book_penalties
      .filter((p: any) => selectedSettlements.includes(p.settlement_id || p.transaction_id))
      .reduce((sum: number, p: any) => sum + p.remaining_balance, 0)
    const lockerTotal = summaryData.locker_penalties
      .filter((p: any) => selectedSettlements.includes(p.settlement_id || p.transaction_id))
      .reduce((sum: number, p: any) => sum + p.remaining_balance, 0)
    return bookTotal + lockerTotal
  }

  const handleBulkPayment = async () => {
    if (selectedSettlements.length === 0) {
      notify.error('Error', 'Please select at least one penalty to pay')
      return
    }

    const amount = parseFloat(paymentAmount)
    if (!amount || amount <= 0) {
      notify.error('Error', 'Please enter a valid payment amount')
      return
    }

    const selectedTotal = calculateSelectedTotal()
    if (amount > selectedTotal) {
      notify.error('Error', `Payment amount cannot exceed selected total (₱${selectedTotal.toFixed(2)})`)
      return
    }

    setIsProcessing(true)
    try {
      const response = await fetch('/api/overdue/bulk-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: userId,
          settlement_ids: selectedSettlements,
          payment_amount: amount,
          payment_method: paymentMethod
        })
      })

      if (response.ok) {
        const result = await response.json()
        notify.success('Success', result.message)
        
        // Refresh summary
        if (userId) {
          await fetchUserSummary(userId)
        }
        
        // Reset form
        setPaymentAmount('')
        setSelectedSettlements([])
      } else {
        const error = await response.json()
        notify.error('Error', error.error || 'Failed to process payment')
      }
    } catch (error) {
      notify.error('Error', 'Failed to process payment')
    } finally {
      setIsProcessing(false)
    }
  }

  if (!authReady || status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-3"></i>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="text-gray-600 hover:text-gray-800 p-1"
              >
                <i className="fas fa-arrow-left"></i>
              </button>
              <h1 className="text-xl font-semibold text-gray-800">User Penalty Summary</h1>
            </div>
            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
              {session?.user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-4 max-w-5xl">
        {/* Search Section */}
        <div className="bg-white rounded border shadow-sm p-4 mb-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
              placeholder="Enter ID Number or User ID"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
            >
              <i className="fas fa-search mr-2"></i>
              Search
            </button>
          </form>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded border shadow-sm p-8 text-center">
            <i className="fas fa-spinner fa-spin text-3xl text-blue-600 mb-2"></i>
            <p className="text-gray-600 text-sm">Loading...</p>
          </div>
        )}

        {/* User Summary Data */}
        {!loading && summaryData && (
          <>
            {/* User Info Card */}
            <div className="bg-white rounded border shadow-sm p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{summaryData.user?.full_name}</h2>
                  <p className="text-sm text-gray-600">{summaryData.user?.account_id} • {summaryData.user?.user_type}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-red-600">₱{summaryData.summary.total_penalties.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">Total Due</div>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-red-50 border border-red-200 rounded p-2 text-center">
                  <div className="text-lg font-semibold text-red-600">{summaryData.summary.book_count}</div>
                  <div className="text-xs text-gray-600">Books</div>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded p-2 text-center">
                  <div className="text-lg font-semibold text-orange-600">{summaryData.summary.locker_count}</div>
                  <div className="text-xs text-gray-600">Lockers</div>
                </div>
              </div>
            </div>

            {/* Penalties List */}
            {summaryData.summary.total_count > 0 ? (
              <div className="bg-white rounded border shadow-sm p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Penalty Details</h3>
                  <button
                    onClick={toggleSelectAll}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <i className="fas fa-check-square mr-1"></i>
                    {selectedSettlements.length === (summaryData.book_penalties.length + summaryData.locker_penalties.length) ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="space-y-2">
                  {/* Book Penalties */}
                  {summaryData.book_penalties.length > 0 && (
                    <>
                      <div className="text-xs font-medium text-gray-500 px-2 py-1 bg-gray-50 rounded">
                        <i className="fas fa-book text-red-500 mr-1"></i>
                        Books ({summaryData.book_penalties.length})
                      </div>
                      {summaryData.book_penalties.map((penalty) => {
                        const identifier = penalty.settlement_id || penalty.transaction_id
                        return (
                          <div
                            key={identifier}
                            className={`border rounded p-3 cursor-pointer transition-colors ${
                              selectedSettlements.includes(identifier)
                                ? 'border-blue-400 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => toggleSettlement(penalty.settlement_id, penalty.transaction_id)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={selectedSettlements.includes(identifier)}
                                  onChange={() => {}}
                                  className="mt-0.5 cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm text-gray-800 truncate">{penalty.item_name}</div>
                                  {penalty.item_author && (
                                    <div className="text-xs text-gray-500 truncate">by {penalty.item_author}</div>
                                  )}
                                  <div className="flex items-center gap-2 mt-1">
                                    {!penalty.is_returned && (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">
                                        NOT RETURNED
                                      </span>
                                    )}
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                      penalty.status === 'PARTIAL' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                      {penalty.status}
                                    </span>
                                    {penalty.amount_paid > 0 && (
                                      <span className="text-xs text-gray-500">Paid: ₱{penalty.amount_paid.toFixed(2)}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-lg font-bold text-red-600">₱{penalty.remaining_balance.toFixed(2)}</div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}

                  {/* Locker Penalties */}
                  {summaryData.locker_penalties.length > 0 && (
                    <>
                      <div className="text-xs font-medium text-gray-500 px-2 py-1 bg-gray-50 rounded">
                        <i className="fas fa-key text-orange-500 mr-1"></i>
                        Lockers ({summaryData.locker_penalties.length})
                      </div>
                      {summaryData.locker_penalties.map((penalty) => {
                        const identifier = penalty.settlement_id || penalty.transaction_id
                        return (
                          <div
                            key={identifier}
                            className={`border rounded p-3 cursor-pointer transition-colors ${
                              selectedSettlements.includes(identifier)
                                ? 'border-blue-400 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => toggleSettlement(penalty.settlement_id, penalty.transaction_id)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={selectedSettlements.includes(identifier)}
                                  onChange={() => {}}
                                  className="mt-0.5 cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm text-gray-800">{penalty.item_name}</div>
                                  {penalty.item_location && (
                                    <div className="text-xs text-gray-500">{penalty.item_location}</div>
                                  )}
                                  <div className="flex items-center gap-2 mt-1">
                                    {!penalty.is_returned && (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">
                                        NOT RETURNED
                                      </span>
                                    )}
                                    {penalty.hours_overdue !== undefined && (
                                      <span className="text-xs text-gray-500">
                                        {penalty.hours_overdue.toFixed(1)}h overdue
                                      </span>
                                    )}
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                      penalty.status === 'PARTIAL' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                      {penalty.status}
                                    </span>
                                    {penalty.amount_paid > 0 && (
                                      <span className="text-xs text-gray-500">Paid: ₱{penalty.amount_paid.toFixed(2)}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-lg font-bold text-orange-600">₱{penalty.remaining_balance.toFixed(2)}</div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded border shadow-sm p-8 text-center">
                <i className="fas fa-check-circle text-4xl text-green-600 mb-2"></i>
                <h3 className="text-base font-semibold mb-1">No Outstanding Penalties</h3>
                <p className="text-sm text-gray-500">Clean record</p>
              </div>
            )}

            {/* Payment Section */}
            {selectedSettlements.length > 0 && (
              <div className="bg-green-50 rounded border border-green-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Selected: {selectedSettlements.length} item(s)</div>
                    <div className="text-2xl font-bold text-green-600">₱{calculateSelectedTotal().toFixed(2)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Payment Amount</label>
                    <input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      max={calculateSelectedTotal()}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(calculateSelectedTotal().toFixed(2))}
                      className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                    >
                      Pay full amount
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                    >
                      <option value="CASH">Cash</option>
                      <option value="GCASH">GCash</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleBulkPayment}
                  disabled={isProcessing || !paymentAmount}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Processing...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check-circle mr-2"></i>
                      Process Payment ₱{paymentAmount || '0.00'}
                    </>
                  )}
                </button>

                <div className="mt-3 text-xs text-gray-600 bg-blue-50 p-2 rounded border border-blue-200">
                  <i className="fas fa-info-circle mr-1"></i>
                  Payment distributed oldest first. Partial payments tracked.
                </div>
              </div>
            )}
          </>
        )}

        {/* No Data State */}
        {!loading && !summaryData && (
          <div className="bg-white rounded border shadow-sm p-8 text-center">
            <i className="fas fa-search text-4xl text-gray-300 mb-2"></i>
            <h3 className="text-base font-semibold mb-1">Search for a User</h3>
            <p className="text-sm text-gray-500">Enter an ID Number or User ID above</p>
          </div>
        )}
      </div>
    </div>
  )
}

