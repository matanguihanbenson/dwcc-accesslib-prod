'use client'

import { useEffect, useState } from 'react'
import {
  DEFAULT_FILTER_OPTIONS,
  ExportFilterOptions,
  SORT_LABELS,
  SortKey,
  USER_TYPE_KEYS,
  PAPER_SIZE_LABELS,
  PAPER_SIZE_KEYS,
  PaperSize,
  USER_TYPE_LABELS,
  USER_TYPE_SHORT_LABELS,
  UserTypeKey,
  downloadExcel,
  downloadPDF,
  ExportColumnProfile
} from '@/lib/library-users-export'
import { notify } from '@/lib/notification'

export type ExportFormat = 'excel' | 'pdf'

export interface ProgramOption {
  /** Stable identifier for the checkbox (program code, or
   *  name if no code). */
  value: string
  label: string
}

interface Props {
  open: boolean
  onClose: () => void
  /** Users to be filtered + exported. The filter modal
   *  doesn't fetch — the parent already has the data. */
  users: any[]
  /** Format the parent has already chosen (shown in the
   *  modal title for clarity). */
  format: ExportFormat
  /** Pre-fill the filter modal with current page state
   *  (e.g. the existing search query / user type filter). */
  initial?: Partial<ExportFilterOptions>
  /** Title + optional subtitle shown in the modal header
   *  and embedded in the PDF for context. */
  title: string
  subtitle?: string
  /** Default filename (without extension). The modal
   *  appends `.xlsx` or `.pdf` automatically. */
  filename: string
  /** Whether to show the status checklist. Hidden on
   *  pages that don't have an `ACTIVE / INACTIVE / …`
   *  status column. */
  showStatus?: boolean
  /** If provided, render a "Programs" section in the modal
   *  that lets the visitor filter to all programs (default)
   *  or a specific subset. Each program must include a
   *  stable `value` used in `selectedPrograms`. */
  programs?: ProgramOption[]
  /** Column profile that controls the Excel / PDF layout.
   *  Different page types pass different profiles so the
   *  exported file shows only the fields relevant to that
   *  page (e.g. programs+departments show "Year" but not
   *  "Section" / "Strand"). */
  columnProfile?: ExportColumnProfile
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SUSPENDED', label: 'Suspended' }
]

const SORT_KEYS: SortKey[] = [
  'last_name_asc',
  'last_name_desc',
  'first_name_asc',
  'first_name_desc',
  'id_asc',
  'id_desc'
]

