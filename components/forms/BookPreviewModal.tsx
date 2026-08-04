'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { parseCallNumber, assembleCallNumber, type ParsedCallNumber } from '@/lib/call-number'

type Tab = 'insert' | 'generate'

interface GenerateData {
  authorName: string
  classificationId?: number
  classificationCode?: string | null
  sectionId?: number
  sectionCode?: string | null
  title?: string
  year?: number | null
}

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
  generateData?: GenerateData
  loading?: boolean
  /** When true, hides the copies input and changes button text to "Save Book" */
  isEditing?: boolean
}

function buildParsed(cn: string): ParsedCallNumber {
  return parseCallNumber(cn) || { section: '', classification: '', cutter: '', workmark: '', year: '' }
}

export default function BookPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  bookData,
  suggestedCallNumber,
  generateData,
  loading = false,
  isEditing = false
}: BookPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('generate')
  const [parsed, setParsed] = useState<ParsedCallNumber>(() => buildParsed(suggestedCallNumber))
  const [insertInput, setInsertInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copiesInput, setCopiesInput] = useState('1')
  const copiesCount = Math.max(1, parseInt(copiesInput) || 0)

  // Sync from parent when suggestedCallNumber changes (e.g. on open)
  useEffect(() => {
    if (suggestedCallNumber) {
      setParsed(buildParsed(suggestedCallNumber))
    }
  }, [suggestedCallNumber])

  // When the modal opens, pre-fill the insert input with the suggested call number
  useEffect(() => {
    if (isOpen && suggestedCallNumber) {
      setInsertInput(suggestedCallNumber)
    }
  }, [isOpen, suggestedCallNumber])

  const updateField = (field: keyof ParsedCallNumber, value: string) => {
    setParsed((prev) => ({ ...prev, [field]: value }))
  }

  const handleParse = () => {
    const result = parseCallNumber(insertInput)
    if (result) {
      setParsed(result)
    }
  }

  const handleGenerate = async () => {
    if (!generateData) return
    setGenerating(true)
    try {
      const body: any = { name: generateData.authorName }
      if (generateData.classificationId) body.classification_id = generateData.classificationId
      if (generateData.sectionId) body.section_id = generateData.sectionId
      if (generateData.title) body.title = generateData.title

      const res = await fetch('/api/cutter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      })

      if (res.ok) {
        const data = await res.json()
        const result = data.data || data
        setParsed({
          section: generateData.sectionCode || '',
          classification: generateData.classificationCode || '',
          cutter: result.cutter_number || '',
          workmark: result.workmark || '',
          year: generateData.year ? String(generateData.year) : '',
        })
      }
    } catch {
      // silent
    } finally {
      setGenerating(false)
    }
  }

  const callNumber = assembleCallNumber(parsed)

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

          {/* Call Number */}
          <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <i className="fas fa-tag text-amber-600"></i>
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                Call Number
              </p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-amber-200">
              <button
                type="button"
                onClick={() => setActiveTab('generate')}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === 'generate'
                    ? 'border-amber-600 text-amber-800'
                    : 'border-transparent text-amber-600 hover:text-amber-700'
                }`}
              >
                Generate
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('insert')}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === 'insert'
                    ? 'border-amber-600 text-amber-800'
                    : 'border-transparent text-amber-600 hover:text-amber-700'
                }`}
              >
                Insert Existing
              </button>
            </div>

            {/* Tab content */}
            {activeTab === 'insert' && (
              <div className="space-y-2">
                <p className="text-xs text-amber-700">
                  Paste an existing call number from the library and click Parse.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={insertInput}
                    onChange={(e) => setInsertInput(e.target.value)}
                    placeholder="e.g. CIR 020 R69h 1999"
                    className="flex-1 px-3 py-2 border border-amber-300 rounded-md font-mono text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleParse}
                    className="px-3 py-2 text-xs font-medium bg-amber-600 text-white rounded-md hover:bg-amber-700"
                  >
                    Parse
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'generate' && (
              <div className="space-y-2">
                <p className="text-xs text-amber-700">
                  Generate a call number from the book metadata.
                </p>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating || !generateData}
                  className="px-3 py-2 text-xs font-medium bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                >
                  {generating ? (
                    <><span className="animate-spin inline-block mr-1">&#9696;</span> Generating...</>
                  ) : (
                    'Generate Call Number'
                  )}
                </button>
              </div>
            )}

            {/* Parsed fields */}
            <div className="grid grid-cols-5 gap-2">
              <div>
                <label className="block text-xs text-amber-700 font-medium mb-0.5">Section</label>
                <input
                  type="text"
                  value={parsed.section}
                  onChange={(e) => updateField('section', e.target.value)}
                  className="w-full px-2 py-1.5 border border-amber-300 rounded font-mono text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-amber-700 font-medium mb-0.5">DDC</label>
                <input
                  type="text"
                  value={parsed.classification}
                  onChange={(e) => updateField('classification', e.target.value)}
                  className="w-full px-2 py-1.5 border border-amber-300 rounded font-mono text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-amber-700 font-medium mb-0.5">Cutter</label>
                <input
                  type="text"
                  value={parsed.cutter}
                  onChange={(e) => updateField('cutter', e.target.value)}
                  className="w-full px-2 py-1.5 border border-amber-300 rounded font-mono text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-amber-700 font-medium mb-0.5">Title Mark</label>
                <input
                  type="text"
                  value={parsed.workmark}
                  onChange={(e) => updateField('workmark', e.target.value)}
                  className="w-full px-2 py-1.5 border border-amber-300 rounded font-mono text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-amber-700 font-medium mb-0.5">Year</label>
                <input
                  type="text"
                  value={parsed.year}
                  onChange={(e) => updateField('year', e.target.value)}
                  className="w-full px-2 py-1.5 border border-amber-300 rounded font-mono text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Assembled call number */}
            <div className="bg-white border border-amber-300 rounded-md px-3 py-2 font-mono text-sm font-semibold text-amber-900">
              {callNumber || (
                <span className="text-amber-400 font-normal italic">No call number assembled</span>
              )}
            </div>

            <p className="text-xs text-amber-600">
              Format: <span className="font-mono">{'{Section} {DDC} {Cutter}{Title Mark} {Year}'}</span>
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
