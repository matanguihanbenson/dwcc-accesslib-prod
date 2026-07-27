'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Swal from 'sweetalert2'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingScreen } from '@/components/ui/loading-spinner'
import { notify } from '@/lib/notification'

// One enum-of-tabs. The six "live value" tabs (Classification,
// Material Type, Subtype, Interest Level, Lexile, Fountas &
// Pinnell) all flow through the same `CatalogValueManager` —
// they only differ in the `type` discriminator they send
// to `/api/book-catalog-values`. That endpoint backs a
// `book_catalog_value` table whose rows are the source of
// truth for the corresponding dropdowns on the add-book
// form, so values added on this page show up there
// immediately.
type TabKey =
  | 'section'
  | 'category'
  | 'classification'
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
  // The `/api/book-catalog-values?type=…` discriminator
  // for the "live value" tabs. `undefined` for the two
  // tabs that have their own dedicated tables (section,
  // category).
  catalogType?:
    | 'MATERIAL_TYPE'
    | 'SUBTYPE'
    | 'INTEREST_LEVEL'
    | 'LEXILE'
    | 'FOUNTAS_PINNELL'
  // The classification tab has its own tree view
  // backed by /api/book-classifications (hierarchical
  // DDC-like), so it's a different shape from the live
  // value tabs.
  classification?: boolean
  // Singular noun used in the modal title + "Add …"
  // button (e.g. "Add classification", "Add section").
  singular: string
  // Plural noun used in the empty-state message.
  plural: string
}

const TABS: TabDef[] = [
  {
    key: 'section',
    label: 'Manage Section',
    icon: 'fa-layer-group',
    description: '',
    singular: 'section',
    plural: 'sections'
  },
  {
    key: 'category',
    label: 'Manage Categories',
    icon: 'fa-tags',
    description: '',
    singular: 'category',
    plural: 'categories'
  },
  {
    key: 'classification',
    label: 'Manage Classification',
    icon: 'fa-book',
    description: '',
    // The classification tab now has its own dedicated
    // tree view (ClassificationManager) backed by the new
    // /api/book-classifications endpoint + book_classification
    // table, so it doesn't go through the generic
    // CatalogValueManager anymore. See the
    // ClassificationManager component further down.
    classification: true,
    // `singular` / `plural` aren't used by the
    // classification tab (the new manager does its own
    // labelling), but TabDef still requires the
    // fields so we set placeholders.
    singular: 'classification',
    plural: 'classifications'
  },
  {
    key: 'materialType',
    label: 'Manage Material Type',
    icon: 'fa-cubes',
    description: '',
    catalogType: 'MATERIAL_TYPE',
    singular: 'material type',
    plural: 'material types'
  },
  {
    key: 'subtype',
    label: 'Manage Subtype',
    icon: 'fa-puzzle-piece',
    description: '',
    catalogType: 'SUBTYPE',
    singular: 'subtype',
    plural: 'subtypes'
  },
  {
    key: 'interestLevel',
    label: 'Manage Interest Level',
    icon: 'fa-child',
    description: '',
    catalogType: 'INTEREST_LEVEL',
    singular: 'interest level',
    plural: 'interest levels'
  },
  {
    key: 'lexile',
    label: 'Manage Lexile',
    icon: 'fa-bullseye',
    description: '',
    catalogType: 'LEXILE',
    singular: 'Lexile code',
    plural: 'Lexile codes'
  },
  {
    key: 'fountasPinnell',
    label: 'Manage Fountas & Pinnell',
    icon: 'fa-layer-group',
    description: '',
    catalogType: 'FOUNTAS_PINNELL',
    singular: 'F&P level',
    plural: 'F&P levels'
  }
]

