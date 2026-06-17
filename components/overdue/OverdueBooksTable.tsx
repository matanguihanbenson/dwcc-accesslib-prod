'use client'

import React, { useState } from 'react'
import { Pagination, PaginationControls } from '@/components/ui/pagination'
import { notify } from '@/lib/notification'
import PaymentModal from '@/components/modals/PaymentModal'
import SendIndividualNotificationModal from '@/components/modals/SendIndividualNotificationModal'
import PaymentHistoryModal from '@/components/modals/PaymentHistoryModal'

interface OverdueBook {
  transaction_id: number
  borrow_date: string
  due_date: string
  penalty: number
  days_overdue: number
  calculated_penalty: number
  settlement_status?: 'PENDING' | 'PARTIAL' | 'SETTLED'
  amount_paid?: number
  remaining_balance?: number
  book: {
    title: string
    book_author: string
    category: string
  }
  user?: {
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

interface OverdueBooksTableProps {
  books: OverdueBook[]
  onRefresh: () => void
  userEmail?: string | null
}

export default function OverdueBooksTable({ books, onRefresh, userEmail }: OverdueBooksTableProps) {
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
    book: any
  }>({
    isOpen: false,
    book: null
  })
  const [paymentHistoryModal, setPaymentHistoryModal] = useState<{
    isOpen: boolean
    transactionId: number | null
    transactionType: 'BOOK' | 'LOCKER'
  }>({
    isOpen: false,
    transactionId: null,
    transactionType: 'BOOK'
  })

  // Pagination calculations
  const filteredBooks = books.filter(book => {
    if (filterStatus === 'all') return true
    return book.settlement_status === filterStatus
  })
  
  const totalPages = Math.ceil(filteredBooks.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedBooks = filteredBooks.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getSeverityColor = (daysOverdue: number) => {
    if (daysOverdue > 60) return 'text-red-700 bg-red-100'
    if (daysOverdue > 30) return 'text-red-600 bg-red-50'
    if (daysOverdue > 14) return 'text-orange-600 bg-orange-50'
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

  const handleSettleOverdue = (book: OverdueBook) => {
    setPaymentModal({
      isOpen: true,
      item: book
    })
  }

  const handlePaymentSubmit = async (amount: number) => {
    if (!paymentModal.item) return

    const book = paymentModal.item
    const transactionId = book.transaction_id
    const penaltyAmount = book.remaining_balance || book.calculated_penalty

    setProcessingId(transactionId)
    try {
      const response = await fetch('/api/overdue/settle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          transaction_type: 'BOOK',
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

  const handleSendReminder = (book: OverdueBook) => {
    setNotificationModal({
      isOpen: true,
      book: book
    })
  }

  const handleVoidPenalty = async (book: OverdueBook) => {
    const confirmed = await notify.confirm(
      'Void Penalty?',
      `This will set the penalty for this overdue to ₱0.00. Continue?`
    )

    if (!confirmed) return

    setProcessingId(book.transaction_id)
    try {
      const response = await fetch('/api/overdue/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          transaction_type: 'BOOK',
          transaction_id: book.transaction_id,
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

  if (filteredBooks.length === 0) {
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
            <i className="fas fa-book text-4xl mb-4"></i>
          </div>
          <div className="text-gray-600">No overdue books found for the selected filter</div>
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
            Total: {filteredBooks.length} overdue book{filteredBooks.length !== 1 ? 's' : ''} 
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
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Book & Borrower
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Borrowed / Due
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Overdue
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
            {paginatedBooks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No overdue books found.
                </td>
              </tr>
            ) : (
              paginatedBooks.map((book) => {
                const amountDue = book.remaining_balance || book.calculated_penalty
                const overdueDuration = book.days_overdue < 30 
                  ? `${book.days_overdue} day${book.days_overdue !== 1 ? 's' : ''}`
                  : `${Math.floor(book.days_overdue / 30)} month${Math.floor(book.days_overdue / 30) !== 1 ? 's' : ''} ${book.days_overdue % 30} day${(book.days_overdue % 30) !== 1 ? 's' : ''}`
                
                return (
                <tr key={book.transaction_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">{book.book.title}</div>
                      <div className="text-xs text-gray-500">by {book.book.book_author}</div>
                      <div className="mt-1">
                        <div className="text-xs font-medium text-gray-700">
                          {book.user?.full_name || 
                           (book.department ? `${book.department.name}${book.borrower_representative ? ` (${book.borrower_representative})` : ''}` : '') ||
                           (book.office ? `${book.office.name}${book.borrower_representative ? ` (${book.borrower_representative})` : ''}` : '') ||
                           'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {book.user ? book.user.account_id : 
                           book.department ? 'Dept' :
                           book.office ? 'Office' : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="text-gray-700">{formatDate(book.borrow_date)}</div>
                    <div className="text-red-600 font-medium">{formatDate(book.due_date)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${getSeverityColor(book.days_overdue)}`}>
                      {overdueDuration}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-bold text-red-600">₱{amountDue.toFixed(2)}</div>
                    {book.settlement_status === 'PARTIAL' && book.amount_paid && (
                      <div className="text-xs text-gray-500">Paid: ₱{book.amount_paid.toFixed(2)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {getSettlementStatusBadge(book.settlement_status)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {book.settlement_status !== 'SETTLED' && (
                        <button
                          onClick={() => handleSettleOverdue(book)}
                          disabled={processingId === book.transaction_id}
                          className="text-green-600 hover:text-green-900 px-2 py-1 text-xs border border-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                          title="Process Payment"
                        >
                          {processingId === book.transaction_id ? (
                            <i className="fas fa-spinner fa-spin"></i>
                          ) : (
                            <><i className="fas fa-dollar-sign"></i> Pay</>
                          )}
                        </button>
                      )}
                      {book.settlement_status !== 'SETTLED' && (
                        <button
                          onClick={() => handleVoidPenalty(book)}
                          disabled={processingId === book.transaction_id}
                          className="text-red-600 hover:text-red-900 px-2 py-1 text-xs border border-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                          title="Void Penalty"
                        >
                          <i className="fas fa-ban"></i>
                        </button>
                      )}
                      {(book.settlement_status === 'PARTIAL' || book.settlement_status === 'SETTLED') && (
                        <button
                          onClick={() => setPaymentHistoryModal({ isOpen: true, transactionId: book.transaction_id, transactionType: 'BOOK' })}
                          className="text-purple-600 hover:text-purple-900 px-2 py-1 text-xs border border-purple-600 hover:bg-purple-50 rounded"
                          title="View Payment History"
                        >
                          <i className="fas fa-history"></i>
                        </button>
                      )}
                      {book.user?.email && (
                        <button
                          onClick={() => handleSendReminder(book)}
                          className="text-blue-600 hover:text-blue-900 px-2 py-1 text-xs border border-blue-600 hover:bg-blue-50 rounded"
                          title="Send Reminder"
                        >
                          <i className="fas fa-envelope"></i>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )})
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {filteredBooks.length > 0 && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredBooks.length}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          className="px-6 py-4 border-t border-gray-200 bg-gray-50"
        />
      )}
      
      {filteredBooks.length > 0 && totalPages <= 1 && (
        <div className="bg-gray-50 px-6 py-3 text-sm text-gray-600 border-t">
          Showing {filteredBooks.length} overdue book{filteredBooks.length !== 1 ? 's' : ''}
          {filterStatus !== 'all' && ` (${filterStatus.toLowerCase()})`}
        </div>
      )}

      {paymentModal.isOpen && paymentModal.item && (
        <PaymentModal
          isOpen={paymentModal.isOpen}
          onClose={() => setPaymentModal({ isOpen: false, item: null })}
          onConfirm={handlePaymentSubmit}
          userName={
            paymentModal.item.user?.full_name || 
            (paymentModal.item.department ? `${paymentModal.item.department.name}${paymentModal.item.borrower_representative ? ` (${paymentModal.item.borrower_representative})` : ''}` : '') ||
            (paymentModal.item.office ? `${paymentModal.item.office.name}${paymentModal.item.borrower_representative ? ` (${paymentModal.item.borrower_representative})` : ''}` : '') ||
            'Unknown User'
          }
          penaltyAmount={paymentModal.item.remaining_balance || paymentModal.item.calculated_penalty}
          transactionType="BOOK"
          remainingBalance={paymentModal.item.remaining_balance}
        />
      )}

      {paymentHistoryModal.isOpen && paymentHistoryModal.transactionId && (
        <PaymentHistoryModal
          isOpen={paymentHistoryModal.isOpen}
          onClose={() => setPaymentHistoryModal({ isOpen: false, transactionId: null, transactionType: 'BOOK' })}
          transactionId={paymentHistoryModal.transactionId}
          transactionType={paymentHistoryModal.transactionType}
        />
      )}

      {notificationModal.isOpen && notificationModal.book && (
        <SendIndividualNotificationModal
          isOpen={notificationModal.isOpen}
          onClose={() => {
            setNotificationModal({ isOpen: false, book: null })
            onRefresh()
          }}
          user={{
            user_id: notificationModal.book.user?.user_id || 0,
            full_name: notificationModal.book.user?.full_name || 'Unknown',
            account_id: notificationModal.book.user?.account_id || 'N/A',
            email: notificationModal.book.user?.email || '',
            user_type: notificationModal.book.user?.user_type || 'STUDENT'
          }}
          overdueType="BOOK"
          itemDetails={{
            name: notificationModal.book.book.title,
            daysOrHours: notificationModal.book.days_overdue,
            penalty: notificationModal.book.remaining_balance || notificationModal.book.calculated_penalty,
            dueDate: notificationModal.book.due_date,
            isHours: false
          }}
          senderEmail={userEmail}
        />
      )}
    </div>
  )
}
