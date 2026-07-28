'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { notify } from '@/lib/notification'
import {
  EnhancedBookForm,
  type BookFormHandle,
  type OptionKind
} from '@/components/forms/EnhancedBookForm'
import AddOptionModal, {
  type AddOptionItem
} from '@/components/forms/AddOptionModal'
import BookPreviewModal from '@/components/forms/BookPreviewModal'
import { generateCallNumber } from '@/lib/call-number'

type QuickAction = {
  label: string
  icon: string
  mode: 'name-only' | 'name-and-description'
} & (
  | { kind: 'server'; endpoint: string }
  | { kind: 'local'; optionKind: OptionKind }
)

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Section', icon: 'fa-layer-group', kind: 'server', endpoint: '/api/sections', mode: 'name-and-description' },
  { label: 'Category', icon: 'fa-folder', kind: 'server', endpoint: '/api/book-categories', mode: 'name-and-description' },
  { label: 'Material Type', icon: 'fa-book', kind: 'local', optionKind: 'materialType', mode: 'name-only' },
  { label: 'Subtype', icon: 'fa-bookmark', kind: 'local', optionKind: 'subtype', mode: 'name-only' },
  { label: 'Interest Level', icon: 'fa-signal', kind: 'local', optionKind: 'interestLevel', mode: 'name-only' },
  { label: 'Lexile', icon: 'fa-chart-line', kind: 'local', optionKind: 'lexile', mode: 'name-only' },
  { label: 'Fountas & Pinnell', icon: 'fa-layer-group', kind: 'local', optionKind: 'fountasPinnell', mode: 'name-only' }
]

