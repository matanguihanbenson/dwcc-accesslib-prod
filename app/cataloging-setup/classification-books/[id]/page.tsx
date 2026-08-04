'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { LoadingScreen } from '@/components/ui/loading-spinner'

const LEVEL_LABEL: Record<string, string> = {
  MAIN_CLASS: 'Main Class',
  DIVISION: 'Division',
  SECTION: 'Section',
  DECIMAL_SUBDIVISION: 'Decimal Subdivision',
  DEEPER_SUBDIVISION: 'Deeper Subdivision'
}

export default function ClassificationBooksPage() {
  const params = useParams()
  const router = useRouter()
  const classificationId = params?.id

  const [classification, setClassification] = useState<{ id: number; code: string; name: string } | null>(null)
  const [books, setBooks] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!classificationId) return
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/book-classifications/${classificationId}/books?limit=500`,
          { credentials: 'include', cache: 'no-store' }
        )
        if (!res.ok) throw new Error('Failed to load books')
        const data = await res.json()
        const payload = data?.data ?? data
        setBooks(payload?.books ?? [])
        setTotal(payload?.total ?? 0)
        // Extract classification info from first book, or fetch separately
        if (payload?.books?.length > 0 && payload.books[0].classification) {
          setClassification(payload.books[0].classification)
        } else {
          // Fetch classification info directly
          const classRes = await fetch(
            `/api/book-classifications/${classificationId}`,
            { credentials: 'include', cache: 'no-store' }
          )
          if (classRes.ok) {
            const classData = await classRes.json()
            setClassification(classData?.data ?? classData)
          }
        }
      } catch (err) {
        setError((err as Error)?.message || 'Failed to load books')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [classificationId])

  if (loading) {
    return <LoadingScreen message="Loading books..." />
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
          >
            <i className="fas fa-arrow-left mr-1"></i>
            Back
          </button>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <i className="fas fa-exclamation-triangle text-red-400 text-3xl mb-3"></i>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
        >
          <i className="fas fa-arrow-left mr-1"></i>
          Back
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            <i className="fas fa-book text-primary-600 mr-2"></i>
            Books under Classification
          </h1>
          {classification && (
            <p className="text-sm text-gray-500">
              <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded mr-1">
                {classification.code}
              </span>
              {classification.name}
              <span className="ml-2 text-gray-400">|</span>
              <span className="ml-2">
                <strong>{total}</strong> book{total === 1 ? '' : 's'} (including descendants)
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Book list */}
      {books.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <i className="fas fa-book text-gray-300 text-4xl mb-3"></i>
          <p className="text-sm text-gray-500">
            No books assigned to this classification or any of its descendants.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Author(s)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Call Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Classification
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {books.map((book: any) => (
                <tr key={book.book_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                      {book.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      {book.isbn || book.publisher || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-[200px] truncate">
                    {book.authors?.map((a: any) => a.name).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-700">
                    {book.call_number || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {book.category?.name || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {book.classification ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary-50 text-primary-700 border border-primary-200">
                        {book.classification.code} · {LEVEL_LABEL[book.classification.level] || book.classification.level}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
