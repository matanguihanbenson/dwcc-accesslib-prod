'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { notify } from '@/lib/notification'

interface BookCopy {
  copy_id: number
  accession_number: string
  barcode: string | null
  status: string
  condition: string
  location: string | null
  notes: string | null
  acquisition_date: string | null
  created_at: string
}

interface BookData {
  book_id: number
  title: string
  call_number: string | null
  copies_total: number
  copies_available: number
}

const CONDITION_OPTIONS = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'MISSING'] as const

const conditionColor = (c: string) => {
  switch (c) {
    case 'EXCELLENT': return 'bg-emerald-100 text-emerald-800'
    case 'GOOD': return 'bg-green-100 text-green-800'
    case 'FAIR': return 'bg-yellow-100 text-yellow-800'
    case 'POOR': return 'bg-orange-100 text-orange-800'
    case 'DAMAGED': return 'bg-red-100 text-red-800'
    case 'MISSING': return 'bg-gray-200 text-gray-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

const statusColor = (s: string) => {
  switch (s) {
    case 'AVAILABLE': return 'bg-green-100 text-green-800'
    case 'BORROWED': return 'bg-blue-100 text-blue-800'
    case 'MAINTENANCE': return 'bg-yellow-100 text-yellow-800'
    default: return 'bg-gray-100 text-gray-700'
  }
}

let tempIdCounter = -1

export default function AccessionPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const params = useParams()
  const bookId = Number(params.id)

  const [loading, setLoading] = useState(true)
  const [book, setBook] = useState<BookData | null>(null)
  const [copies, setCopies] = useState<BookCopy[]>([])
  const [editing, setEditing] = useState(false)
  const [manualNumbers, setManualNumbers] = useState<Record<number, string>>({})
  const [manualConditions, setManualConditions] = useState<Record<number, string>>({})
  const [manualDates, setManualDates] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  useEffect(() => {
    if (sessionStatus === 'loading') return
    if (sessionStatus !== 'authenticated') router.push('/login')
  }, [sessionStatus, router])

  useEffect(() => {
    if (!bookId || sessionStatus !== 'authenticated') return
    let cancelled = false

    const loadData = async () => {
      setLoading(true)
      try {
        const [bookRes, copiesRes] = await Promise.all([
          fetch(`/api/books/${bookId}`, { credentials: 'include' }),
          fetch(`/api/books/${bookId}/copies`, { credentials: 'include' })
        ])
        if (cancelled) return

        if (bookRes.ok) {
          const bookJson = await bookRes.json()
          setBook(bookJson.data || bookJson)
        }
        if (copiesRes.ok) {
          const copiesJson = await copiesRes.json()
          const list: BookCopy[] = Array.isArray(copiesJson) ? copiesJson : (copiesJson.data || [])
          setCopies(list)
          fillEditState(list)
        }
      } catch (err) {
        console.error('Failed to load book data:', err)
        await notify.error('Error', 'Failed to load book data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => { cancelled = true }
  }, [bookId, sessionStatus])

  const fillEditState = (list: BookCopy[]) => {
    const nums: Record<number, string> = {}
    const conds: Record<number, string> = {}
    const dates: Record<number, string> = {}
    list.forEach((c) => {
      nums[c.copy_id] = c.accession_number || ''
      conds[c.copy_id] = c.condition || 'GOOD'
      dates[c.copy_id] = c.acquisition_date ? c.acquisition_date.substring(0, 10) : ''
    })
    setManualNumbers(nums)
    setManualConditions(conds)
    setManualDates(dates)
  }

  const handleManualChange = (copyId: number, value: string) => {
    setManualNumbers((prev) => ({ ...prev, [copyId]: value }))
  }
  const handleConditionChange = (copyId: number, value: string) => {
    setManualConditions((prev) => ({ ...prev, [copyId]: value }))
  }
  const handleDateChange = (copyId: number, value: string) => {
    setManualDates((prev) => ({ ...prev, [copyId]: value }))
  }

  // Add a new temporary copy row
  const handleAddCopy = () => {
    const tempId = tempIdCounter--
    const nextNum = copies.length + 1
    const tempCopy: BookCopy = {
      copy_id: tempId,
      accession_number: '',
      barcode: null,
      status: 'AVAILABLE',
      condition: 'GOOD',
      location: null,
      notes: null,
      acquisition_date: null,
      created_at: new Date().toISOString(),
    }
    setCopies((prev) => [...prev, tempCopy])
    setManualNumbers((prev) => ({ ...prev, [tempId]: '' }))
    setManualConditions((prev) => ({ ...prev, [tempId]: 'GOOD' }))
    setManualDates((prev) => ({ ...prev, [tempId]: '' }))
  }

  // Remove a copy (temporary or persisted)
  const handleRemoveCopy = async (copyId: number) => {
    if (copyId < 0) {
      // Temporary copy — just remove from state
      setCopies((prev) => prev.filter((c) => c.copy_id !== copyId))
      setManualNumbers((prev) => { const n = { ...prev }; delete n[copyId]; return n })
      setManualConditions((prev) => { const n = { ...prev }; delete n[copyId]; return n })
      setManualDates((prev) => { const n = { ...prev }; delete n[copyId]; return n })
      return
    }

    // Persisted copy — confirm then DELETE
    const confirmed = window.confirm('Are you sure you want to remove this copy? This cannot be undone.')
    if (!confirmed) return

    setDeleting(copyId)
    try {
      const res = await fetch(`/api/books/${bookId}/copies/${copyId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        await notify.success('Removed', 'Copy removed successfully')
        setCopies((prev) => prev.filter((c) => c.copy_id !== copyId))
        setManualNumbers((prev) => { const n = { ...prev }; delete n[copyId]; return n })
        setManualConditions((prev) => { const n = { ...prev }; delete n[copyId]; return n })
        setManualDates((prev) => { const n = { ...prev }; delete n[copyId]; return n })
        // Refresh book counts
        const bookRes = await fetch(`/api/books/${bookId}`, { credentials: 'include' })
        if (bookRes.ok) {
          const bookJson = await bookRes.json()
          setBook(bookJson.data || bookJson)
        }
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to remove copy' }))
        await notify.error('Error', err.error || 'Failed to remove copy')
      }
    } catch (err) {
      console.error('Failed to remove copy:', err)
      await notify.error('Error', 'Failed to remove copy')
    } finally {
      setDeleting(null)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Check for duplicate accession numbers (only non-empty)
      const values = Object.values(manualNumbers).filter((v) => v.trim())
      const unique = new Set(values)
      if (unique.size !== values.length) {
        await notify.error('Duplicate', 'Duplicate accession numbers found')
        setSaving(false)
        return
      }

      const errors: string[] = []

      // Separate new (temp) vs existing copies
      const newCopies = copies.filter((c) => c.copy_id < 0)
      const existingCopies = copies.filter((c) => c.copy_id > 0)

      // PATCH existing copies
      const patchResults = await Promise.all(
        existingCopies.map((c) =>
          fetch(`/api/books/${bookId}/copies/${c.copy_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              accession_number: manualNumbers[c.copy_id]?.trim().toUpperCase() || undefined,
              condition: manualConditions[c.copy_id] || undefined,
              acquisition_date: manualDates[c.copy_id] || null,
            }),
          }).then(async (r) => {
            if (!r.ok) {
              const err = await r.json().catch(() => ({ error: 'Unknown error' }))
              errors.push(err.error || `Copy ${c.copy_id} failed`)
            }
            return r
          })
        )
      )

      // POST new copies (one by one to handle errors)
      for (const c of newCopies) {
        const accNum = manualNumbers[c.copy_id]?.trim().toUpperCase()
        if (!accNum) {
          errors.push(`Row ${copies.indexOf(c) + 1}: accession number is required`)
          continue
        }
        const res = await fetch(`/api/books/${bookId}/copies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            accession_number: accNum,
            condition: manualConditions[c.copy_id] || 'GOOD',
            acquisition_date: manualDates[c.copy_id] || null,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Unknown error' }))
          errors.push(err.error || `Failed to add copy ${accNum}`)
        }
      }

      if (errors.length > 0) {
        await notify.error('Error', errors[0])
      } else {
        await notify.success('Saved', `${newCopies.length > 0 ? newCopies.length + ' added, ' : ''}${existingCopies.length} updated`)
        router.push('/books')
      }
    } catch (err) {
      console.error('Failed to save:', err)
      await notify.error('Error', 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDone = () => {
    setEditing(false)
  }

  const handleCancelEdit = () => {
    // Remove any unsaved temp copies
    setCopies((prev) => prev.filter((c) => c.copy_id > 0))
    fillEditState(copies.filter((c) => c.copy_id > 0))
    setEditing(false)
  }

  if (loading || sessionStatus === 'loading') {
    return (
      <div className="px-6 py-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Loading book data...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!book) {
    return (
      <div className="px-6 py-4">
        <div className="text-center text-red-600">Book not found</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center space-x-4">
          <button onClick={() => router.push('/books')} className="text-gray-600 hover:text-gray-900 transition-colors" aria-label="Back to books">
            <i className="fas fa-arrow-left text-lg"></i>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Accession Management</h1>
            <nav className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
              <button onClick={() => router.push('/books')} className="hover:text-gray-700">Books</button>
              <i className="fas fa-chevron-right text-xs"></i>
              <span className="text-gray-900 font-medium">{book.title}</span>
              <i className="fas fa-chevron-right text-xs"></i>
              <span className="text-gray-500">Accession</span>
            </nav>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => router.push(`/books/${bookId}/view`)}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors whitespace-nowrap"
          >
            <i className="fas fa-eye mr-1"></i>View Book
          </button>
          <button
            onClick={() => router.push('/books')}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors whitespace-nowrap"
          >
            <i className="fas fa-arrow-left mr-1"></i>Back to Books
          </button>
        </div>
      </div>

      {/* Book summary card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <i className="fas fa-book text-blue-600"></i>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{book.title}</p>
            <p className="text-sm text-gray-500">
              {book.call_number && <span className="font-mono">{book.call_number}</span>}
              {book.call_number && <span className="mx-2">·</span>}
              {copies.length} {copies.length === 1 ? 'copy' : 'copies'}
            </p>
          </div>
        </div>
      </div>

      {/* Copies table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Copies</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {editing ? 'Edit, add, or remove copies below.' : 'Review the copies listed below.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddCopy}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            >
              <i className="fas fa-plus mr-1"></i>Add Copy
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
            >
              {saving ? (
                <><i className="fas fa-spinner fa-spin mr-1"></i>Saving...</>
              ) : (
                <><i className="fas fa-check mr-1"></i>Save</>
              )}
            </button>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              >
                <i className="fas fa-pen mr-1"></i>Edit
              </button>
            ) : (
              <>
                <button
                  onClick={handleDone}
                  className="px-3 py-1.5 text-sm font-medium text-green-600 hover:bg-green-50 rounded-md transition-colors"
                >
                  <i className="fas fa-check mr-1"></i>Done
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Call Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Accession Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Condition</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acquired Date</th>
                {editing && <th className="px-4 py-3 w-12"></th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {copies.length === 0 ? (
                <tr>
                  <td colSpan={editing ? 7 : 6} className="px-4 py-8 text-center text-sm text-gray-500">
                    {editing ? (
                      <div className="space-y-2">
                        <p>No copies yet.</p>
                        <button
                          onClick={handleAddCopy}
                          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          <i className="fas fa-plus"></i>Add First Copy
                        </button>
                      </div>
                    ) : (
                      'No copies found for this book.'
                    )}
                  </td>
                </tr>
              ) : (
                copies.map((copy, i) => {
                  const isTemp = copy.copy_id < 0
                  const isDeletingThis = deleting === copy.copy_id
                  // Copy number based on accession order (temp copies use their index)
                  const stableCopies = copies.filter((c) => c.copy_id > 0)
                  const sortedStable = [...stableCopies].sort((a, b) =>
                    a.accession_number.localeCompare(b.accession_number)
                  )
                  const copyNum = isTemp
                    ? sortedStable.length + 1
                    : (sortedStable.findIndex((c) => c.copy_id === copy.copy_id) + 1) || i + 1
                  const copyCallNumber = book.call_number
                    ? (copyNum === 1 ? book.call_number : `${book.call_number} c.${copyNum}`)
                    : '—'
                  return (
                    <tr key={copy.copy_id} className={`hover:bg-gray-50 ${isTemp ? 'bg-blue-50/30' : ''}`}>
                      <td className="px-4 py-3 text-sm text-gray-500">{i + 1}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-700">
                        {copyCallNumber}
                      </td>
                      <td className="px-4 py-3">
                        {editing ? (
                          <input
                            type="text"
                            value={manualNumbers[copy.copy_id] || ''}
                            onChange={(e) => handleManualChange(copy.copy_id, e.target.value)}
                            placeholder={isTemp ? 'Type accession number' : ''}
                            className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-1.5 text-sm font-mono
                              focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm font-mono font-medium text-gray-900">
                            {copy.accession_number || '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(copy.status)}`}>
                          {copy.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {editing ? (
                          <select
                            value={manualConditions[copy.copy_id] || 'GOOD'}
                            onChange={(e) => handleConditionChange(copy.copy_id, e.target.value)}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm
                              focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          >
                            {CONDITION_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${conditionColor(copy.condition)}`}>
                            {copy.condition}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editing ? (
                          <input
                            type="date"
                            value={manualDates[copy.copy_id] || ''}
                            onChange={(e) => handleDateChange(copy.copy_id, e.target.value)}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm
                              focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-700">
                            {copy.acquisition_date
                              ? new Date(copy.acquisition_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                              : '—'}
                          </span>
                        )}
                      </td>
                      {editing && (
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleRemoveCopy(copy.copy_id)}
                            disabled={isDeletingThis}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                            title="Remove copy"
                          >
                            {isDeletingThis ? (
                              <i className="fas fa-spinner fa-spin text-sm"></i>
                            ) : (
                              <i className="fas fa-trash-alt text-sm"></i>
                            )}
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
