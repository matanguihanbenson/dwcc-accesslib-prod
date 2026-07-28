'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { notify } from '@/lib/notification'
import { EnhancedBookForm } from '@/components/forms/EnhancedBookForm'
import BookPreviewModal from '@/components/forms/BookPreviewModal'
import { useUserStatus } from '@/lib/hooks'
import { UserRole, Book } from '@/types'
import { generateCallNumber } from '@/lib/call-number'

export default function EditBookPage() {
  const router = useRouter()
  const params = useParams()
  const bookId = params.id as string
  const { isLoading: authLoading, isAuthenticated, isStaff } = useUserStatus()
  
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<{ category_id: number; name: string }[]>([])
  const [sections, setSections] = useState<{ section_id: number; name: string; code?: string | null }[]>([])
  const [bookData, setBookData] = useState<Partial<Book> | null>(null)

  // Preview modal state
  const [showPreview, setShowPreview] = useState(false)
  const [pendingData, setPendingData] = useState<any>(null)
  const [suggestedCallNumber, setSuggestedCallNumber] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (authLoading) return
    
    // Redirect if not authenticated or not staff
    if (!isAuthenticated || !isStaff) {
      router.push('/login')
      return
    }
    
    const loadData = async () => {
      try {
        setLoading(true)
        const [catRes, secRes, bookRes] = await Promise.all([
          fetch('/api/book-categories', { credentials: 'include' }),
          fetch('/api/sections', { credentials: 'include' }),
          fetch(`/api/books/${bookId}`, { credentials: 'include' })
        ])

        if (catRes.ok) {
          const catData = await catRes.json()
          const list = Array.isArray(catData) ? catData : (catData.data || [])
          setCategories(list)
        }

        if (secRes.ok) {
          const secData = await secRes.json()
          const list = Array.isArray(secData) ? secData : (secData.data || [])
          setSections(list)
        }

        if (!bookRes.ok) {
          const j = await bookRes.json().catch(() => ({}))
          await notify.error('Error', j.error || 'Failed to fetch book')
          router.push('/books')
          return
        }

        const bookPayload = await bookRes.json()
        const book = Array.isArray(bookPayload) ? bookPayload[0] : (bookPayload.data || bookPayload)
        setBookData(book)
      } catch (err) {
        await notify.error('Error', 'Network error fetching book')
        router.push('/books')
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [authLoading, isAuthenticated, isStaff, bookId, router])

  // Intercept form submission: capture data, fetch classification code, call cutter API, show preview
  const handleFormSubmit = useCallback(async (data: any) => {
    // Fetch the classification code if we have a classification_id
    let classificationCode = null
    if (data.classification_id) {
      try {
        const res = await fetch(`/api/book-classifications/${data.classification_id}`, {
          credentials: 'include',
          cache: 'no-store'
        })
        if (res.ok) {
          const json = await res.json()
          const node = json.data || json
          classificationCode = node?.code || null
        }
      } catch {
        // non-critical — call number will just omit DDC
      }
    }

    // Find the section code
    const section = sections.find((s) => s.section_id === data.section_id)
    const sectionCode = section?.code || null

    // Call the cutter API for shelflist-interpolated cutter + workmark
    let cutterPart = ''
    let finalCallNumber = ''
    try {
      const cutterRes = await fetch('/api/cutter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: data.book_author,
          classification_id: data.classification_id,
          section_id: data.section_id,
          title: data.title,
          book_id: Number(bookId), // exclude this book from shelflist
        })
      })
      if (cutterRes.ok) {
        const cutterData = await cutterRes.json()
        const result = cutterData.data || cutterData
        cutterPart = result.full_cutter || ''
      }
    } catch {}

    // Assemble: Section + DDC + CutterWorkmark + Year
    const parts: string[] = []
    if (sectionCode) parts.push(sectionCode)
    if (classificationCode) parts.push(classificationCode)
    if (cutterPart) parts.push(cutterPart)
    const year = data.year_published || data.publication_year
    if (year) parts.push(String(year))
    finalCallNumber = parts.join(' ')

    // Fallback: if API call failed, use local generation
    if (!finalCallNumber || finalCallNumber === sectionCode || finalCallNumber === `${sectionCode} ${classificationCode}`) {
      finalCallNumber = generateCallNumber({
        section_code: sectionCode,
        classification_code: classificationCode,
        book_author: data.book_author,
        title: data.title,
        year_published: year || null,
      })
    }

    setPendingData({ ...data, classification_code: classificationCode })
    setSuggestedCallNumber(finalCallNumber)
    setShowPreview(true)
  }, [sections, bookId])

  // Save with the (possibly edited) call number
  const handleConfirmSave = useCallback(async (callNumber: string) => {
    if (!pendingData) return
    setSaving(true)
    try {
      notify.loading('Updating book...', 'Please wait while we save the changes')
      const response = await fetch(`/api/books/${bookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...pendingData, call_number: callNumber })
      })

      if (response.ok) {
        notify.close()
        await notify.success('Success', 'Book updated successfully')
        router.push(`/books/${bookId}/view`)
      } else {
        let message = 'Failed to update book'
        try {
          const errorData = await response.json()
          message = errorData.error || errorData.message || message
        } catch (_) {
          const text = await response.text()
          if (text) message = text
        }
        notify.close()
        await notify.error('Error', message)
        setShowPreview(false)
      }
    } catch (error) {
      notify.close()
      await notify.error('Error', 'Network error occurred')
      setShowPreview(false)
    } finally {
      setSaving(false)
    }
  }, [pendingData, bookId, router])

  if (authLoading || loading) {
    return (
      <div className="px-6 py-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Loading...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!bookData) {
    return (
      <div className="px-6 py-4">
        <div className="text-center text-gray-600">Book not found</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header with Back Button and Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-900 transition-colors">
            <i className="fas fa-arrow-left text-lg"></i>
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Book</h1>
            <nav className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
              <Link href="/books" className="hover:text-gray-700">Books</Link>
              <i className="fas fa-chevron-right text-xs"></i>
              <Link href={`/books/${bookId}/view`} className="hover:text-gray-700">{bookData.title}</Link>
              <i className="fas fa-chevron-right text-xs"></i>
              <span className="text-gray-900 font-medium">Edit</span>
            </nav>
          </div>
        </div>
        <Link 
          href={`/books/${bookId}/view`}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          <i className="fas fa-eye mr-2"></i>
          View Book
        </Link>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <EnhancedBookForm
          initialData={bookData}
          categories={categories}
          sections={sections}
          onSubmit={handleFormSubmit}
          onCancel={() => router.push(`/books/${bookId}/view`)}
          isEditing={true}
        />
      </div>

      {/* Preview Modal */}
      <BookPreviewModal
        isOpen={showPreview}
        onClose={() => { setShowPreview(false); setPendingData(null) }}
        onConfirm={handleConfirmSave}
        bookData={pendingData || {}}
        suggestedCallNumber={suggestedCallNumber}
        loading={saving}
        isEditing={true}
      />
    </div>
  )
}
