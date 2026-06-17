'use client'

import React, { useEffect, useState } from 'react'

interface PaymentHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  transactionId: number
  transactionType: 'BOOK' | 'LOCKER'
}

interface SettlementData {
  settlement_id: number
  penalty_amount: number
  amount_paid: number
  remaining_balance: number
  status: string
  created_at: string
  settled_at: string | null
  updated_at: string
  notes: string | null
  user: {
    full_name: string
    account_id: string
  }
  processedByUser?: {
    full_name: string
    account_id: string
    user_account?: {
      role: string
    }
  } | null
  transaction_details: any
}

export default function PaymentHistoryModal({
  isOpen,
  onClose,
  transactionId,
  transactionType
}: PaymentHistoryModalProps) {
  const [loading, setLoading] = useState(true)
  const [settlement, setSettlement] = useState<SettlementData | null>(null)

  useEffect(() => {
    if (isOpen && transactionId) {
      // Reset settlement and fetch fresh data whenever modal opens
      setSettlement(null)
      fetchPaymentHistory()
    }
  }, [isOpen, transactionId])

  const fetchPaymentHistory = async () => {
    try {
      setLoading(true)
      // Add cache busting to ensure fresh data
      const timestamp = new Date().getTime()
      const response = await fetch(`/api/overdue/payment-history?type=${transactionType}&transaction_id=${transactionId}&_t=${timestamp}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })

      if (response.ok) {
        const data = await response.json()
        // The API returns all settlements, filter for this specific transaction
        const transactionSettlement = data.settlements.find(
          (s: any) => s.transaction_id === transactionId && s.transaction_type === transactionType
        )
        setSettlement(transactionSettlement || null)
      }
    } catch (error) {
      console.error('Error fetching payment history:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSettlement(null)
    setLoading(true)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b bg-gradient-to-r from-purple-50 to-blue-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Payment Details</h2>
            <p className="text-xs text-gray-600 mt-0.5">Transaction payment information</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {loading ? (
            <div className="text-center py-12">
              <i className="fas fa-spinner fa-spin text-2xl text-gray-400"></i>
              <p className="text-gray-500 mt-3 text-sm">Loading...</p>
            </div>
          ) : !settlement ? (
            <div className="text-center py-12">
              <i className="fas fa-inbox text-2xl text-gray-400"></i>
              <p className="text-gray-500 mt-3 text-sm">No payment records found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Item Info */}
              <div className="flex items-start gap-3 pb-4 border-b">
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                  transactionType === 'BOOK' ? 'bg-purple-100' : 'bg-blue-100'
                }`}>
                  <i className={`fas fa-${transactionType === 'BOOK' ? 'book' : 'key'} ${
                    transactionType === 'BOOK' ? 'text-purple-600' : 'text-blue-600'
                  }`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {transactionType === 'BOOK' 
                      ? settlement.transaction_details?.book_title || 'Book'
                      : `Locker #${settlement.transaction_details?.locker_number || 'N/A'}`}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">{settlement.user.full_name}</div>
                  <div className="text-xs text-gray-500">{settlement.user.account_id}</div>
                  {settlement.processedByUser && (
                    <div className="text-xs text-blue-600 mt-1">
                      <i className="fas fa-user-check mr-1"></i>
                      Processed by: {settlement.processedByUser.full_name}
                      {settlement.processedByUser.user_account?.role && (
                        <span className="ml-1">({settlement.processedByUser.user_account.role})</span>
                      )}
                    </div>
                  )}
                </div>
                <span className={`flex-shrink-0 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  settlement.status === 'SETTLED' ? 'bg-green-100 text-green-700' :
                  settlement.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {settlement.status === 'SETTLED' ? '✓ Paid' :
                   settlement.status === 'PARTIAL' ? 'Partial' : 'Unpaid'}
                </span>
              </div>

              {/* Payment Amounts - Compact Cards */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-600 mb-1">Total Fine</div>
                  <div className="text-base font-bold text-gray-900">₱{settlement.penalty_amount.toFixed(2)}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-600 mb-1">Paid</div>
                  <div className="text-base font-bold text-green-600">₱{settlement.amount_paid.toFixed(2)}</div>
                </div>
                <div className={`rounded-lg p-3 text-center ${settlement.remaining_balance > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <div className="text-xs text-gray-600 mb-1">Balance</div>
                  <div className={`text-base font-bold ${settlement.remaining_balance > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    ₱{settlement.remaining_balance.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              {settlement.penalty_amount > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-600 mb-1.5">
                    <span>Payment Progress</span>
                    <span className="font-medium">{((settlement.amount_paid / settlement.penalty_amount) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${
                        settlement.status === 'SETTLED' ? 'bg-green-500' : 'bg-yellow-500'
                      }`}
                      style={{ width: `${Math.min((settlement.amount_paid / settlement.penalty_amount) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Timeline - Compact */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-medium text-gray-700">Payment Timeline</div>
                  {settlement.status === 'PARTIAL' && settlement.amount_paid > 0 && (
                    <div className="text-xs text-gray-500 italic">Multiple payments combined</div>
                  )}
                </div>
                <div className="space-y-3">
                  {/* Created */}
                  <div className="flex gap-2.5">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-1"></div>
                      {(settlement.amount_paid > 0 || settlement.status === 'SETTLED') && (
                        <div className="w-0.5 flex-1 bg-gray-300 my-1"></div>
                      )}
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="text-xs font-medium text-gray-900">Fine Recorded</div>
                      <div className="text-xs text-gray-600">{new Date(settlement.created_at).toLocaleDateString()} • ₱{settlement.penalty_amount.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Payment Made */}
                  {settlement.amount_paid > 0 && (
                    <div className="flex gap-2.5">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-1"></div>
                        {settlement.status === 'SETTLED' && settlement.settled_at && (
                          <div className="w-0.5 flex-1 bg-gray-300 my-1"></div>
                        )}
                      </div>
                      <div className="flex-1 pb-2">
                        <div className="text-xs font-medium text-gray-900">
                          {settlement.status === 'PARTIAL' ? 'Partial Payment(s)' : 'Payment Received'}
                        </div>
                        <div className="text-xs text-gray-600">
                          Last updated: {new Date(settlement.updated_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs font-semibold text-green-700 mt-0.5">
                          Total Paid: ₱{settlement.amount_paid.toFixed(2)}
                          {settlement.status === 'PARTIAL' && <span className="text-orange-600 ml-1"> • ₱{settlement.remaining_balance.toFixed(2)} remaining</span>}
                        </div>
                        {settlement.processedByUser && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            <i className="fas fa-user-check mr-1"></i>
                            Processed by: {settlement.processedByUser.full_name}
                            {settlement.processedByUser.user_account?.role && (
                              <span className="ml-1 text-blue-600">({settlement.processedByUser.user_account.role})</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Settled */}
                  {settlement.status === 'SETTLED' && settlement.settled_at && (
                    <div className="flex gap-2.5">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 bg-purple-500 rounded-full mt-1"></div>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-medium text-gray-900">Fully Settled</div>
                        <div className="text-xs text-green-600 font-medium">
                          {new Date(settlement.settled_at).toLocaleDateString()} • <i className="fas fa-check-circle"></i> Complete
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pending */}
                  {settlement.status === 'PENDING' && (
                    <div className="flex gap-2.5">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 bg-red-400 rounded-full mt-1"></div>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-medium text-gray-900">Awaiting Payment</div>
                        <div className="text-xs text-red-600">No payment received yet</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes - Compact */}
              {settlement.notes && (
                <div className="bg-yellow-50 border-l-3 border-yellow-400 rounded p-3">
                  <div className="text-xs font-medium text-yellow-800 mb-1">Note</div>
                  <p className="text-xs text-yellow-700">{settlement.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3 border-t bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
