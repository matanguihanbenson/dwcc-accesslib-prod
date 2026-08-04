'use client'

import React, { useState } from 'react'
import { notify } from '@/lib/notification'
import Swal from 'sweetalert2'

interface OverrideReturnModalProps {
  isOpen: boolean
  onClose: () => void
  onOverride?: () => void
  transactionType: 'BOOK' | 'LOCKER'
  transactionId: number
  itemName: string
  dueDate: string
  currentReturnDate?: string | null
}

export default function OverrideReturnModal({
  isOpen,
  onClose,
  onOverride,
  transactionType,
  transactionId,
  itemName,
  dueDate,
  currentReturnDate
}: OverrideReturnModalProps) {
  const [overriddenDate, setOverriddenDate] = useState(() => {
    // Default to due date (so penalty becomes 0)
    if (dueDate) {
      const d = new Date(dueDate)
      return d.toISOString().slice(0, 16) // YYYY-MM-DDTHH:MM
    }
    return ''
  })
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!overriddenDate) {
      await notify.error('Error', 'Please select a return date')
      return
    }

    if (!reason.trim()) {
      await notify.error('Error', 'Please provide a reason for the override')
      return
    }

    const confirm = await Swal.fire({
      title: 'Override Return Date?',
      html: `
        <div class="text-left">
          <p class="mb-2">This will change the return date to:</p>
          <p class="font-semibold">${new Date(overriddenDate).toLocaleString()}</p>
          <p class="mt-2 text-sm text-gray-600">Reason: ${reason.trim()}</p>
          <p class="mt-2 text-sm text-orange-600">
            <i class="fas fa-exclamation-triangle mr-1"></i>
            This action will be recorded in the audit log.
          </p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, override it'
    })

    if (!confirm.isConfirmed) return

    setLoading(true)
    try {
      const response = await fetch('/api/overdue/override-return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          transaction_type: transactionType,
          transaction_id: transactionId,
          overridden_return_date: new Date(overriddenDate).toISOString(),
          reason: reason.trim()
        })
      })

      if (response.ok) {
        const result = await response.json()
        await notify.success(
          'Return Date Overridden',
          `New penalty: ₱${result.new_penalty.toFixed(2)}`
        )
        onOverride?.()
        onClose()
      } else {
        let msg = 'Failed to override return date'
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
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                <i className="fas fa-clock-rotate-left mr-2 text-blue-600"></i>
                Override Return Date
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {transactionType === 'BOOK' ? 'Book' : 'Locker'}: {itemName}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Current due date info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-sm">
              <span className="font-medium text-blue-800">Due {transactionType === 'BOOK' ? 'Date' : 'Time'}:</span>{' '}
              <span className="text-blue-700">
                {transactionType === 'BOOK'
                  ? new Date(dueDate).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric'
                    })
                  : new Date(dueDate).toLocaleString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
              </span>
            </div>
            {currentReturnDate && (
              <div className="text-sm mt-1">
                <span className="font-medium text-blue-800">Current Return:</span>{' '}
                <span className="text-blue-700">
                  {transactionType === 'BOOK'
                    ? new Date(currentReturnDate).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric'
                      })
                    : new Date(currentReturnDate).toLocaleString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                </span>
              </div>
            )}
          </div>

          {/* Overridden return date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Overridden Return {transactionType === 'BOOK' ? 'Date' : 'Date & Time'}
            </label>
            <input
              type={transactionType === 'BOOK' ? 'date' : 'datetime-local'}
              value={overriddenDate}
              onChange={(e) => setOverriddenDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Set this to the due date or earlier to avoid fining the borrower.
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Override <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Student was 5 minutes late, item was returned on time but system recorded wrong time..."
              required
            />
          </div>

          {/* Info note */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <i className="fas fa-info-circle text-amber-600 mt-0.5"></i>
              <div className="text-xs text-amber-700">
                <p>This action will be recorded in the audit log with your name and the reason.</p>
                <p className="mt-1">The penalty will be recalculated based on the new return date.</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? (
                <><i className="fas fa-spinner fa-spin mr-1"></i> Overriding...</>
              ) : (
                <><i className="fas fa-clock-rotate-left mr-1"></i> Override Return Date</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
