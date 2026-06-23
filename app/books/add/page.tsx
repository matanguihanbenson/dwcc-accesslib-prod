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

/**
 * Quick actions available from the page header. Each maps a
 * display label + icon to either:
 *   - `endpoint`: a server endpoint to POST to (for
 *     API-backed options like Sections and Categories).
 *   - `optionKind`: an OptionKind on the form, in which case
 *     the page calls `formRef.current.addOption(kind, value)`
 *     to push the new value into the form's local option list.
 *
 * The `mode` controls whether the modal shows a description
 * field alongside the name.
 */
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
  const [sections, setSections] = useState<{ section_id: number; name: string }[]>([])

  // The header quick action modal state. `null` means the
  // modal is closed.
  const [quickAdd, setQuickAdd] = useState<QuickAction | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') {
        return
      }

      if (status === 'authenticated' && session?.user) {
        if (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF') {
          console.warn('Access denied: User does not have required privileges')
          router.push('/dashboard')
          return
        }
        console.log('NextAuth session ready for add book')
        setAuthReady(true)
      } else {
        try {
          const response = await fetch('/api/users/profile', {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          })

          if (response.ok) {
            const userData = await response.json()
            if (userData.role !== 'ADMIN' && userData.role !== 'STAFF') {
              console.warn('Access denied: User does not have required privileges')
              router.push('/dashboard')
              return
            }
            console.log('JWT token authentication ready for add book')
            setAuthReady(true)
          } else {
            console.warn('No valid authentication found, redirecting to login')
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

  const handleSubmit = async (data: any) => {
    try {
      notify.loading('Adding book...', 'Please wait while we save the record')
      const response = await fetch('/api/books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data)
      })

      if (response.ok) {
        notify.close()
        await notify.success('Success', 'Book added successfully')
        router.push('/books')
      } else {
        let message = 'Failed to add book'
        try {
          const errorData = await response.json()
          message = errorData.error || errorData.message || message
        } catch (_) {
          const text = await response.text()
          if (text) message = text
        }
        notify.close()
        await notify.error('Error', message)
      }
    } catch (error) {
      notify.close()
      await notify.error('Error', 'Network error occurred')
      console.error('Error adding book:', error)
    }
  }

  // Local option lists mirror the form's hard-coded option
  // arrays. They're used to populate the right column of the
  // header quick-action modal so the user sees the existing
  // values and the new one appears immediately.
  const [localOptions, setLocalOptions] = useState<Record<OptionKind, string[]>>({
    materialType: ['Book', 'eBook', 'Audiobook', 'DVD', 'Magazine'],
    subtype: ['Paperback', 'Hardcover', 'Board Book'],
    interestLevel: ['Adult', 'Young Adult', 'Middle Grade', 'Early Readers'],
    lexile: ['No Code', 'BR (Beginning Reader)', 'NP (Non-Prose)', 'HL (High-Low)'],
    fountasPinnell: ['Any Level', 'Level A', 'Level B', 'Level C', 'Level D', 'Level Z']
  })

  // Read the form's local option lists so the page can show
  // them in the quick-action modal's right column. We mirror
  // them on the page via `localOptions` and keep them in sync
  // by reading from the form on first mount. The form's
  // imperative handle also exposes `addOption` so we can
  // append new values without a full round-trip.
  useEffect(() => {
    // The form's initial options are these defaults; the
    // hook's `addOption` keeps the form's state updated.
    // No need to read from the form on mount — we just need
    // to keep `localOptions` in sync with the form when we
    // add via the quick action modal. The `AddOptionModal`
    // already appends the new value to its own visible list;
    // the page also appends it to `localOptions` via the
    // `onAdded` callback below so the next open of the modal
    // for the same kind shows the updated list.
  }, [])

  const openQuickAdd = (action: QuickAction) => setQuickAdd(action)
  const closeQuickAdd = useCallback(() => setQuickAdd(null), [])

  // Re-derive the visible "existing options" for the right
  // column of the header quick-action modal. We prefer the
  // page's local mirror (which we keep updated) and fall back
  // to the form's defaults so the user sees the full list
  // even on the first open.
  const getQuickAddExistingOptions = (): AddOptionItem[] => {
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
  }

  // After a quick action successfully adds, push the new
  // value into the matching local state + the form via the
  // imperative handle. The AddOptionModal's own local list
  // already shows the new value highlighted; this keeps the
  // page's mirror in sync for the next open.
  const handleQuickAdd = useCallback(
    async (item: AddOptionItem) => {
      if (!quickAdd) return
      if (quickAdd.kind === 'server' && quickAdd.endpoint === '/api/sections') {
        // Sections are API-backed: the modal already POSTed.
        // The form's imperative handle syncs the dropdown.
        formRef.current?.addSection({
          section_id: item.id as number,
          name: item.name
        })
        setSections((prev) =>
          prev.some((s) => s.section_id === item.id)
            ? prev
            : [...prev, { section_id: item.id as number, name: item.name }]
        )
      } else if (
        quickAdd.kind === 'server' &&
        quickAdd.endpoint === '/api/book-categories'
      ) {
        formRef.current?.addCategory({
          category_id: item.id as number,
          name: item.name
        })
        setCategories((prev) =>
          prev.some((c) => c.category_id === item.id)
            ? prev
            : [...prev, { category_id: item.id as number, name: item.name }]
        )
      } else if (quickAdd.kind === 'local') {
        const kind = quickAdd.optionKind
        formRef.current?.addOption(kind, item.name)
        setLocalOptions((prev) => ({
          ...prev,
          [kind]: prev[kind].some(
            (v) => v.toLowerCase() === item.name.toLowerCase()
          )
            ? prev[kind]
            : [...prev[kind], item.name]
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
      {/* Page Header with Back Button, Breadcrumb, and Quick Actions */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/books')}
            className="text-gray-600 hover:text-gray-900 transition-colors"
            aria-label="Back to books"
          >
            <i className="fas fa-arrow-left text-lg"></i>
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Add New Book</h1>
            <nav className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
              <button onClick={() => router.push('/books')} className="hover:text-gray-700">
                Books
              </button>
              <i className="fas fa-chevron-right text-xs"></i>
              <span className="text-gray-900 font-medium">Add New</span>
            </nav>
          </div>
        </div>

        {/* Quick actions: add the various select options
            (section, category, material type, etc.) without
            leaving the page. Each button opens the same
            2-column AddOptionModal. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider mr-1">
            Quick add
          </span>
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => openQuickAdd(action)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
            >
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

      {/* Header quick-action modal: 2-column layout (input on
          left, existing options on right). For server-backed
          options the modal POSTs to the API; for local
          options it calls back into the form via the
          imperative handle so the new value lands in the
          form's dropdown. */}
      {quickAdd && (
        <AddOptionModal
          isOpen={true}
          onClose={closeQuickAdd}
          title={`Add New ${quickAdd.label}`}
          description={
            quickAdd.kind === 'server'
              ? 'Saved to the library and immediately available for new book records.'
              : 'Added to the form\'s dropdown so you can pick it for the new book.'
          }
          icon={quickAdd.icon}
          endpoint={quickAdd.kind === 'server' ? quickAdd.endpoint : undefined}
          mode={quickAdd.mode}
          existingOptions={getQuickAddExistingOptions()}
          onAdded={handleQuickAdd}
        />
      )}
    </div>
  )
}