interface SectionRow {
  section_id: number
  name: string
  code?: string | null
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
        ) : tab.key === 'classification' ? (
          // Hierarchical DDC-like tree. The 5 levels
          // (Main Class → Division → Section → Decimal
          // Subdivision → Deeper Subdivision) all live
          // in a single self-referencing table, so the
          // tree view + Add Child flow is the same for
          // every level.
          <ClassificationManager />
        ) : tab.catalogType ? (
          // Six "live value" tabs (Classification, Material
          // Type, Subtype, Interest Level, Lexile, Fountas &
          // Pinnell) all go through the same manager. The
          // values are now stored in the `book_catalog_value`
          // table (one row per catalog value) so this page
          // can offer real CRUD, and the add-book form's
          // dropdowns read from the same table so a value
          // added here shows up immediately.
          <CatalogValueManager
            type={tab.catalogType}
            singular={tab.singular}
            plural={tab.plural}
            icon={tab.icon}
          />
        ) : null}
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
          {section.code && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {section.code}
            </span>
          )}
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
          className=" px-4 py-3 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          title="Edit"
        >
          <i className="fas fa-pen text-[10px]"></i>
        </button>
        <button
          type="button"
          onClick={onToggle}
          className={`px-4 py-3 text-xs font-medium rounded border ${
            active
              ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
              : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
          }`}
          title={active ? 'Deactivate section' : 'Activate section'}
        >
          <i
            className={`fas ${active ? 'fa-pause' : 'fa-play'} text-[10px] mr-1`}
          />
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
          className="px-4 py-3 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          title="Edit"
        >
          <i className="fas fa-pen text-[10px]"></i>
        </button>
        <button
          type="button"
          onClick={onToggle}
          className={`px-4 py-3 text-xs font-medium rounded border ${
            active
              ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
              : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
          }`}
          title={active ? 'Deactivate category' : 'Activate category'}
        >
          <i
            className={`fas ${active ? 'fa-pause' : 'fa-play'} text-[10px]`}
          />
        </button>
      </div>
    </li>

  )
}

// ============================================================================
// Catalog value manager — backs the six "live value" tabs
// (Classification, Material Type, Subtype, Interest Level,
// Lexile, Fountas & Pinnell). Values are now stored in
// the `book_catalog_value` table (one row per catalog
// value) so this page can offer real CRUD, and the
// add-book form's dropdowns read from the same table so
// a value added here shows up there immediately. The
// toolbar / empty-state / row layout reuses the same
// primitives as `SectionManager` and `CategoryManager`
// so the cataloging-setup page looks uniform across
// every tab.
// ============================================================================
interface CatalogValueRow {
  id: number
  type: string
  value: string
  description?: string | null
  is_active: boolean
  book_count?: number
  created_at?: string
  updated_at?: string
}

