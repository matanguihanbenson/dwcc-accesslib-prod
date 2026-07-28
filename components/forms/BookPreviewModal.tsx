'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface BookPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (callNumber: string, copiesCount?: number) => void
  bookData: {
    title?: string
    subtitle?: string
    book_author?: string
    publisher?: string
    publication_place?: string
    year_published?: number | null
    publication_date?: string | null
    edition?: string | null
    isbn?: string | null
    category?: { name: string } | string | null
    material_type?: string | null
    language?: string | null
    section?: { name: string; code?: string | null } | string | null
    [key: string]: any
  }
  suggestedCallNumber: string
  loading?: boolean
  /** When true, hides the copies input and changes button text to "Save Book" */
  isEditing?: boolean
}

export default function BookPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  bookData,
  suggestedCallNumber,
  loading = false,
  isEditing = false
}: BookPreviewModalProps) {
  const [callNumber, setCallNumber] = useState(suggestedCallNumber)
  const [copiesInput, setCopiesInput] = useState('1')
  const copiesCount = Math.max(1, parseInt(copiesInput) || 0)

  useEffect(() => {
    setCallNumber(suggestedCallNumber)
  }, [suggestedCallNumber])

  if (!isOpen) return null

  const categoryName =
    typeof bookData.category === 'string'
      ? bookData.category
      : bookData.category?.name || null

  const display = (v: any) =>
    v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
      ? null
      : v

  const rows: { label: string; value: string | number | null | undefined; mono?: boolean }[] = [
    { label: 'Title', value: bookData.title },
    { label: 'Subtitle', value: bookData.subtitle },
    { label: 'Author', value: bookData.book_author },
    { label: 'Category', value: categoryName },
    { label: 'Material Type', value: bookData.material_type },
    { label: 'Publisher', value: bookData.publisher },
    { label: 'Place', value: bookData.publication_place },
    { label: 'Year', value: bookData.year_published || bookData.publication_year },
    { label: 'Edition', value: bookData.edition },
    { label: 'Language', value: bookData.language },
    { label: 'ISBN', value: bookData.isbn, mono: true },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-book text-green-600 text-lg"></i>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isEditing ? 'Preview Changes' : 'Preview Book'}
              </h2>
              <p className="text-sm text-gray-500">
                {isEditing
                  ? 'Review the information and confirm the call number.'
                  : 'Review the information, confirm the call number, and set the number of copies.'}
              </p>
            </div>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {/* Book info preview */}
          <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
            {rows
              .filter((r) => display(r.value) !== null)
              .map((r) => (
                <div
                  key={r.label}
                  className="flex items-start justify-between gap-3 px-3 py-2"
                >
                  <span className="text-gray-500 flex-shrink-0">{r.label}</span>
                  <span className={`text-gray-900 text-right ${r.mono ? 'font-mono' : ''}`}>
                    {String(r.value)}
                  </span>
                </div>
              ))}
          </div>

          {/* Call Number — highlighted */}
          <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <i className="fas fa-tag text-amber-600"></i>
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                Call Number
              </p>
            </div>
            {!suggestedCallNumber && (
              <p className="text-xs text-amber-700 bg-amber-100 rounded px-2 py-1">
                <i className="fas fa-info-circle mr-1"></i>
                No section code or classification selected — you can type the call number manually.
              </p>
            )}
            <input
              type="text"
              value={callNumber}
              onChange={(e) => setCallNumber(e.target.value)}
              className="w-full px-3 py-2.5 border border-amber-300 rounded-md font-mono text-base font-semibold text-amber-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder="e.g. FIL 001 C16p 1996"
            />
            <p className="text-xs text-amber-600">
              Format: <span className="font-mono">{'{Section} {DDC} {Author}{Title} {Year}'}</span>
            </p>
          </div>

          {/* Number of copies — only for new books */}
          {!isEditing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Copies <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={copiesInput}
                onChange={(e) => setCopiesInput(e.target.value)}
                min="1"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Accession numbers will be assigned on the next page.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 flex-shrink-0">
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
            onClick={() => isEditing ? onConfirm(callNumber) : onConfirm(callNumber, copiesCount)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white"
            disabled={loading || !callNumber.trim()}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <i className="fas fa-check mr-2"></i>
                {isEditing ? 'Save Book' : 'Save Book & Add Copies'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
