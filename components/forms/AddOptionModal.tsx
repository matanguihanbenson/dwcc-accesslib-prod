'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { notify } from '@/lib/notification'

/**
 * Generic 2-column "Add new option" modal.
 *
 * Used by:
 *   - The Add Book page's header quick actions (add section,
 *     add category, add material type, etc.).
 *   - The Enhanced Book Form's inline "+ Add new category /
 *     section" entries in the category / section dropdowns.
 *
 * Layout:
 *   ┌─────────────────────────┬──────────────────────────┐
 *   │ LEFT  input form         │ RIGHT  existing options  │
 *   │   - name (required)      │   - sorted list          │
 *   │   - description (opt.)   │   - new entry highlights│
 *   │   [Cancel] [Add]         │   - empty state          │
 *   └─────────────────────────┴──────────────────────────┘
 *
 * Submission:
 *   - If `endpoint` is provided, the modal POSTs to that
 *     endpoint. The endpoint is expected to return the
 *     created record; its `id` / `name` are added to the
 *     displayed list.
 *   - If `endpoint` is NOT provided, the modal calls
 *     `onAdd(value, extra?)` so the parent can append the
 *     new value to a local list (used for non-DB options
 *     like material type, subtype, interest level, etc.).
 *
 * On success:
 *   - The new option is appended to the right column.
 *   - If `selectNew` is true, the option is also auto-selected
 *     via `onSelect(item)` (used when the modal is opened
 *     from a form whose target field should switch to the
 *     new value).
 */

export interface AddOptionItem {
  id?: number | string
  name: string
  description?: string | null
}

export type AddOptionMode = 'name-only' | 'name-and-description'

export interface AddOptionModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  icon?: string
  // When `endpoint` is set the modal POSTs JSON to it. The
  // endpoint must return either the created record (with
  // an `id`) or `{ id, name, description? }`. Errors are
  // surfaced as a toast.
  endpoint?: string
  // If `endpoint` is NOT set, the parent handles persistence.
  // This is used for non-DB-backed options (material type,
  // interest level, etc.) where the value lives only in the
  // form's local option list.
  onAdd?: (name: string, description?: string) => Promise<AddOptionItem | void> | AddOptionItem | void
  // Pre-existing options to display in the right column.
  existingOptions: AddOptionItem[]
  // When a new option is successfully added the modal calls
  // this so the parent can update the source of truth (e.g.
  // re-fetch the list, or update local state).
  onAdded?: (item: AddOptionItem) => void
  // When a new option is added and the caller wants the
  // form field to auto-switch to it.
  selectNew?: boolean
  onSelect?: (item: AddOptionItem) => void
  // 'name-only' (default) or 'name-and-description'. Controls
  // whether the description field is shown.
  mode?: AddOptionMode
}