function CatalogValueManager({
  type,
  singular,
  plural,
  icon
}: {
  type:
    | 'CLASSIFICATION'
    | 'MATERIAL_TYPE'
    | 'SUBTYPE'
    | 'INTEREST_LEVEL'
    | 'LEXILE'
    | 'FOUNTAS_PINNELL'
  singular: string
  plural: string
  icon: string
}) {
  const [items, setItems] = useState<CatalogValueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<CatalogValueRow | null>(null)
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      // `all=true` so the manager shows both active and
      // inactive rows (the inactive ones are dimmed and
      // pushed to the bottom of the list, matching the
      // Section/Category UX).
      const res = await fetch(
        `/api/book-catalog-values?type=${encodeURIComponent(type)}&all=true`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error('Failed to load values')
      const data = await res.json()
      const list: CatalogValueRow[] = Array.isArray(data)
        ? data
        : (data?.data || [])
      setItems(list)
    } catch (err) {
      notify.error(
        `Failed to load ${plural}`,
        (err as Error)?.message
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  const openAdd = () => {
    setEditing(null)
    setShowForm(true)
  }

  const openEdit = (row: CatalogValueRow) => {
    setEditing(row)
    setShowForm(true)
  }

  const handleToggle = async (row: CatalogValueRow) => {
    const next = !row.is_active
    const result = await Swal.fire({
      title: next
        ? `Activate ${singular}?`
        : `Deactivate ${singular}?`,
      text: next
        ? `"${row.value}" will be set to Active and can be picked from the dropdowns again.`
        : `"${row.value}" will be set to Inactive. It stays in the list (dimmed) but won't be selectable.`,
      icon: next ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonText: next ? 'Activate' : 'Deactivate',
      cancelButtonText: 'Cancel',
      confirmButtonColor: next ? '#10b981' : '#f59e0b',
      reverseButtons: true
    })
    if (!result.isConfirmed) return
    try {
      const res = await fetch(`/api/book-catalog-values/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: next })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Toggle failed')
      }
      setItems((prev) =>
        prev.map((v) => (v.id === row.id ? { ...v, is_active: next } : v))
      )
      notify.success(
        next ? 'Activated' : 'Deactivated',
        row.value
      )
    } catch (err) {
      notify.error('Toggle failed', (err as Error)?.message)
    }
  }

  // Sort: active first, then alphabetical. Same UX as
  // SectionManager / CategoryManager so the page is
  // consistent across every tab.
  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        const aa = a.is_active === false ? 1 : 0
        const bb = b.is_active === false ? 1 : 0
        if (aa !== bb) return aa - bb
        return a.value.localeCompare(b.value)
      }),
    [items]
  )
  const activeCount = items.filter((v) => v.is_active !== false).length
  const inactiveCount = items.length - activeCount

  return (
    <div className="space-y-3">
      <ManagerToolbar
        onAdd={openAdd}
        loading={loading}
        total={items.length}
        activeCount={activeCount}
        label={singular}
      />

      {loading ? (
        <ListSkeleton />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={icon}
          message={`No ${plural} yet. Click Add ${singular} to create one.`}
        />
      ) : (
        <ul className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-lg overflow-hidden">
          {sorted.map((v) => (
            <CatalogValueListItem
              key={v.id}
              value={v}
              singular={singular}
              onEdit={() => openEdit(v)}
              onToggle={() => handleToggle(v)}
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
        <CatalogValueFormModal
          type={type}
          singular={singular}
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

function CatalogValueListItem({
  value,
  singular,
  onEdit,
  onToggle
}: {
  value: CatalogValueRow
  singular: string
  onEdit: () => void
  onToggle: () => void
}) {
  const active = value.is_active !== false
  return (
    <li
      className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 ${
        active ? '' : 'opacity-70 bg-gray-50/50'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900">
            {value.value}
          </span>
          {!active && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-200 text-gray-700 border border-gray-300">
              <i className="fas fa-eye-slash text-[9px]"></i>
              Inactive
            </span>
          )}
        </div>
        {value.description && (
          <div className="text-xs text-gray-500 mt-0.5 truncate">
            {value.description}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="px-4 py-3 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          title="Edit"
        >
          <i className="fas fa-pen text-[10px]"></i>
        </button>
        <button
          type="button"
          onClick={onToggle}
          className={`px-4 py-3 text-xs font-medium rounded border ${
            active
              ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
              : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
          }`}
          title={active ? `Deactivate ${singular}` : `Activate ${singular}`}
        >
          <i
            className={`fas ${active ? 'fa-pause' : 'fa-play'} text-[10px]`}
          />
        </button>
      </div>
    </li>
  )
}

// ============================================================================
// Modal — Add / Edit catalog value (the six "live value" tabs)
// ============================================================================
function CatalogValueFormModal({
  type,
  singular,
  editing,
  onClose,
  onSaved
}: {
  type:
    | 'CLASSIFICATION'
    | 'MATERIAL_TYPE'
    | 'SUBTYPE'
    | 'INTEREST_LEVEL'
    | 'LEXILE'
    | 'FOUNTAS_PINNELL'
  singular: string
  editing: CatalogValueRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [value, setValue] = useState(editing?.value || '')
  const [description, setDescription] = useState(
    editing?.description || ''
  )
  const [isActive, setIsActive] = useState(
    editing ? editing.is_active !== false : true
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) {
      setValue(editing.value)
      setDescription(editing.description || '')
      setIsActive(editing.is_active !== false)
    }
  }, [editing])

  const handleSave = async () => {
    if (!value.trim()) {
      notify.error('Value required', `${singular} value cannot be empty.`)
      return
    }
    setSaving(true)
    try {
      const url = editing
        ? `/api/book-catalog-values/${editing.id}`
        : '/api/book-catalog-values'
      const method = editing ? 'PUT' : 'POST'
      const body: any = {
        type,
        value: value.trim(),
        description: description.trim() || null,
        is_active: isActive
      }
      // On edit the type is fixed; sending it on PUT is
      // a no-op but keeps the payload shape uniform.
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Save failed')
      }
      notify.success(
        editing ? 'Value updated' : 'Value added',
        value.trim()
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
      title={editing ? `Edit ${singular}` : `Add a new ${singular}`}
      icon="fa-tag"
      name={value}
      setName={setValue}
      description={description}
      setDescription={setDescription}
      isActive={isActive}
      setIsActive={setIsActive}
      saving={saving}
      onClose={onClose}
      onSave={handleSave}
      nameLabel={`${singular.charAt(0).toUpperCase()}${singular.slice(1)} value`}
      namePlaceholder={
        singular === 'F&P level' ? 'e.g. M' : `e.g. ${singular}`
      }
    />
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
  const [code, setCode] = useState(editing?.code || '')
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
      setCode(editing.code || '')
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
          code: code.trim() || null,
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
    >
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Section Code
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={20}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="e.g. CIR"
        />
        <p className="mt-1 text-[11px] text-gray-500">
          Short code used in call numbers (e.g. CIR, GS).
        </p>
      </div>
    </FormModal>
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
  namePlaceholder,
  children
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
  // Optional content slot — some callers (the
  // ClassificationFormModal) need to render their own
  // fields between the name and the description.
  children?: React.ReactNode
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
          {/* Optional caller-supplied fields (e.g. the
              Classification form renders an extra code +
              level slot here). */}
          {children}
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
        Add {label}
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

// ============================================================================
// Hierarchical DDC-like classification manager
// ============================================================================
// One self-referencing `book_classification` table holds
// all five levels (Main Class / Division / Section /
// Decimal Subdivision / Deeper Subdivision). The tree
// is rendered as a flat indented list of every node in
// pre-order traversal, with an "Add Child" button on
// every row that creates the next-deepest level. "View
// Books" on any row hits the recursive-CTE API that
// returns every book in the row's subtree.

// Mirrors the Prisma enum so the form can read the
// typed values without importing the @prisma/client.
type ClassificationLevel =
  | 'MAIN_CLASS'
  | 'DIVISION'
  | 'SECTION'
  | 'DECIMAL_SUBDIVISION'
  | 'DEEPER_SUBDIVISION'

interface ClassificationRow {
  id: number
  parent_id: number | null
  code: string
  name: string
  description: string | null
  level: ClassificationLevel
  is_active: boolean
  created_at: string
  updated_at: string
  // Optional aggregation for the tree view. The list
  // endpoint doesn't include these by default; the
  // detail endpoint does.
  _count?: { children: number; books: number }
}

const LEVEL_LABEL: Record<ClassificationLevel, string> = {
  MAIN_CLASS: 'Main Class',
  DIVISION: 'Division',
  SECTION: 'Section',
  DECIMAL_SUBDIVISION: 'Decimal Subdivision',
  DEEPER_SUBDIVISION: 'Deeper Subdivision'
}

// A node's "Add Child" creates the next-deepest level
// except at DEEPER_SUBDIVISION, which has no further
// level and so creates another DEEPER_SUBDIVISION
// (matching DDC's arbitrary depth).
const CHILD_LEVEL: Record<ClassificationLevel, ClassificationLevel> = {
  MAIN_CLASS: 'DIVISION',
  DIVISION: 'SECTION',
  SECTION: 'DECIMAL_SUBDIVISION',
  DECIMAL_SUBDIVISION: 'DEEPER_SUBDIVISION',
  DEEPER_SUBDIVISION: 'DEEPER_SUBDIVISION'
}

const LEVEL_BADGE_CLASS: Record<ClassificationLevel, string> = {
  MAIN_CLASS: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  DIVISION: 'bg-blue-100 text-blue-800 border-blue-200',
  SECTION: 'bg-sky-100 text-sky-800 border-sky-200',
  DECIMAL_SUBDIVISION: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  DEEPER_SUBDIVISION: 'bg-amber-100 text-amber-800 border-amber-200'
}

function ClassificationManager() {
  const [roots, setRoots] = useState<ClassificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ClassificationRow | null>(null)
  const [parentForNew, setParentForNew] = useState<ClassificationRow | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [viewingBooksFor, setViewingBooksFor] = useState<ClassificationRow | null>(null)
  const [books, setBooks] = useState<any[]>([])
  const [booksTotal, setBooksTotal] = useState(0)
  const [booksLoading, setBooksLoading] = useState(false)

  const loadRoots = async () => {
    setLoading(true)
    try {
      const res = await fetch(
        '/api/book-classifications?roots=1&all=1',
        { credentials: 'include', cache: 'no-store' }
      )
      if (!res.ok) throw new Error('Failed to load classifications')
      const data = await res.json()
      const list: ClassificationRow[] = Array.isArray(data)
        ? data
        : (data?.data || [])
      setRoots(list)
    } catch (err) {
      notify.error('Failed to load classifications', (err as Error)?.message)
    } finally {
      setLoading(false)
    }
  }

  // Recursive pre-order fetch for the visible subtree
  // of a single node (used to expand children when the
  // user clicks the chevron).
  const loadDescendants = async (
    rootId: number
  ): Promise<ClassificationRow[]> => {
    try {
      const res = await fetch(
        `/api/book-classifications/${rootId}/books`,
        { credentials: 'include', cache: 'no-store' }
      )
      void res
      // The /books endpoint is for the book list. For
      // the descendant tree itself, walk children
      // manually. Because the GET ?parent_id=… endpoint
      // already exists at /api/book-classifications, this
      // helper just shells out to it for each level.
      void rootId
    } catch {
      /* noop */
    }
    return []
  }

  useEffect(() => {
    loadRoots()
  }, [])

  // Walk the children of a single node (one level deep).
  const fetchChildren = async (parentId: number): Promise<ClassificationRow[]> => {
    try {
      const res = await fetch(
        `/api/book-classifications?parent_id=${parentId}&all=1`,
        { credentials: 'include', cache: 'no-store' }
      )
      if (!res.ok) return []
      const data = await res.json()
      const list: ClassificationRow[] = Array.isArray(data)
        ? data
        : (data?.data || [])
      return list
    } catch {
      return []
    }
  }

  const toggleExpand = async (row: ClassificationRow) => {
    const id = row.id
    if (expanded.has(id)) {
      setExpanded((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      return
    }
    // Lazy-load the immediate children the first time
    // the node is expanded. The endpoint returns them
    // already sorted by code, so we can drop them
    // straight into the expanded map.
    const children = await fetchChildren(id)
    setExpanded((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    // Stash the fetched children on a side-map keyed by
    // id so the row can render them below the parent.
    setChildrenByParent((prev) => ({ ...prev, [id]: children }))
  }

  // Per-parent list of immediate children. Lives outside
  // `expanded` so a parent can stay collapsed but we can
  // still load the children on demand without keeping
  // the row itself expanded.
  const [childrenByParent, setChildrenByParent] = useState<Record<number, ClassificationRow[]>>({})

  const openAddRoot = () => {
    setParentForNew(null)
    setEditing(null)
    setFormOpen(true)
  }

  const openAddChild = (parent: ClassificationRow) => {
    setParentForNew(parent)
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (row: ClassificationRow) => {
    setEditing(row)
    setParentForNew(null)
    setFormOpen(true)
  }

  const handleToggle = async (row: ClassificationRow) => {
    const next = !row.is_active
    const result = await Swal.fire({
      title: next ? `Activate ${row.code}?` : `Deactivate ${row.code}?`,
      text: next
        ? `"${row.name}" will be re-enabled. Books can once again be assigned to this classification.`
        : `"${row.name}" will be deactivated. It stays in the tree (dimmed) but books can no longer be assigned to it until it's re-activated.`,
      icon: next ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonText: next ? 'Activate' : 'Deactivate',
      cancelButtonText: 'Cancel',
      confirmButtonColor: next ? '#10b981' : '#f59e0b',
      reverseButtons: true
    })
    if (!result.isConfirmed) return
    try {
      const res = await fetch(`/api/book-classifications/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: next })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Toggle failed')
      }
      // Refresh the visible list. If the row is in
      // the visible tree (root, or a child of an
      // expanded parent) update in place; otherwise just
      // reload roots.
      if (expanded.has(row.id) || row.parent_id === null) {
        setRoots((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, is_active: next } : r))
        )
      }
      if (row.parent_id !== null) {
        // `row.parent_id !== null` is the gate above, but
        // TS doesn't narrow the union inside the
        // callback. Use a local so the indexer and the
        // computed property name both see `number`.
        const parentId: number = row.parent_id
        setChildrenByParent((prev) => {
          const arr = prev[parentId] || []
          return {
            ...prev,
            [parentId]: arr.map((c: ClassificationRow) =>
              c.id === row.id ? { ...c, is_active: next } : c
            )
          }
        })
      }
      notify.success(next ? 'Activated' : 'Deactivated', row.code)
    } catch (err) {
      notify.error('Toggle failed', (err as Error)?.message)
    }
  }

  const handleViewBooks = async (row: ClassificationRow) => {
    setViewingBooksFor(row)
    setBooksLoading(true)
    try {
      const res = await fetch(
        `/api/book-classifications/${row.id}/books?limit=500`,
        { credentials: 'include', cache: 'no-store' }
      )
      if (!res.ok) throw new Error('Failed to load books')
      const data = await res.json()
      const payload = data?.data ?? data
      setBooks(payload?.books ?? [])
      setBooksTotal(payload?.total ?? 0)
    } catch (err) {
      notify.error('Failed to load books', (err as Error)?.message)
    } finally {
      setBooksLoading(false)
    }
  }

  // Render a single row + (optionally) its immediate
  // children. Recursion is one level deep per render
  // because the user has to click "expand" to see
  // grandchildren, so the deepest visible tree is
  // 5 × N nodes wide at most.
  const renderRow = (row: ClassificationRow, depth: number) => {
    const isExpanded = expanded.has(row.id)
    const children = childrenByParent[row.id] || []
    return (
      <li key={row.id}>
        <div
          className={`flex items-start gap-3 px-3 py-2 hover:bg-gray-50 ${
            row.is_active ? '' : 'opacity-70 bg-gray-50/50'
          }`}
          style={{ paddingLeft: 12 + depth * 24 }}
        >
          <button
            type="button"
            onClick={() => toggleExpand(row)}
            className="mt-0.5 w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:bg-gray-200"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <i
              className={`fas fa-chevron-right text-[10px] transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`}
            />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-gray-500">
                {row.code}
              </span>
              <span className="text-sm font-medium text-gray-900">
                {row.name}
              </span>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${LEVEL_BADGE_CLASS[row.level]}`}
              >
                {LEVEL_LABEL[row.level]}
              </span>
              {!row.is_active && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-200 text-gray-700 border border-gray-300">
                  <i className="fas fa-eye-slash text-[9px]"></i>
                  Inactive
                </span>
              )}
              {row._count?.books !== undefined && (
                <BookCountBadge count={row._count.books} label="books" />
              )}
            </div>
            {row.description && (
              <div className="text-xs text-gray-500 mt-0.5 truncate">
                {row.description}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => openAddChild(row)}
              className="px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
              title={`Add a child ${LEVEL_LABEL[CHILD_LEVEL[row.level]]}`}
            >
              <i className="fas fa-plus text-[10px] mr-1"></i>
              Add {LEVEL_LABEL[CHILD_LEVEL[row.level]]}
            </button>
            <button
              type="button"
              onClick={() => handleViewBooks(row)}
              className="px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
              title="View books under this classification"
            >
              <i className="fas fa-book text-[10px] mr-1"></i>
              View Books
            </button>
            <button
              type="button"
              onClick={() => openEdit(row)}
              className="px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
              title="Edit"
            >
              <i className="fas fa-pen text-[10px]"></i>
            </button>
            <button
              type="button"
              onClick={() => handleToggle(row)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded border ${
                row.is_active
                  ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                  : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
              }`}
              title={row.is_active ? 'Deactivate' : 'Activate'}
            >
              <i
                className={`fas ${row.is_active ? 'fa-pause' : 'fa-play'} text-[10px]`}
              />
            </button>
          </div>
        </div>
        {isExpanded && children.length > 0 && (
          <ul className="border-l border-gray-200 ml-5">
            {children.map((c) => renderRow(c, depth + 1))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <div className="space-y-3">
      <ManagerToolbar
        onAdd={openAddRoot}
        loading={loading}
        total={roots.length}
        activeCount={roots.filter((r) => r.is_active).length}
        label="Main Class"
      />

      {loading ? (
        <ListSkeleton />
      ) : roots.length === 0 ? (
        <EmptyState
          icon="fa-book"
          message={
            'No classifications configured yet. Click Add Main Class to create the first node in the DDC tree (e.g. "000" General Works).'
          }
        />
      ) : (
        <ul className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-lg overflow-hidden">
          {roots.map((r) => renderRow(r, 0))}
        </ul>
      )}

      {formOpen && (
        <ClassificationFormModal
          parent={parentForNew}
          editing={editing}
          onClose={() => setFormOpen(false)}
          onSaved={async () => {
            setFormOpen(false)
            // If the user just edited a row that's in the
            // visible tree, refresh its branch; otherwise
            // just re-load roots.
            loadRoots()
            if (parentForNew) {
              // Re-fetch that parent's children.
              const c = await fetchChildren(parentForNew.id)
              setChildrenByParent((prev) => ({
                ...prev,
                [parentForNew.id]: c
              }))
            }
          }}
        />
      )}

      {viewingBooksFor && (
        <BooksUnderClassificationModal
          classification={viewingBooksFor}
          books={books}
          total={booksTotal}
          loading={booksLoading}
          onClose={() => {
            setViewingBooksFor(null)
            setBooks([])
            setBooksTotal(0)
          }}
        />
      )}
    </div>
  )
}

// Modal for creating / editing a classification node.
// Auto-fills the right `level` based on the parent:
//   - parent is null       → MAIN_CLASS
//   - parent.level = X      → CHILD_LEVEL[X] (the level
//                              below the parent in the
//                              hierarchy)
function ClassificationFormModal({
  parent,
  editing,
  onClose,
  onSaved
}: {
  parent: ClassificationRow | null
  editing: ClassificationRow | null
  onClose: () => void
  onSaved: () => void
}) {
  // When editing, the level is fixed (we don't allow
  // moving a node to a different level). When creating,
  // the level is derived from the parent.
  const initialLevel: ClassificationLevel = editing
    ? editing.level
    : parent
    ? CHILD_LEVEL[parent.level]
    : 'MAIN_CLASS'
  const isRoot = !parent && !editing

  const [code, setCode] = useState(editing?.code || '')
  const [name, setName] = useState(editing?.name || '')
  const [description, setDescription] = useState(editing?.description || '')
  const [level, setLevel] = useState<ClassificationLevel>(initialLevel)
  const [isActive, setIsActive] = useState(
    editing ? editing.is_active !== false : true
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) {
      setCode(editing.code)
      setName(editing.name)
      setDescription(editing.description || '')
      setLevel(editing.level)
      setIsActive(editing.is_active !== false)
    } else {
      setCode('')
      setName('')
      setDescription('')
      setLevel(parent ? CHILD_LEVEL[parent.level] : 'MAIN_CLASS')
      setIsActive(true)
    }
  }, [editing, parent])

  const handleSave = async () => {
    if (!code.trim()) {
      notify.error('Code required', 'Classification code cannot be empty.')
      return
    }
    if (!name.trim()) {
      notify.error('Name required', 'Classification name cannot be empty.')
      return
    }
    setSaving(true)
    try {
      const url = editing
        ? `/api/book-classifications/${editing.id}`
        : '/api/book-classifications'
      const method = editing ? 'PUT' : 'POST'
      const body: any = {
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || null,
        level,
        is_active: isActive
      }
      if (!editing) {
        // parent_id is null for root nodes (Main
        // Class) and set to the parent's id otherwise.
        body.parent_id = parent ? parent.id : null
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Save failed')
      }
      notify.success(
        editing ? 'Classification updated' : 'Classification added',
        code.trim()
      )
      onSaved()
    } catch (err) {
      notify.error('Save failed', (err as Error)?.message)
    } finally {
      setSaving(false)
    }
  }

  const title = editing
    ? `Edit ${editing.code} ${editing.name}`
    : parent
    ? `Add a new ${LEVEL_LABEL[CHILD_LEVEL[parent.level]]} under ${parent.code}`
    : 'Add a new Main Class (top-level)'

  return (
    <FormModal
      title={title}
      icon="fa-book"
      name={name}
      setName={setName}
      description={description}
      setDescription={setDescription}
      isActive={isActive}
      setIsActive={setIsActive}
      saving={saving}
      onClose={onClose}
      onSave={handleSave}
      nameLabel="Name"
      namePlaceholder={'Enter name'}
    >
      {/* `code` is the only field that doesn't fit the
          generic FormModal (it has a different label),
          so we render it as an extra slot above the
          name field. */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Code <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={20}
          autoFocus
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder={'Enter code'}
        />
 
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Level
        </label>
        <div
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-gray-50 text-gray-700"
        >
          {LEVEL_LABEL[level]}
          {parent && (
            <span className="ml-2 text-[10px] text-gray-500">
              (parent: {parent.code} {parent.name})
            </span>
          )}
        </div>
      </div>
    </FormModal>
  )
}

// "View Books" modal — shows every book whose
// classification is the node OR any descendant. The
// recursive-CTE query on the server already returns the
// union, so we just render the flat list here.
function BooksUnderClassificationModal({
  classification,
  books,
  total,
  loading,
  onClose
}: {
  classification: ClassificationRow
  books: any[]
  total: number
  loading: boolean
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[1000] w-screen h-screen m-0 p-0 bg-black/50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            <i className="fas fa-book text-primary-600"></i>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Books under {classification.code} {classification.name}
              </h2>
              <p className="text-xs text-gray-500">
                Subtree total: <strong>{total}</strong> book
                {total === 1 ? '' : 's'} (every book whose
                classification is this node or any
                descendant)
              </p>
            </div>
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
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-gray-500">Loading books…</p>
          ) : books.length === 0 ? (
            <p className="text-sm text-gray-500">
              No books assigned to this classification or
              any of its descendants.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
              {books.map((b: any) => (
                <li
                  key={b.book_id}
                  className="px-3 py-2 text-sm flex items-start gap-3 hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {b.title}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {b.isbn || b.publisher || '—'}
                    </div>
                  </div>
                  {b.classification && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary-50 text-primary-700 border border-primary-200 shrink-0">
                      <i className="fas fa-bookmark text-[9px]"></i>
                      {b.classification.code} · {LEVEL_LABEL[b.classification.level as ClassificationLevel]}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
