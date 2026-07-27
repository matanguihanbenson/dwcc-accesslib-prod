'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface CallNumberModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (callNumber: string, copiesCount: number) => void
  suggestedCallNumber: string
  loading?: boolean
}

/**
 * Modal that appears after saving a book title. It shows
 * a suggested call number based on the book's classification,
 * section code, author, and year. The user can edit the call
 * number and specify the number of copies before confirming.
 *
 * Call number format: {SectionCode} {DDCCode} {AuthorCutter} {Year}
 * e.g. "CIR 500 S678 2024"
 */
export default function CallNumberModal({
  isOpen,
  onClose,
  onConfirm,
  suggestedCallNumber,
  loading = false
}: CallNumberModalProps) {
  const [callNumber, setCallNumber] = useState(suggestedCallNumber)
  const [copiesCount, setCopiesCount] = useState(1)

  useEffect(() => {
    setCallNumber(suggestedCallNumber)
  }, [suggestedCallNumber])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-tag text-blue-600 text-lg"></i>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Confirm Call Number</h2>
              <p className="text-sm text-gray-500">
                Review and confirm the suggested call number for this book.
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Suggested call number */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">
              Suggested Call Number
            </p>
            <p className="text-sm text-blue-800 font-mono">
              {suggestedCallNumber || 'No classification selected'}
            </p>
          </div>

          {/* Editable call number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Call Number
            </label>
            <input
              type="text"
              value={callNumber}
              onChange={(e) => setCallNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., CIR 500 S678 2024"
            />
            <p className="mt-1 text-xs text-gray-500">
              Format: <span className="font-mono">{'{Section} {DDC} {Author} {Year}'}</span>
            </p>
          </div>

          {/* Number of copies */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Copies <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={copiesCount}
              onChange={(e) => setCopiesCount(Math.max(1, parseInt(e.target.value) || 1))}
              min="1"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Accession numbers will be assigned on the next page.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(callNumber, copiesCount)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white"
            disabled={loading || copiesCount < 1}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <i className="fas fa-check mr-2"></i>
                Confirm &amp; Add Copies
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
