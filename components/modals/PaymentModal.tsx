'use client'

import React, { useState } from 'react'
import { notify } from '@/lib/notification'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (amount: number) => Promise<void>
  penaltyAmount: number
  userName: string
  transactionType: 'BOOK' | 'LOCKER'
  remainingBalance?: number
}

export default function PaymentModal({
  isOpen,
  onClose,
  onConfirm,
  penaltyAmount,
  userName,
  transactionType,
  remainingBalance
}: PaymentModalProps) {
  const [amount, setAmount] = useState('')
  const [processing, setProcessing] = useState(false)

  const displayAmount = remainingBalance || penaltyAmount

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      await notify.error('Invalid Amount', 'Please enter a valid amount greater than 0')
      return
    }

    if (parsedAmount > displayAmount) {
      const confirmed = await notify.confirm(
        'Amount Exceeds Penalty',
        `Payment amount (₱${parsedAmount.toFixed(2)}) exceeds the remaining penalty (₱${displayAmount.toFixed(2)}). Continue?`
      )
      if (!confirmed) return
    }

    setProcessing(true)
    try {
      await onConfirm(parsedAmount)
      onClose()
      setAmount('')
    } catch (error) {
      // Error handling is done in the parent component
    } finally {
      setProcessing(false)
    }
  }

  const handleClose = () => {
    if (!processing) {
      onClose()
      setAmount('')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Process {transactionType.toLowerCase()} penalty payment
          </h3>
        </div>
        
        <form onSubmit={handleSubmit} className="px-6 py-4">
          <div className="mb-4">
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <div className="text-sm text-gray-600 mb-2">
                <strong>User:</strong> {userName}
              </div>
              <div className="text-sm text-gray-600 mb-2">
                <strong>Total Penalty:</strong> ₱{penaltyAmount.toFixed(2)}
              </div>
              {remainingBalance !== undefined && remainingBalance !== penaltyAmount && (
                <div className="text-sm text-gray-600 mb-2">
                  <strong>Remaining Balance:</strong> ₱{remainingBalance.toFixed(2)}
                </div>
              )}
              <div className="text-sm font-semibold text-red-600">
                <strong>Amount Due:</strong> ₱{displayAmount.toFixed(2)}
              </div>
            </div>
            
            <label htmlFor="payment-amount" className="block text-sm font-medium text-gray-700 mb-2">
              Payment Amount (₱)
            </label>
            <input
              type="number"
              id="payment-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.01"
              min="0.01"
              max={displayAmount * 2} // Allow overpayment up to 2x
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={processing}
              autoFocus
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={processing}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={processing || !amount}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {processing ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Processing...
                </>
              ) : (
                <>
                  <i className="fas fa-dollar-sign"></i>
                  Process Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
