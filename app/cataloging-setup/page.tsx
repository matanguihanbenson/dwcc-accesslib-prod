'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Swal from 'sweetalert2'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingScreen } from '@/components/ui/loading-spinner'
import { notify } from '@/lib/notification'
import { ShowerHead } from 'lucide-react'

type TabKey =
  | 'section'
  | 'category'
  | 'materialType'
  | 'subtype'
  | 'interestLevel'
  | 'lexile'
  | 'fountasPinnell'

interface TabDef {
  key: TabKey
  label: string
  icon: string
  description: string
}

const TABS: TabDef[] = [
  {
    key: 'section',
    label: 'Manage Section',
    icon: 'fa-layer-group',
    description: ''
  },
  {
    key: 'category',
    label: 'Manage Categories',
    icon: 'fa-tags',
    description: ''
  },
  {
    key: 'materialType',
    label: 'Material Type',
    icon: 'fa-cubes',
    description:
      ''
  },
  {
    key: 'subtype',
    label: 'Subtype',
    icon: 'fa-puzzle-piece',
    description: ''
  },
  {
    key: 'interestLevel',
    label: 'Interest Level',
    icon: 'fa-child',
    description:
      ''
  },
  {
    key: 'lexile',
    label: 'Lexile',
    icon: 'fa-bullseye',
    description: ''
  },
  {
    key: 'fountasPinnell',
    label: 'Fountas & Pinnell',
    icon: 'fa-layer-group',
    description: ''
  }
]

interface SectionRow {
  section_id: number
  name: string
  description?: string | null
  is_active?: boolean
  student_count?: number
}
interface CategoryRow {
  category_id: number
  name: string
  description?: string | null
  is_active?: boolean
  book_count?: number
}