export default function ExportFilterModal({
  open,
  onClose,
  users,
  format,
  initial,
  title,
  subtitle,
  filename,
  showStatus = true,
  programs,
  columnProfile
}: Props) {
  const [options, setOptions] = useState<ExportFilterOptions>({
    ...DEFAULT_FILTER_OPTIONS,
    ...initial
  })
  const [previewCount, setPreviewCount] = useState(0)

  // Reset filters when the modal opens so the user always
  // starts from a clean state.
  useEffect(() => {
    if (open) {
      setOptions({ ...DEFAULT_FILTER_OPTIONS, ...initial })
    }
  }, [open, initial])

  // Live preview: apply the same filter the export will
  // use, so the count tells the visitor exactly how many
  // rows the file will contain.
  useEffect(() => {
    if (!open) return
    const filtered = users.filter((u: any) => {
      if (
        !options.includeAllTypes &&
        !options.selectedTypes.includes(u.user_type as UserTypeKey)
      ) {
        return false
      }
      if (
        options.selectedStatuses.length > 0 &&
        !options.selectedStatuses.includes(u.status)
      ) {
        return false
      }
      if (
        !options.includeAllPrograms &&
        options.selectedPrograms.length > 0
      ) {
        const code = u.program?.code
        const name = u.program?.name
        const matches =
          (code && options.selectedPrograms.includes(code)) ||
          (name && options.selectedPrograms.includes(name))
        if (!matches) return false
      }
      return true
    })
    setPreviewCount(filtered.length)
  }, [open, users, options])

  if (!open) return null

  const toggleType = (t: UserTypeKey) => {
    setOptions((prev) => {
      const next = prev.selectedTypes.includes(t)
        ? prev.selectedTypes.filter((x) => x !== t)
        : [...prev.selectedTypes, t]
      return { ...prev, selectedTypes: next }
    })
  }

  const toggleStatus = (s: string) => {
    setOptions((prev) => {
      const next = prev.selectedStatuses.includes(s)
        ? prev.selectedStatuses.filter((x) => x !== s)
        : [...prev.selectedStatuses, s]
      return { ...prev, selectedStatuses: next }
    })
  }

  const toggleProgram = (p: string) => {
    setOptions((prev) => {
      const next = prev.selectedPrograms.includes(p)
        ? prev.selectedPrograms.filter((x) => x !== p)
        : [...prev.selectedPrograms, p]
      return { ...prev, selectedPrograms: next }
    })
  }

  const handleExport = () => {
    try {
      const profile = columnProfile || undefined
      if (format === 'excel') {
        downloadExcel(users, `${filename}.xlsx`, options, profile)
      } else {
        downloadPDF(
          users,
          `${filename}.pdf`,
          options,
          { title, subtitle },
          profile
        )
      }
      notify.success(
        'Export complete',
        `${previewCount} record${previewCount === 1 ? '' : 's'} written to ${filename}.${format === 'excel' ? 'xlsx' : 'pdf'}`
      )
      onClose()
    } catch (err) {
      notify.error('Export failed', (err as Error)?.message || 'Unknown error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] w-screen h-screen m-0 p-0 bg-black/50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <i
                className={`fas ${
                  format === 'excel' ? 'fa-file-excel' : 'fa-file-pdf'
                } text-primary-600`}
              ></i>
              Export to {format === 'excel' ? 'Excel' : 'PDF'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-md">
              {title}
              {subtitle && ` · ${subtitle}`}
            </p>
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

        <div className="px-5 py-4 space-y-5 overflow-y-auto">
          {/* Sort */}
          <section>
            <h3 className="text-[11px] font-semibold text-primary-700 uppercase tracking-wider mb-2">
              Sort by
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SORT_KEYS.map((s) => (
                <label
                  key={s}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                    options.sortBy === s
                      ? 'bg-primary-50 border-primary-300 text-primary-800'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="sort"
                    value={s}
                    checked={options.sortBy === s}
                    onChange={() =>
                      setOptions((prev) => ({ ...prev, sortBy: s }))
                    }
                    className="form-radio text-primary-600"
                  />
                  <span className="text-sm">{SORT_LABELS[s]}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Paper size (PDF only — ignored by the Excel
              export) */}
          <section>
            <h3 className="text-[11px] font-semibold text-primary-700 uppercase tracking-wider mb-2">
              Paper size <span className="text-gray-400 normal-case font-normal">(PDF only)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {PAPER_SIZE_KEYS.map((s) => (
                <label
                  key={s}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                    options.paperSize === s
                      ? 'bg-primary-50 border-primary-300 text-primary-800'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="paperSize"
                    value={s}
                    checked={options.paperSize === s}
                    onChange={() =>
                      setOptions((prev) => ({ ...prev, paperSize: s }))
                    }
                    className="form-radio text-primary-600"
                  />
                  <span className="text-sm">{PAPER_SIZE_LABELS[s]}</span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              The PDF is always rendered in landscape so wide
              tables never wrap.
            </p>
          </section>

          {/* User types */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-semibold text-primary-700 uppercase tracking-wider">
                User types
              </h3>
              <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.includeAllTypes}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      includeAllTypes: e.target.checked
                    }))
                  }
                  className="form-checkbox text-primary-600"
                />
                <span>All user types</span>
              </label>
            </div>
            <div
              className={`grid grid-cols-2 sm:grid-cols-4 gap-2 ${
                options.includeAllTypes ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              {USER_TYPE_KEYS.map((t) => {
                const checked = options.selectedTypes.includes(t)
                return (
                  <label
                    key={t}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                      checked
                        ? 'bg-primary-50 border-primary-300 text-primary-800'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleType(t)}
                      className="form-checkbox text-primary-600"
                    />
                    <span className="text-sm">
                      {USER_TYPE_LABELS[t]}
                    </span>
                  </label>
                )
              })}
            </div>
          </section>

          {/* Status (optional) */}
          {showStatus && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] font-semibold text-primary-700 uppercase tracking-wider">
                  Account status
                </h3>
                <span className="text-[11px] text-gray-500">
                  {options.selectedStatuses.length === 0
                    ? 'All statuses'
                    : `${options.selectedStatuses.length} selected`}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <label
                    key={s.value}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                      options.selectedStatuses.includes(s.value)
                        ? 'bg-primary-50 border-primary-300 text-primary-800'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={options.selectedStatuses.includes(s.value)}
                      onChange={() => toggleStatus(s.value)}
                      className="form-checkbox text-primary-600"
                    />
                    <span className="text-sm">{s.label}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-gray-500">
                Leave empty to include every status.
              </p>
            </section>
          )}

          {/* Programs (optional) — only renders when the
              parent passes a list. Used by the department
              details page to scope the export to one or more
              programs under the department. */}
          {programs && programs.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] font-semibold text-primary-700 uppercase tracking-wider">
                  Programs
                </h3>
                <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.includeAllPrograms}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        includeAllPrograms: e.target.checked
                      }))
                    }
                    className="form-checkbox text-primary-600"
                  />
                  <span>All programs</span>
                </label>
              </div>
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto ${
                  options.includeAllPrograms
                    ? 'opacity-50 pointer-events-none'
                    : ''
                }`}
              >
                {programs.map((p) => {
                  const checked = options.selectedPrograms.includes(p.value)
                  return (
                    <label
                      key={p.value}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                        checked
                          ? 'bg-primary-50 border-primary-300 text-primary-800'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleProgram(p.value)}
                        className="form-checkbox text-primary-600"
                      />
                      <span className="text-sm truncate">{p.label}</span>
                    </label>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t bg-gray-50">
          <span className="text-xs text-gray-600">
            <span className="font-semibold text-gray-900">{previewCount}</span>{' '}
            of {users.length} records will be exported.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={previewCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i
                className={`fas ${
                  format === 'excel' ? 'fa-file-excel' : 'fa-file-pdf'
                } text-xs`}
              ></i>
              Export {previewCount} record
              {previewCount === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