export default function AddOptionModal({
  isOpen,
  onClose,
  title,
  description,
  icon = 'fa-plus-circle',
  endpoint,
  onAdd,
  existingOptions,
  onAdded,
  selectNew = false,
  onSelect,
  mode = 'name-only'
}: AddOptionModalProps) {
  const [name, setName] = useState('')
  const [description_, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<AddOptionItem[]>(existingOptions)
  // Highlight the freshly-added row so the user notices it
  // appeared without a page reload.
  const [justAddedName, setJustAddedName] = useState<string | null>(null)

  // Re-sync the displayed list whenever the source-of-truth
  // list (from the parent) changes. The new item will be
  // visible immediately because we keep the local list in
  // sync with the prop, plus any locals we appended during
  // the session.
  useEffect(() => {
    setItems(existingOptions)
  }, [existingOptions])

  // Reset state when the modal closes so a fresh open
  // doesn't carry over the previous session's input.
  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setName('')
        setDescription('')
        setError(null)
        setJustAddedName(null)
        setSubmitting(false)
      }, 150)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (submitting) return
      const cleaned = name.trim()
      if (!cleaned) {
        setError('Name is required')
        return
      }

      setSubmitting(true)
      setError(null)

      try {
        let created: AddOptionItem
        if (endpoint) {
          // Server-side persistence: POST to the API.
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              name: cleaned,
              description: mode === 'name-and-description' ? description_.trim() || null : undefined
            })
          })
          if (!response.ok) {
            const errData = await response.json().catch(() => null)
            throw new Error(errData?.error || `Server returned ${response.status}`)
          }
          const data = await response.json()
          // The endpoint may return the record directly or
          // wrap it in { data: ... }.
          const raw = (data && (data.data || data)) as any
          created = {
            id: raw.id ?? raw.category_id ?? raw.section_id,
            name: raw.name || cleaned,
            description: raw.description ?? null
          }
        } else if (onAdd) {
          // Parent-managed persistence (e.g. local option list).
          const result = await onAdd(
            cleaned,
            mode === 'name-and-description' ? description_.trim() || undefined : undefined
          )
          // `onAdd` may return the new item (with id) or
          // nothing. If nothing, we synthesise an id-less
          // entry so the row still appears in the list.
          created = (result as AddOptionItem) || { name: cleaned }
          if (!created.name) created = { name: cleaned }
        } else {
          throw new Error('AddOptionModal needs either `endpoint` or `onAdd`')
        }

        // 1. Append to the local list so the right column
        //    updates without waiting for a parent re-render.
        setItems((prev) => {
          if (prev.some((p) => p.name.toLowerCase() === created.name.toLowerCase())) {
            return prev
          }
          return [...prev, created]
        })
        setJustAddedName(created.name)

        // 2. Notify the parent so the source of truth stays
        //    in sync (refresh its server-fetched list, etc.)
        onAdded?.(created)

        // 3. Optionally auto-select the new value if the
        //    caller wants its target field to switch to it.
        if (selectNew) onSelect?.(created)

        // 4. Clear the input so the user can add another if
        //    they want. We keep the modal open so they can
        //    add more in one go; the just-added row is
        //    highlighted in the right column.
        setName('')
        setDescription('')

        notify.success('Added', `“${created.name}” was added.`)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to add the new option.'
        setError(message)
      } finally {
        setSubmitting(false)
      }
    },
    [name, description_, submitting, endpoint, onAdd, onAdded, selectNew, onSelect, mode]
  )

  if (!isOpen) return null
  if (typeof document === 'undefined') return null

  // Render via portal at the document body level so the
  // overlay is never clipped or constrained by an ancestor
  // (transform / filter / overflow / perspective can all
  // turn `position: fixed` into a non-viewport-relative
  // box, which leaves a visible gap at the top).
  return createPortal(
    <div
      className="fixed inset-0 z-[1000] w-screen h-screen m-0 p-0 bg-black/50"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-center min-h-screen w-full p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            <i className={`fas ${icon} text-blue-600`}></i>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Close"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {description && (
          <p className="px-5 pt-3 text-sm text-gray-600">{description}</p>
        )}

        {/* 2-column body */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* Left — input form */}
          <form
            onSubmit={handleSubmit}
            className="p-5 border-b md:border-b-0 md:border-r border-gray-200 overflow-y-auto"
          >
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              New {title.replace(/^Add (New )?/i, '')}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (error) setError(null)
                  }}
                  placeholder="Enter a name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={submitting}
                />
              </div>

              {mode === 'name-and-description' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={description_}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short description (optional)"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    disabled={submitting}
                  />
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
                  <i className="fas fa-circle-exclamation mt-0.5"></i>
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 border border-gray-300 rounded-md disabled:opacity-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      Adding…
                    </>
                  ) : (
                    <>
                      <i className="fas fa-plus"></i>
                      Add
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Right — existing options */}
          <div className="p-5 overflow-y-auto bg-gray-50">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Existing {title.replace(/^Add (New )?/i, '')}s
              <span className="ml-1.5 text-gray-400 normal-case font-normal">
                ({items.length})
              </span>
            </h3>

            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-8 text-gray-500">
                <i className="fas fa-inbox text-2xl mb-2 text-gray-300"></i>
                <p className="text-sm">No options yet. Add one on the left.</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {items.map((item) => {
                  const isNew = justAddedName === item.name
                  return (
                    <li
                      key={String(item.id ?? item.name)}
                      className={`flex items-start gap-2 p-2 rounded-md text-sm transition-colors ${
                        isNew
                          ? 'bg-green-50 border border-green-200 ring-1 ring-green-200'
                          : 'bg-white border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div
                        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                          isNew ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        <i
                          className={`fas ${isNew ? 'fa-check' : 'fa-tag'} text-[10px]`}
                        ></i>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 truncate">
                          {item.name}
                        </div>
                        {item.description && (
                          <div className="text-xs text-gray-500 line-clamp-2">
                            {item.description}
                          </div>
                        )}
                        {isNew && (
                          <div className="text-[10px] font-semibold text-green-700 uppercase tracking-wide mt-0.5">
                            Just added
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>,
    document.body
  )
}
