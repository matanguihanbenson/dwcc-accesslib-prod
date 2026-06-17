'use client'

import React, { useState } from 'react'
import { notify } from '@/lib/notification'
import { Pagination, PaginationControls } from '@/components/ui/pagination'
import PaymentModal from '@/components/modals/PaymentModal'
import SendIndividualNotificationModal from '@/components/modals/SendIndividualNotificationModal'
import PaymentHistoryModal from '@/components/modals/PaymentHistoryModal'

interface OverdueLocker {
  transaction_id: number
  borrow_time: string
  penalty: number
  hours_used: number
  days_used: number
  calculated_penalty: number
  settlement_status?: 'PENDING' | 'PARTIAL' | 'SETTLED'
  amount_paid?: number
  remaining_balance?: number
  locker: {
    locker_number: string
    status: string
  }
  user: {
    full_name: string
    email: string
    user_type: string
    course?: string
    department?: string
    contact_number?: string
    account_id: string
  }
}

interface OverdueLockerTableProps {
  lockers: OverdueLocker[]
  onRefresh: () => void
  userEmail?: string | null
}

export default function OverdueLockerTable({ lockers, onRefresh, userEmail }: OverdueLockerTableProps) {
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [filterStatus, setFilterStatus] = useState<'all' | 'PENDING' | 'PARTIAL' | 'SETTLED'>('all')
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean
    item: any
  }>({
    isOpen: false,
    item: null
  })
  const [notificationModal, setNotificationModal] = useState<{
    isOpen: boolean
    locker: any
  }>({
    isOpen: false,
    locker: null
  })
  const [paymentHistoryModal, setPaymentHistoryModal] = useState<{
    isOpen: boolean
    transactionId: number | null
    transactionType: 'BOOK' | 'LOCKER'
  }>({
    isOpen: false,
    transactionId: null,
    transactionType: 'LOCKER'
  })

  // Pagination calculations
  const filteredLockers = lockers.filter(locker => {
    if (filterStatus === 'all') return true
    return locker.settlement_status === filterStatus
  })
  
  const totalPages = Math.ceil(filteredLockers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedLockers = filteredLockers.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1)
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (hours: number) => {
    if (hours < 1) {
      const minutes = Math.round(hours * 60)
      return `${minutes} min${minutes !== 1 ? 's' : ''}`
    }
    if (hours < 24) {
      const wholeHours = Math.floor(hours)
      const minutes = Math.round((hours % 1) * 60)
      return minutes > 0 ? `${wholeHours}h ${minutes}m` : `${wholeHours}h`
    }
    const days = Math.floor(hours / 24)
    const remainingHours = Math.floor(hours % 24)
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
  }

  const getSeverityColor = (daysUsed: number) => {
    if (daysUsed > 14) return 'text-red-700 bg-red-100'
    if (daysUsed > 7) return 'text-red-600 bg-red-50'
    if (daysUsed > 3) return 'text-orange-600 bg-orange-50'
    return 'text-yellow-600 bg-yellow-50'
  }

  const getUserTypeBadge = (userType: string) => {
    const colors = {
      STUDENT: 'bg-blue-100 text-blue-800',
      EMPLOYEE: 'bg-green-100 text-green-800',
      ALUMNI: 'bg-purple-100 text-purple-800',
      GUEST: 'bg-gray-100 text-gray-800'
    }
    return colors[userType as keyof typeof colors] || colors.GUEST
  }

  const getLockerStatusBadge = (status: string) => {
    const colors = {
      AVAILABLE: 'bg-green-100 text-green-800',
      OCCUPIED: 'bg-yellow-100 text-yellow-800',
      DAMAGED: 'bg-red-100 text-red-800',
      MAINTENANCE: 'bg-gray-100 text-gray-800'
    }
    return colors[status as keyof typeof colors] || colors.OCCUPIED
  }

  const getSettlementStatusBadge = (status?: string) => {
    if (!status) return null
    const colors = {
      PENDING: 'bg-red-100 text-red-800',
      PARTIAL: 'bg-yellow-100 text-yellow-800',
      SETTLED: 'bg-green-100 text-green-800'
    }
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${colors[status as keyof typeof colors] || colors.PENDING}`}>
        {status === 'PENDING' ? 'Pending Payment' : status === 'PARTIAL' ? 'Partially Paid' : 'Settled'}
      </span>
    )
  }

  const handleSettleOverdue = (locker: OverdueLocker) => {
    setPaymentModal({
      isOpen: true,
      item: locker
    })
  }

  const handlePaymentSubmit = async (amount: number) => {
    if (!paymentModal.item) return

    const locker = paymentModal.item
    const transactionId = locker.transaction_id

    setProcessingId(transactionId)
    try {
      const response = await fetch('/api/overdue/settle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          transaction_type: 'LOCKER',
          transaction_id: transactionId,
          amount_paid: amount
        })
      })

      if (response.ok) {
        const result = await response.json()
        await notify.success(
          'Payment Processed',
          `Payment of ₱${amount.toFixed(2)} processed. ${result.status === 'SETTLED' ? 'Penalty fully settled!' : `Remaining balance: ₱${result.remaining_balance.toFixed(2)}`}`
        )
        onRefresh()
        setPaymentModal({ isOpen: false, item: null })
      } else {
        const error = await response.json()
        console.error('Payment error:', error)
        await notify.error('Error', error.error || error.message || 'Failed to process payment')
      }
    } catch (error) {
      await notify.error('Error', 'Network error occurred')
    } finally {
      setProcessingId(null)
    }
  }

  const handleSendReminder = (locker: OverdueLocker) => {
    setNotificationModal({
      isOpen: true,
      locker: locker
    })
  }

  const handleVoidPenalty = async (locker: OverdueLocker) => {
    const confirmed = await notify.confirm(
      'Void Penalty?',
      `This will set the penalty for this overdue to ₱0.00. Continue?`
    )

    if (!confirmed) return

    setProcessingId(locker.transaction_id)
    try {
      const response = await fetch('/api/overdue/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          transaction_type: 'LOCKER',
          transaction_id: locker.transaction_id,
        }),
      })

      if (response.ok) {
        await notify.success('Success', 'Penalty voided successfully')
        onRefresh()
      } else {
        let msg = 'Failed to void penalty'
        try {
          const err = await response.json()
          msg = err.error || err.message || msg
        } catch {
          const t = await response.text()
          if (t) msg = t
        }
        await notify.error('Error', msg)
      }
    } catch (error) {
      await notify.error('Error', 'Network error occurred')
    } finally {
      setProcessingId(null)
    }
  }

    const handleForceReturn = async (transactionId: number, lockerNumber: string) => {
    const confirmed = await notify.confirm(
      'Force Return Locker?',
      `This will force return locker ${lockerNumber} and release it for other users. The penalty must still be settled separately. Continue?`
    )

    if (confirmed) {
      setProcessingId(transactionId)
      try {
        const response = await fetch(`/api/lockers/force-return`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ transaction_id: transactionId })
        })

        if (response.ok) {
          await notify.success(
            'Locker Force Returned', 
            `Locker ${lockerNumber} has been forcibly returned and is now available.`
          )
          onRefresh()
        } else {
          const error = await response.json()
          await notify.error('Error', error.message || 'Failed to process force return')
        }
      } catch (error) {
        await notify.error('Error', 'Network error occurred')
      } finally {
        setProcessingId(null)
      }
    }
  }

  if (filteredLockers.length === 0) {
    return (
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-sm text-gray-600">
              Settlement Status Filter
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Overdues</option>
              <option value="PENDING">Pending Payment</option>
              <option value="PARTIAL">Partially Paid</option>
              <option value="SETTLED">Settled</option>
            </select>
          </div>
        </div>
        <div className="p-8 text-center">
          <div className="text-gray-500 mb-2">
            <i className="fas fa-lock text-4xl mb-4"></i>
          </div>
          <div className="text-gray-600">No overdue lockers found for the selected filter</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      {/* Status Filter */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-sm text-gray-600">
            Total: {filteredLockers.length} overdue locker{filteredLockers.length !== 1 ? 's' : ''} 
            {filterStatus !== 'all' && ` (${filterStatus.toLowerCase()})`}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Filter by Status:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Overdues</option>
                <option value="PENDING">Pending Payment</option>
                <option value="PARTIAL">Partially Paid</option>
                <option value="SETTLED">Settled</option>
              </select>
            </div>
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Locker & User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Started
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount Due
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedLockers.map((locker) => {
              const amountDue = locker.remaining_balance || locker.calculated_penalty
              return (
                <tr key={locker.transaction_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">
                        <i className="fas fa-lock mr-1 text-gray-400"></i>
                        Locker {locker.locker.locker_number}
                      </div>
                      <div className="mt-1">
                        <div className="text-xs font-medium text-gray-700">{locker.user.full_name}</div>
                        <div className="text-xs text-gray-500">{locker.user.account_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="text-gray-700">{formatDateTime(locker.borrow_time)}</div>
                    <div className="text-xs text-orange-600 mt-1">
                      <i className="fas fa-clock mr-1"></i>Active
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${getSeverityColor(locker.days_used)}`}>
                      {formatDuration(locker.hours_used)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-bold text-red-600">₱{amountDue.toFixed(2)}</div>
                    {locker.settlement_status === 'PARTIAL' && locker.amount_paid && (
                      <div className="text-xs text-gray-500">Paid: ₱{locker.amount_paid.toFixed(2)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {getSettlementStatusBadge(locker.settlement_status)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {locker.settlement_status !== 'SETTLED' && (
                        <button
                          onClick={() => handleSettleOverdue(locker)}
                          disabled={processingId === locker.transaction_id}
                          className="text-green-600 hover:text-green-900 px-2 py-1 text-xs border border-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                          title="Process Payment"
                        >
                          {processingId === locker.transaction_id ? (
                            <i className="fas fa-spinner fa-spin"></i>
                          ) : (
                            <><i className="fas fa-dollar-sign"></i> Pay</>
                          )}
                        </button>
                      )}
                      {locker.settlement_status !== 'SETTLED' && (
                        <button
                          onClick={() => handleVoidPenalty(locker)}
                          disabled={processingId === locker.transaction_id}
                          className="text-red-600 hover:text-red-900 px-2 py-1 text-xs border border-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                          title="Void Penalty"
                        >
                          <i className="fas fa-ban"></i>
                        </button>
                      )}
                      {(locker.settlement_status === 'PARTIAL' || locker.settlement_status === 'SETTLED') && (
                        <button
                          onClick={() => setPaymentHistoryModal({ isOpen: true, transactionId: locker.transaction_id, transactionType: 'LOCKER' })}
                          className="text-purple-600 hover:text-purple-900 px-2 py-1 text-xs border border-purple-600 hover:bg-purple-50 rounded"
                          title="View Payment History"
                        >
                          <i className="fas fa-history"></i>
                        </button>
                      )}

                      {locker.user.email && (
                        <button
                          onClick={() => handleSendReminder(locker)}
                          className="text-blue-600 hover:text-blue-900 px-2 py-1 text-xs border border-blue-600 hover:bg-blue-50 rounded"
                          title="Send Reminder"
                        >
                          <i className="fas fa-envelope"></i>
                        </button>
                      )}

                      {locker.days_used > 7 && (
                        <button
                          onClick={() =>
                            handleForceReturn(
                              locker.transaction_id,
                              locker.locker.locker_number
                            )
                          }
                          disabled={processingId === locker.transaction_id}
                          className="text-orange-600 hover:text-orange-900 px-2 py-1 text-xs border border-orange-600 hover:bg-orange-50 rounded disabled:opacity-50"
                          title="Force Return (7+ days)"
                        >
                          <i className="fas fa-unlock"></i>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Controls */}
      <div className="bg-gray-50 px-6 py-3 border-t">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredLockers.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {paymentModal.isOpen && paymentModal.item && (
        <PaymentModal
          isOpen={paymentModal.isOpen}
          onClose={() => setPaymentModal({ isOpen: false, item: null })}
          onConfirm={handlePaymentSubmit}
          userName={paymentModal.item.user.full_name}
          penaltyAmount={paymentModal.item.remaining_balance || paymentModal.item.calculated_penalty}
          transactionType="LOCKER"
          remainingBalance={paymentModal.item.remaining_balance}
        />
      )}

      {paymentHistoryModal.isOpen && paymentHistoryModal.transactionId && (
        <PaymentHistoryModal
          isOpen={paymentHistoryModal.isOpen}
          onClose={() => setPaymentHistoryModal({ isOpen: false, transactionId: null, transactionType: 'LOCKER' })}
          transactionId={paymentHistoryModal.transactionId}
          transactionType={paymentHistoryModal.transactionType}
        />
      )}

      {notificationModal.isOpen && notificationModal.locker && (
        <SendIndividualNotificationModal
          isOpen={notificationModal.isOpen}
          onClose={() => {
            setNotificationModal({ isOpen: false, locker: null })
            onRefresh()
          }}
          user={{
            user_id: notificationModal.locker.user.user_id || 0,
            full_name: notificationModal.locker.user.full_name,
            account_id: notificationModal.locker.user.account_id,
            email: notificationModal.locker.user.email,
            user_type: notificationModal.locker.user.user_type
          }}
          overdueType="LOCKER"
          itemDetails={{
            name: notificationModal.locker.locker.locker_number,
            daysOrHours: notificationModal.locker.hours_used,
            penalty: notificationModal.locker.remaining_balance || notificationModal.locker.calculated_penalty,
            isHours: true
          }}
          senderEmail={userEmail}
        />
      )}
    </div>
  )
}