export default function CatalogingSetupPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('section')

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    const role = (session?.user as any)?.role
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
      router.push('/dashboard')
    }
  }, [session, status, router])

  if (status === 'loading') return <LoadingScreen message="Loading…" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cataloging Setup</h1>
          <p className="text-sm text-gray-500">
            Centralised place to manage the values that show up in
            the add-book form's dropdowns.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
        <nav
          aria-label="Cataloging setup sections"
          className="bg-white rounded-lg border border-gray-200 p-2 h-fit lg:sticky lg:top-4"
        >
          <ul className="space-y-1">
            {TABS.map((t) => {
              const isActive = activeTab === t.key
              return (
                <li key={t.key}>
                  <button
                    type="button"
                    onClick={() => setActiveTab(t.key)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full flex items-start gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                      isActive
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <i
                      className={`fas ${t.icon} mt-0.5 w-4 text-center ${
                        isActive ? 'text-white' : 'text-primary-600'
                      }`}
                    />
                    <div className="min-w-0">
                      <div
                        className={`font-medium ${
                          isActive ? 'text-white' : 'text-gray-800'
                        }`}
                      >
                        {t.label}
                      </div>
                      <div
                        className={`text-[11px] mt-0.5 leading-tight ${
                          isActive ? 'text-primary-100' : 'text-gray-500'
                        }`}
                      >
                        {t.description}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <div>
          {TABS.map((t) =>
            t.key === activeTab ? <TabBody key={t.key} tab={t} /> : null
          )}
        </div>
      </div>
    </div>
  )
}

function TabBody({ tab }: { tab: TabDef }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <i className={`fas ${tab.icon} text-primary-600`} />
          {tab.label}
        </CardTitle>
        <p className="text-xs text-gray-500 mt-1">{tab.description}</p>
      </CardHeader>
      <CardContent>
        {tab.key === 'section' ? (
          <SectionManager />
        ) : tab.key === 'category' ? (
          <CategoryManager />
        ) : (
          <SimpleValueManager tabKey={tab.key} />
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Section manager — full CRUD with modal add/edit + activation
// confirmation. Active and inactive rows are both shown;
// inactive rows are sorted to the bottom and dimmed.
// ============================================================================
function SectionManager() {
  const [items, setItems] = useState<SectionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<SectionRow | null>(null)
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sections?limit=500&all=true')
      if (!res.ok) throw new Error('Failed to load sections')
      const data = await res.json()
      const list: SectionRow[] = Array.isArray(data)
        ? data
        : (data?.data || data?.sections || [])
      setItems(list)
    } catch (err) {
      notify.error('Failed to load sections', (err as Error)?.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openAdd = () => {
    setEditing(null)
    setShowForm(true)
  }

  const openEdit = (row: SectionRow) => {
    setEditing(row)
    setShowForm(true)
  }

  const handleToggle = async (row: SectionRow) => {
    const next = row.is_active === false
    const result = await Swal.fire({
      title: next ? 'Activate section?' : 'Deactivate section?',
      text: next
        ? `"${row.name}" will be set to Active. Students can be assigned to it again.`
        : `"${row.name}" will be set to Inactive. Existing students stay assigned but no new students can be added.`,
      icon: next ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonText: next ? 'Activate' : 'Deactivate',
      cancelButtonText: 'Cancel',
      confirmButtonColor: next ? '#10b981' : '#f59e0b',
      reverseButtons: true
    })
    if (!result.isConfirmed) return
    try {
      const res = await fetch(`/api/sections/${row.section_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: next })
      })
      if (!res.ok) throw new Error('Toggle failed')
      setItems((prev) =>
        prev.map((s) =>
          s.section_id === row.section_id ? { ...s, is_active: next } : s
        )
      )
      notify.success(
        next ? 'Section activated' : 'Section deactivated',
        row.name
      )
    } catch (err) {
      notify.error('Toggle failed', (err as Error)?.message)
    }
  }

  // Sort: active rows first, then inactive. Within each
  // group, alphabetical by name.
  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        const aa = a.is_active === false ? 1 : 0
        const bb = b.is_active === false ? 1 : 0
        if (aa !== bb) return aa - bb
        return a.name.localeCompare(b.name)
      }),
    [items]
  )
  const activeCount = items.filter((s) => s.is_active !== false).length
  const inactiveCount = items.length - activeCount

  return (
    <div className="space-y-3">
      <ManagerToolbar
        onAdd={openAdd}
        loading={loading}
        total={items.length}
        activeCount={activeCount}
        label="section"
      />

      {loading ? (
        <ListSkeleton />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon="fa-layer-group"
          message="No sections yet. Click Add section to create one."
        />
      ) : (
        <ul className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-lg overflow-hidden">
          {sorted.map((s) => (
            <SectionListItem
              key={s.section_id}
              section={s}
              onEdit={() => openEdit(s)}
              onToggle={() => handleToggle(s)}
            />
          ))}
        </ul>
      )}

      {inactiveCount > 0 && (
        <p className="text-[11px] text-gray-500 italic">
          {inactiveCount} inactive {inactiveCount === 1 ? 'item is' : 'items are'}{' '}
          shown at the bottom of the list.
        </p>
      )}

      {showForm && (
        <SectionFormModal
          editing={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function SectionListItem({
  section,
  onEdit,
  onToggle
}: {
  section: SectionRow
  onEdit: () => void
  onToggle: () => void
}) {
  const active = section.is_active !== false
  return (
    <li
      className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 ${
        active ? '' : 'opacity-70 bg-gray-50/50'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900">
            {section.name}
          </span>
          <BookCountBadge count={section.student_count} label="students" />
          {!active && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-200 text-gray-700 border border-gray-300">
              <i className="fas fa-eye-slash text-[9px]"></i>
              Inactive
            </span>
          )}
        </div>
        {section.description && (
          <div className="text-xs text-gray-500 mt-0.5 truncate">
            {section.description}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          title="Edit"
        >
          <i className="fas fa-pen text-[10px]"></i>
        </button>
        <button
          type="button"
          onClick={onToggle}
          className={`px-2.5 py-1 text-xs font-medium rounded border ${
            active
              ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
              : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
          }`}
          title={active ? 'Deactivate section' : 'Activate section'}
        >
          <i
            className={`fas ${active ? 'fa-pause' : 'fa-play'} text-[10px] mr-1`}
          />
          {active ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    </li>
  )
}

// ============================================================================
// Category manager — full CRUD with modal add/edit + activation
// confirmation. Active and inactive rows are both shown.
// ============================================================================
function CategoryManager() {
  const [items, setItems] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<CategoryRow | null>(null)
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/book-categories?limit=500')
      if (!res.ok) throw new Error('Failed to load categories')
      const data = await res.json()
      const list: CategoryRow[] = Array.isArray(data)
        ? data
        : (data?.data || data?.categories || [])
      setItems(list)
    } catch (err) {
      notify.error('Failed to load categories', (err as Error)?.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openAdd = () => {
    setEditing(null)
    setShowForm(true)
  }

  const openEdit = (row: CategoryRow) => {
    setEditing(row)
    setShowForm(true)
  }

  const handleToggle = async (row: CategoryRow) => {
    const next = row.is_active === false
    const result = await Swal.fire({
      title: next ? 'Activate category?' : 'Deactivate category?',
      text: next
        ? `"${row.name}" will be set to Active. Books in this category will be visible to readers again.`
        : `"${row.name}" will be set to Inactive. Existing books stay in the category but new books can't be added.`,
      icon: next ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonText: next ? 'Activate' : 'Deactivate',
      cancelButtonText: 'Cancel',
      confirmButtonColor: next ? '#10b981' : '#f59e0b',
      reverseButtons: true
    })
    if (!result.isConfirmed) return
    try {
      const res = await fetch(`/api/book-categories/${row.category_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: next })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || data?.message || 'Toggle failed')
      }
      setItems((prev) =>
        prev.map((c) =>
          c.category_id === row.category_id
            ? { ...c, is_active: next }
            : c
        )
      )
      notify.success(
        next ? 'Category activated' : 'Category deactivated',
        row.name
      )
    } catch (err) {
      const msg = (err as Error)?.message || 'Toggle failed'
      notify.error(
        'Toggle failed',
        msg.includes('is_active')
          ? 'The is_active column is missing on book_category. Run: ALTER TABLE book_category ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;'
          : msg
      )
    }
  }

  // Sort: active first, then alphabetical.
  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        const aa = a.is_active === false ? 1 : 0
        const bb = b.is_active === false ? 1 : 0
        if (aa !== bb) return aa - bb
        return a.name.localeCompare(b.name)
      }),
    [items]
  )
  const activeCount = items.filter((c) => c.is_active !== false).length
  const inactiveCount = items.length - activeCount

  return (
    <div className="space-y-3">
      <ManagerToolbar
        onAdd={openAdd}
        loading={loading}
        total={items.length}
        activeCount={activeCount}
        label="category"
      />

      {loading ? (
        <ListSkeleton />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon="fa-tags"
          message="No categories yet. Click Add category to create one."
        />
      ) : (
        <ul className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-lg overflow-hidden">
          {sorted.map((c) => (
            <CategoryListItem
              key={c.category_id}
              category={c}
              onEdit={() => openEdit(c)}
              onToggle={() => handleToggle(c)}
            />
          ))}
        </ul>
      )}


      {showForm && (
        <CategoryFormModal
          editing={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function CategoryListItem({
  category,
  onEdit,
  onToggle
}: {
  category: CategoryRow
  onEdit: () => void
  onToggle: () => void
}) {
  const active = category.is_active !== false
  return (
    <li
      className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 ${
        active ? '' : 'opacity-70 bg-gray-50/50'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900">
            {category.name}
          </span>
          <BookCountBadge count={category.book_count} label="books" />
          {!active && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-200 text-gray-700 border border-gray-300">
              <i className="fas fa-eye-slash text-[9px]"></i>
              Inactive
            </span>
          )}
        </div>
        {category.description && (
          <div className="text-xs text-gray-500 mt-0.5 truncate">
            {category.description}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          title="Edit"
        >
          <i className="fas fa-pen text-[10px]"></i>
        </button>
        <button
          type="button"
          onClick={onToggle}
          className={`px-2.5 py-1 text-xs font-medium rounded border ${
            active
              ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
              : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
          }`}
          title={active ? 'Deactivate category' : 'Activate category'}
        >
          <i
            className={`fas ${active ? 'fa-pause' : 'fa-play'} text-[10px] mr-1`}
          />
          {active ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    </li>

  )
}

// ============================================================================
// Simple value manager — used for the 5 "live values" tabs.
// The add-new flow lives in the new-book form (AddOptionModal),
// so the "Add" button here jumps there. The list shows every
// distinct value currently in use, both fresh and stale (the
// field is free-text on the books table).
// ============================================================================
function SimpleValueManager({
  tabKey
}: {
  tabKey:
    | 'materialType'
    | 'subtype'
    | 'interestLevel'
    | 'lexile'
    | 'fountasPinnell'
}) {
  const [values, setValues] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const meta: Record<
    typeof tabKey,
    { apiKey: string; label: string; emptyHint: string }
  > = {
    materialType: {
      apiKey: 'materialType',
      label: 'material types',
      emptyHint:
        'No books have a material type set yet. Add a book with a material type and it will appear here.'
    },
    subtype: {
      apiKey: 'subtype',
      label: 'subtypes',
      emptyHint:
        'No books have a subtype set yet. Add a book with a subtype and it will appear here.'
    },
    interestLevel: {
      apiKey: 'interestLevel',
      label: 'interest levels',
      emptyHint:
        'No books have an interest level set yet. Add a book with an interest level and it will appear here.'
    },
    lexile: {
      apiKey: 'lexile',
      label: 'Lexile codes',
      emptyHint:
        'No books have a Lexile code set yet. Add a book with a Lexile and it will appear here.'
    },
    fountasPinnell: {
      apiKey: 'fountasPinnell',
      label: 'F&P levels',
      emptyHint:
        'No books have a Fountas & Pinnell level set yet. Add a book with an F&P code and it will appear here.'
    }
  }

  useEffect(() => {
    const info = meta[tabKey]
    const controller = new AbortController()
    setLoading(true)
    fetch(`/api/public/books?${info.apiKey}=&limit=200`, {
      signal: controller.signal,
      cache: 'no-store'
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: any) => {
        if (!data) {
          setValues([])
          return
        }
        const list: any[] = Array.isArray(data)
          ? data
          : (data?.books || data?.data || [])
        const key = info.apiKey
        const seen = new Set<string>()
        for (const b of list) {
          const v = (b?.[key] || '').toString().trim()
          if (v) seen.add(v)
        }
        setValues(Array.from(seen).sort((a, b) => a.localeCompare(b)))
      })
      .catch(() => setValues([]))
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [tabKey])

  const info = meta[tabKey]

  return (
    <div>
      <ManagerToolbar
        onAdd={() => {
          window.location.href = '/books/add'
        }}
        loading={loading}
        total={values.length}
        activeCount={values.length}
        label={info.label}
      />

      {loading ? (
        <ListSkeleton />
      ) : values.length === 0 ? (
        <EmptyState icon="fa-tag" message={info.emptyHint} />
      ) : (
        <ul className="flex flex-wrap gap-2 bg-white border border-gray-200 rounded-lg p-3">
          {values.map((v) => (
            <li
              key={v}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary-50 text-primary-800 border border-primary-200 text-xs"
            >
              <i className="fas fa-tag text-[10px]"></i>
              <span className="font-medium">{v}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ============================================================================
// Modal — Add / Edit section
// ============================================================================
function SectionFormModal({
  editing,
  onClose,
  onSaved
}: {
  editing: SectionRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(editing?.name || '')
  const [description, setDescription] = useState(
    editing?.description || ''
  )
  const [isActive, setIsActive] = useState(
    editing ? editing.is_active !== false : true
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) {
      setName(editing.name)
      setDescription(editing.description || '')
      setIsActive(editing.is_active !== false)
    }
  }, [editing])

  const handleSave = async () => {
    if (!name.trim()) {
      notify.error('Name required', 'Section name cannot be empty.')
      return
    }
    setSaving(true)
    try {
      const url = editing
        ? `/api/sections/${editing.section_id}`
        : '/api/sections'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          is_active: isActive
        })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Save failed')
      }
      notify.success(
        editing ? 'Section updated' : 'Section added',
        name.trim()
      )
      onSaved()
    } catch (err) {
      notify.error('Save failed', (err as Error)?.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      title={editing ? 'Edit section' : 'Add a new section'}
      icon="fa-layer-group"
      name={name}
      setName={setName}
      description={description}
      setDescription={setDescription}
      isActive={isActive}
      setIsActive={setIsActive}
      saving={saving}
      onClose={onClose}
      onSave={handleSave}
      nameLabel="Section name"
      namePlaceholder="e.g. Circulation"
    />
  )
}
/*
  
*/
// ============================================================================
// Modal — Add / Edit category
// ============================================================================
function CategoryFormModal({
  editing,
  onClose,
  onSaved
}: {
  editing: CategoryRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(editing?.name || '')
  const [description, setDescription] = useState(
    editing?.description || ''
  )
  const [isActive, setIsActive] = useState(
    editing ? editing.is_active !== false : true
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) {
      setName(editing.name)
      setDescription(editing.description || '')
      setIsActive(editing.is_active !== false)
    }
  }, [editing])

  const handleSave = async () => {
    if (!name.trim()) {
      notify.error('Name required', 'Category name cannot be empty.')
      return
    }
    setSaving(true)
    try {
      const url = editing
        ? `/api/book-categories/${editing.category_id}`
        : '/api/book-categories'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          is_active: isActive
        })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Save failed')
      }
      notify.success(
        editing ? 'Category updated' : 'Category added',
        name.trim()
      )
      onSaved()
    } catch (err) {
      notify.error('Save failed', (err as Error)?.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      title={editing ? 'Edit category' : 'Add a new category'}
      icon="fa-tags"
      name={name}
      setName={setName}
      description={description}
      setDescription={setDescription}
      isActive={isActive}
      setIsActive={setIsActive}
      saving={saving}
      onClose={onClose}
      onSave={handleSave}
      nameLabel="Category name"
      namePlaceholder="e.g. Fiction"
    />
  )
}

// ============================================================================
// Reusable form modal — shared by section and category
// editors. Locked behind an admin-only role check.
// ============================================================================
function FormModal({
  title,
  icon,
  name,
  setName,
  description,
  setDescription,
  isActive,
  setIsActive,
  saving,
  onClose,
  onSave,
  nameLabel,
  namePlaceholder
}: {
  title: string
  icon: string
  name: string
  setName: (v: string) => void
  description: string
  setDescription: (v: string) => void
  isActive: boolean
  setIsActive: (v: boolean) => void
  saving: boolean
  onClose: () => void
  onSave: () => void
  nameLabel: string
  namePlaceholder: string
}) {
  return (
    <div
      className="fixed inset-0 z-[1000] w-screen h-screen m-0 p-0 bg-black/50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            <i className={`fas ${icon} text-primary-600`}></i>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Close"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {nameLabel} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              autoFocus
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder={namePlaceholder}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Optional"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="form-checkbox text-primary-600"
            />
            Active
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Shared sub-components
// ============================================================================
function ManagerToolbar({
  onAdd,
  loading,
  total,
  activeCount,
  label
}: {
  onAdd: () => void
  loading: boolean
  total: number
  activeCount: number
  label: string
}) {
  return (
    <div className="flex items-center justify-end flex-wrap gap-2 mb-4">

      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md"
      >
        <i className="fas fa-plus text-xs"></i>
        Add {label.replace(/s$/, '')}
      </button>
    </div>
  )
}

function EmptyState({
  icon,
  message
}: {
  icon: string
  message: string
}) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
      <i className={`fas ${icon} text-3xl text-gray-300 mb-2`}></i>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-12 bg-white border border-gray-200 rounded-lg animate-pulse"
        />
      ))}
    </div>
  )
}

function BookCountBadge({
  count,
  label
}: {
  count?: number
  label: string
}) {
  if (count === undefined || count === null) return null
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary-50 text-primary-700 border border-primary-200">
      <i className="fas fa-book text-[9px]"></i>
      {count} {label}
    </span>
  )
}