export default function AddBookPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const formRef = useRef<BookFormHandle>(null)
  const [authReady, setAuthReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<{ category_id: number; name: string }[]>([])
  const [sections, setSections] = useState<{ section_id: number; name: string; code?: string | null }[]>([])
  const [quickAdd, setQuickAdd] = useState<QuickAction | null>(null)

  // ── Preview Modal state ─────────────────────────────────
  const [showPreview, setShowPreview] = useState(false)
  const [pendingBookData, setPendingBookData] = useState<any>(null)
  const [suggestedCallNumber, setSuggestedCallNumber] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') return
      if (status === 'authenticated' && session?.user) {
        if (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF') {
          console.warn('Access denied: User does not have required privileges')
          router.push('/dashboard')
          return
        }
        setAuthReady(true)
      } else {
        try {
          const response = await fetch('/api/users/profile', {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          })
          if (response.ok) {
            const userData = await response.json()
            if (userData.role !== 'ADMIN' && userData.role !== 'STAFF') {
              console.warn('Access denied: User does not have required privileges')
              router.push('/dashboard')
              return
            }
            setAuthReady(true)
          } else {
            router.push('/login')
            return
          }
        } catch (error) {
          console.warn('Auth check failed, redirecting to login:', error)
          router.push('/login')
          return
        }
      }
    }
    checkAuth()
  }, [session, status, router])

  useEffect(() => {
    if (!authReady) return
    const loadOptions = async () => {
      try {
        setLoading(true)
        const [catRes, secRes] = await Promise.all([
          fetch('/api/book-categories', { credentials: 'include' }),
          fetch('/api/sections', { credentials: 'include' })
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
      } catch (err) {
        console.error('Failed to load categories/sections', err)
      } finally {
        setLoading(false)
      }
    }
    loadOptions()
  }, [authReady])

  // Step 1: Capture form data, generate call number via API (with shelflist interpolation), show preview
  const handleSubmit = useCallback(async (data: any) => {
    let classificationCode = null
    if (data.classification_id) {
      try {
        const classRes = await fetch(`/api/book-classifications/${data.classification_id}`, { credentials: 'include' })
        if (classRes.ok) {
          const classData = await classRes.json()
          const classInfo = classData.data || classData
          classificationCode = classInfo?.code || null
        }
      } catch {}
    }

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

    setPendingBookData({ ...data, classification_code: classificationCode })
    setSuggestedCallNumber(finalCallNumber)
    setShowPreview(true)
  }, [sections])

  // Step 2: User confirms preview → save book + copies → redirect to accession
  const handlePreviewConfirm = useCallback(async (callNumber: string, copiesCount: number = 1) => {
    if (!pendingBookData) return
    setSaving(true)
    try {
      notify.loading('Saving book...', 'Creating the book record')

      const bookRes = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(pendingBookData)
      })

      if (!bookRes.ok) {
        let message = 'Failed to add book'
        try {
          const err = await bookRes.json()
          message = err.error || err.message || message
        } catch {}
        notify.close()
        await notify.error('Error', message)
        setSaving(false)
        return
      }

      const bookResult = await bookRes.json()
      const book = bookResult.data || bookResult
      const bookId = book.book_id || book.id

      // Create copies
      const copyRes = await fetch(`/api/books/${bookId}/copies/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mode: 'auto',
          count: copiesCount,
          call_number: callNumber
        })
      })

      notify.close()

      if (copyRes.ok) {
        setShowPreview(false)
        setPendingBookData(null)
        await notify.success('Book saved', `${copiesCount} cop${copiesCount > 1 ? 'ies' : 'y'} created`)
        router.push(`/books/${bookId}/accession`)
      } else {
        setShowPreview(false)
        setPendingBookData(null)
        await notify.success('Book saved', 'You can manage copies from the book page')
        router.push(`/books/${bookId}/accession`)
      }
    } catch (error) {
      notify.close()
      await notify.error('Error', 'Network error occurred')
      setSaving(false)
    }
  }, [pendingBookData, router])

  const [localOptions, setLocalOptions] = useState<Record<OptionKind, string[]>>({
    materialType: ['Book', 'eBook', 'Audiobook', 'DVD', 'Magazine'],
    subtype: ['Paperback', 'Hardcover', 'Board Book'],
    interestLevel: ['Adult', 'Young Adult', 'Middle Grade', 'Early Readers'],
    lexile: ['No Code', 'BR (Beginning Reader)', 'NP (Non-Prose)', 'HL (High-Low)'],
    fountasPinnell: ['Any Level', 'Level A', 'Level B', 'Level C', 'Level D', 'Level Z']
  })

  useEffect(() => {
    let cancelled = false
    const merge = (current: string[], next: string[]) => {
      const seen = new Set<string>()
      const out: string[] = []
      for (const v of current) { if (!seen.has(v)) { seen.add(v); out.push(v) } }
      for (const v of next) { if (!seen.has(v)) { seen.add(v); out.push(v) } }
      return out
    }
    const types: Array<{
      api: 'MATERIAL_TYPE' | 'SUBTYPE' | 'INTEREST_LEVEL' | 'LEXILE' | 'FOUNTAS_PINNELL'
      kind: OptionKind
    }> = [
      { api: 'MATERIAL_TYPE', kind: 'materialType' },
      { api: 'SUBTYPE', kind: 'subtype' },
      { api: 'INTEREST_LEVEL', kind: 'interestLevel' },
      { api: 'LEXILE', kind: 'lexile' },
      { api: 'FOUNTAS_PINNELL', kind: 'fountasPinnell' }
    ]
    Promise.all(
      types.map((t) =>
        fetch(`/api/book-catalog-values?type=${t.api}&all=true`, {
          credentials: 'include',
        }).then((r) => (r.ok ? r.json() : [])).catch(() => [])
      )
    ).then((results) => {
      if (cancelled) return
      const merged = { ...localOptions }
      types.forEach((t, i) => {
        const raw = results[i]
        const values: string[] = Array.isArray(raw)
          ? raw.map((v: any) => (typeof v === 'string' ? v : v?.value || v?.name || '')).filter(Boolean)
          : []
        merged[t.kind] = merge(merged[t.kind], values)
      })
      setLocalOptions(merged)
    })
    return () => { cancelled = true }
  }, [])

  const closeQuickAdd = useCallback(() => setQuickAdd(null), [])

  const openQuickAdd = useCallback((action: QuickAction) => {
    setQuickAdd(action)
  }, [])

  const getQuickAddExistingOptions = useCallback(() => {
    if (!quickAdd) return []
    if (quickAdd.kind === 'server' && quickAdd.endpoint === '/api/sections') {
      return sections.map((s) => ({ id: s.section_id, name: s.name }))
    }
    if (quickAdd.kind === 'server' && quickAdd.endpoint === '/api/book-categories') {
      return categories.map((c) => ({ id: c.category_id, name: c.name }))
    }
    if (quickAdd.kind === 'local') {
      return localOptions[quickAdd.optionKind].map((name) => ({ name }))
    }
    return []
  }, [quickAdd, sections, categories, localOptions])

  const handleQuickAdd = useCallback(
    async (item: AddOptionItem) => {
      if (!quickAdd) return
      if (quickAdd.kind === 'server' && quickAdd.endpoint === '/api/sections') {
        formRef.current?.addSection({ section_id: item.id as number, name: item.name })
        setSections((prev) =>
          prev.some((s) => s.section_id === item.id) ? prev : [...prev, { section_id: item.id as number, name: item.name }]
        )
      } else if (quickAdd.kind === 'server' && quickAdd.endpoint === '/api/book-categories') {
        formRef.current?.addCategory({ category_id: item.id as number, name: item.name })
        setCategories((prev) =>
          prev.some((c) => c.category_id === item.id) ? prev : [...prev, { category_id: item.id as number, name: item.name }]
        )
      } else if (quickAdd.kind === 'local') {
        const kind = quickAdd.optionKind
        formRef.current?.addOption(kind, item.name)
        setLocalOptions((prev) => ({
          ...prev,
          [kind]: prev[kind].some((v) => v.toLowerCase() === item.name.toLowerCase()) ? prev[kind] : [...prev[kind], item.name]
        }))
      }
    },
    [quickAdd]
  )

  if (!authReady || loading) {
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center space-x-4">
          <button onClick={() => router.push('/books')} className="text-gray-600 hover:text-gray-900 transition-colors" aria-label="Back to books">
            <i className="fas fa-arrow-left text-lg"></i>
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Add New Book</h1>
            <nav className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
              <button onClick={() => router.push('/books')} className="hover:text-gray-700">Books</button>
              <i className="fas fa-chevron-right text-xs"></i>
              <span className="text-gray-900 font-medium">Add New</span>
            </nav>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider mr-1">Quick add</span>
          {QUICK_ACTIONS.map((action) => (
            <button key={action.label} type="button" onClick={() => openQuickAdd(action)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-blue-300 hover:text-blue-700 transition-colors">
              <i className={`fas ${action.icon} text-gray-500`}></i>
              <span>+ {action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <EnhancedBookForm
          ref={formRef}
          categories={categories}
          sections={sections}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/books')}
          isEditing={false}
        />
      </div>

      {/* Quick-action modal */}
      {quickAdd && (
        <AddOptionModal
          isOpen={true}
          onClose={closeQuickAdd}
          title={`Add New ${quickAdd.label}`}
          description={quickAdd.kind === 'server' ? 'Saved to the library and immediately available for new book records.' : 'Added to the form\'s dropdown so you can pick it for the new book.'}
          icon={quickAdd.icon}
          endpoint={quickAdd.kind === 'server' ? quickAdd.endpoint : undefined}
          mode={quickAdd.mode}
          existingOptions={getQuickAddExistingOptions()}
          onAdded={handleQuickAdd}
        />
      )}

      {/* Book Preview Modal — call number + copies count → save */}
      <BookPreviewModal
        isOpen={showPreview}
        onClose={() => { setShowPreview(false); setPendingBookData(null) }}
        onConfirm={handlePreviewConfirm}
        bookData={pendingBookData || {}}
        suggestedCallNumber={suggestedCallNumber}
        loading={saving}
      />
    </div>
  )
}
