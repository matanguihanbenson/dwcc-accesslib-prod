'use client'

import React, { useEffect, useState } from 'react'
import Swal from 'sweetalert2'

interface PaymentHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  transactionId: number
  transactionType: 'BOOK' | 'LOCKER'
}

interface PaymentRecord {
  id: number
  type: 'PAYMENT' | 'REFUND' | 'ADJUSTMENT'
  amount: number
  notes: string | null
  created_at: string
  processed_by_name: string | null
  processed_by_account_id: string | null
  processed_by_role: string | null
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
  payment_records: PaymentRecord[]
}

export default function PaymentHistoryModal({
  isOpen,
  onClose,
  transactionId,
  transactionType
}: PaymentHistoryModalProps) {
  const [loading, setLoading] = useState(true)
  const [settlement, setSettlement] = useState<SettlementData | null>(null)

  // Refund sub-modal
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [refundError, setRefundError] = useState('')
  const [processingRefund, setProcessingRefund] = useState(false)

  // Adjust sub-modal
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustError, setAdjustError] = useState('')
  const [processingAdjust, setProcessingAdjust] = useState(false)

  useEffect(() => {
    if (isOpen && transactionId) {
      setSettlement(null)
      fetchPaymentHistory()
    }
  }, [isOpen, transactionId])

  const fetchPaymentHistory = async () => {
    try {
      setLoading(true)
      const timestamp = new Date().getTime()
      const response = await fetch(`/api/overdue/payment-history?type=${transactionType}&transaction_id=${transactionId}&_t=${timestamp}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      })

      if (response.ok) {
        const data = await response.json()
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

  const handleOpenRefund = () => {
    setRefundReason('')
    setRefundError('')
    setShowRefundModal(true)
  }

  const handleSubmitRefund = async () => {
    if (!settlement) return
    if (!refundReason.trim()) {
      setRefundError('Reason is required')
      return
    }

    try {
      setProcessingRefund(true)
      setRefundError('')
      const response = await fetch('/api/overdue/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          settlement_id: settlement.settlement_id,
          reason: refundReason.trim(),
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setShowRefundModal(false)
        await Swal.fire({
          icon: 'success',
          title: 'Refund Processed',
          html: `
            <p class="text-sm text-gray-600">₱<strong>${data.refund_amount.toFixed(2)}</strong> has been refunded.</p>
            <p class="text-sm text-gray-600 mt-2">Fine of ₱<strong>${data.remaining_balance.toFixed(2)}</strong> is now active for payment.</p>
          `,
          confirmButtonColor: '#3085d6',
        })
        await fetchPaymentHistory()
      } else {
        setRefundError(data.error || 'Failed to process refund')
      }
    } catch (error) {
      setRefundError('An unexpected error occurred')
    } finally {
      setProcessingRefund(false)
    }
  }

  const handleOpenAdjust = () => {
    if (!settlement) return
    setAdjustAmount(settlement.amount_paid.toString())
    setAdjustReason('')
    setAdjustError('')
    setShowAdjustModal(true)
  }

  const handleSubmitAdjust = async () => {
    if (!settlement) return
    if (!adjustReason.trim()) {
      setAdjustError('Reason is required')
      return
    }
    const amount = parseFloat(adjustAmount)
    if (isNaN(amount) || amount < 0) {
      setAdjustError('Please enter a valid amount (>= 0)')
      return
    }
    if (amount > settlement.penalty_amount) {
      setAdjustError(`Amount cannot exceed ₱${settlement.penalty_amount.toFixed(2)}`)
      return
    }

    try {
      setProcessingAdjust(true)
      setAdjustError('')
      const response = await fetch('/api/overdue/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          settlement_id: settlement.settlement_id,
          corrected_amount: amount,
          reason: adjustReason.trim(),
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setShowAdjustModal(false)
        await Swal.fire({
          icon: 'success',
          title: 'Payment Adjusted',
          html: `
            <p class="text-sm text-gray-600">Payment adjusted from ₱<strong>${data.previous_amount.toFixed(2)}</strong> to ₱<strong>${data.corrected_amount.toFixed(2)}</strong>.</p>
            ${data.status === 'SETTLED' ? '<p class="text-sm text-green-600 mt-2 font-medium">This fine is now fully settled.</p>' : `<p class="text-sm text-gray-600 mt-2">Remaining balance: ₱<strong>${data.remaining_balance.toFixed(2)}</strong></p>`}
          `,
          confirmButtonColor: '#3085d6',
        })
        await fetchPaymentHistory()
      } else {
        setAdjustError(data.error || 'Failed to adjust payment')
      }
    } catch (error) {
      setAdjustError('An unexpected error occurred')
    } finally {
      setProcessingAdjust(false)
    }
  }

  const handleClose = () => {
    setSettlement(null)
    setLoading(true)
    onClose()
  }

  const getRecordIcon = (type: string) => {
    switch (type) {
      case 'PAYMENT': return { icon: 'fa-dollar-sign', bg: 'bg-green-100', text: 'text-green-600' }
      case 'REFUND': return { icon: 'fa-rotate-left', bg: 'bg-red-100', text: 'text-red-600' }
      case 'ADJUSTMENT': return { icon: 'fa-sliders', bg: 'bg-amber-100', text: 'text-amber-600' }
      default: return { icon: 'fa-circle', bg: 'bg-gray-100', text: 'text-gray-600' }
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b bg-gradient-to-r from-purple-50 to-blue-50 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Payment Details</h2>
            <p className="text-xs text-gray-600 mt-0.5">Transaction payment information</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="text-center py-16">
            <i className="fas fa-spinner fa-spin text-2xl text-gray-400"></i>
            <p className="text-gray-500 mt-3 text-sm">Loading...</p>
          </div>
        ) : !settlement ? (
          <div className="text-center py-16">
            <i className="fas fa-inbox text-2xl text-gray-400"></i>
            <p className="text-gray-500 mt-3 text-sm">No payment records found</p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            {/* Left column - fixed */}
            <div className="w-[280px] flex-shrink-0 border-r border-gray-100 p-5 flex flex-col">
              {/* Item Info */}
              <div className="flex items-start gap-3 pb-4 border-b border-gray-100">
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
                  <div className="text-xs text-gray-600 mt-0.5 truncate">{settlement.user.full_name}</div>
                  <div className="text-xs text-gray-500">{settlement.user.account_id}</div>
                </div>
              </div>

              {/* Status badge */}
              <div className="mt-3 mb-4">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                  settlement.status === 'SETTLED' ? 'bg-green-100 text-green-700' :
                  settlement.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {settlement.status === 'SETTLED' ? '✓ Paid' :
                   settlement.status === 'PARTIAL' ? 'Partial' : 'Unpaid'}
                </span>
              </div>

              {/* Amounts */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Total Fine</span>
                  <span className="text-sm font-bold text-gray-900">₱{settlement.penalty_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Paid</span>
                  <span className="text-sm font-bold text-green-600">₱{settlement.amount_paid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Balance</span>
                  <span className={`text-sm font-bold ${settlement.remaining_balance > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    ₱{settlement.remaining_balance.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Spacer */}
              <div className="flex-1"></div>

              {/* Action buttons */}
              <div className="space-y-2 mt-auto pt-3 border-t border-gray-100">
                {(settlement.status === 'PENDING' || settlement.status === 'PARTIAL') && settlement.amount_paid > 0 && (
                  <button
                    onClick={handleOpenAdjust}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    <i className="fas fa-sliders"></i>
                    Adjust Payment
                  </button>
                )}
                {(settlement.status === 'SETTLED' || settlement.status === 'PARTIAL') && settlement.amount_paid > 0 && (
                  <button
                    onClick={handleOpenRefund}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <i className="fas fa-rotate-left"></i>
                    Refund Payment
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="w-full px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Right column - scrollable */}
            <div className="flex-1 min-w-0 overflow-y-auto p-5">
              <div className="space-y-5">
                {/* Progress Bar */}
                {settlement.penalty_amount > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-700 mb-2">Payment Progress</div>
                    <div className="flex justify-between text-xs text-gray-600 mb-1.5">
                      <span>{((settlement.amount_paid / settlement.penalty_amount) * 100).toFixed(0)}%</span>
                      <span>₱{settlement.amount_paid.toFixed(2)} / ₱{settlement.penalty_amount.toFixed(2)}</span>
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

                {/* Payment Records Timeline */}
                {settlement.payment_records.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-700 mb-3">Payment Activity</div>
                    <div className="space-y-0">
                      {settlement.payment_records.map((record, idx) => {
                        const iconInfo = getRecordIcon(record.type)
                        const isLast = idx === settlement.payment_records.length - 1
                        return (
                          <div key={record.id} className="flex gap-2.5">
                            <div className="flex flex-col items-center">
                              <div className={`w-2 h-2 rounded-full mt-1.5 ${
                                record.type === 'PAYMENT' ? 'bg-green-500' :
                                record.type === 'REFUND' ? 'bg-red-500' : 'bg-amber-500'
                              }`}></div>
                              {!isLast && <div className="w-0.5 flex-1 bg-gray-300 my-1"></div>}
                            </div>
                            <div className="flex-1 pb-3">
                              <div className="flex items-center gap-1.5">
                                <span className={`inline-flex items-center justify-center w-4 h-4 rounded ${iconInfo.bg}`}>
                                  <i className={`fas ${iconInfo.icon} ${iconInfo.text}`} style={{fontSize:'8px'}}></i>
                                </span>
                                <span className={`text-xs font-medium ${
                                  record.type === 'PAYMENT' ? 'text-green-800' :
                                  record.type === 'REFUND' ? 'text-red-800' : 'text-amber-800'
                                }`}>
                                  {record.type === 'PAYMENT' ? 'Payment' :
                                   record.type === 'REFUND' ? 'Refund' : 'Adjustment'}
                                </span>
                                <span className={`text-xs font-bold ${
                                  record.type === 'REFUND' ? 'text-red-600' :
                                  record.type === 'ADJUSTMENT' ? 'text-amber-600' : 'text-green-600'
                                }`}>
                                  {record.type === 'REFUND' ? '-' : ''}₱{record.amount.toFixed(2)}
                                </span>
                              </div>
                              {record.notes && (
                                <div className="text-xs text-gray-500 mt-0.5">{record.notes}</div>
                              )}
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[10px] text-gray-400">
                                  {new Date(record.created_at).toLocaleDateString()} {new Date(record.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                </span>
                                {record.processed_by_name && (
                                  <span className="text-[10px] text-gray-400">
                                    • by {record.processed_by_name}
                                    {record.processed_by_role && <span className="text-blue-500"> ({record.processed_by_role})</span>}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {settlement.payment_records.length === 0 && (
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <i className="fas fa-receipt text-xl text-gray-400"></i>
                    <p className="text-xs text-gray-500 mt-2">No payment activity recorded yet</p>
                  </div>
                )}

                {/* Notes */}
                {settlement.notes && (
                  <div className="bg-yellow-50 border-l-3 border-yellow-400 rounded p-3">
                    <div className="text-xs font-medium text-yellow-800 mb-1">Note</div>
                    <p className="text-xs text-yellow-700">{settlement.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Refund sub-modal */}
      {showRefundModal && settlement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center px-5 py-4 border-b">
              <h3 className="text-base font-semibold text-gray-900">Refund Payment</h3>
              <button
                onClick={() => { setShowRefundModal(false); setRefundError('') }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-600">
                You are about to refund <strong>₱{settlement.amount_paid.toFixed(2)}</strong> paid by <strong>{settlement.user.full_name}</strong>.
              </p>
              <p className="text-sm text-gray-600">
                This will reactivate the fine for payment.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for refund *</label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => { setRefundReason(e.target.value); setRefundError('') }}
                  placeholder="e.g. Overpayment, Duplicate payment"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
                {refundError && (
                  <p className="text-xs text-red-600 mt-1">{refundError}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t bg-gray-50">
              <button
                onClick={() => { setShowRefundModal(false); setRefundError('') }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRefund}
                disabled={processingRefund}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {processingRefund ? (
                  <><i className="fas fa-spinner fa-spin mr-1"></i>Processing...</>
                ) : (
                  `Refund ₱${settlement.amount_paid.toFixed(2)}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust sub-modal */}
      {showAdjustModal && settlement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center px-5 py-4 border-b">
              <h3 className="text-base font-semibold text-gray-900">Adjust Payment</h3>
              <button
                onClick={() => { setShowAdjustModal(false); setAdjustError('') }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-600">
                Adjust the payment amount for <strong>{settlement.user.full_name}</strong>.
              </p>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500">Current paid amount</div>
                <div className="text-lg font-bold text-gray-900">₱{settlement.amount_paid.toFixed(2)}</div>
                <div className="text-xs text-gray-500 mt-1">Total fine: ₱{settlement.penalty_amount.toFixed(2)}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Corrected amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={settlement.penalty_amount}
                  value={adjustAmount}
                  onChange={(e) => { setAdjustAmount(e.target.value); setAdjustError('') }}
                  placeholder="Enter correct amount"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for adjustment *</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => { setAdjustReason(e.target.value); setAdjustError('') }}
                  placeholder="e.g. Staff entered wrong amount"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                {adjustError && (
                  <p className="text-xs text-red-600 mt-1">{adjustError}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t bg-gray-50">
              <button
                onClick={() => { setShowAdjustModal(false); setAdjustError('') }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitAdjust}
                disabled={processingAdjust}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {processingAdjust ? (
                  <><i className="fas fa-spinner fa-spin mr-1"></i>Processing...</>
                ) : (
                  'Adjust Payment'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
