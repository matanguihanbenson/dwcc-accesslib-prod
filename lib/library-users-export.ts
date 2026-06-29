/**
 * Export utilities for library-user reports (both the
 * per-category drill-down page and the categories index).
 *
 * Two formats are supported:
 *   - Excel (.xlsx) via `xlsx`
 *   - PDF   (.pdf)  via `jspdf`
 *
 * Both accept the same `ExportPayload` so the filter modal
 * only has to build the data once. Filtering and sorting
 * are applied at the call site (see `ExportFilterModal`).
 */
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'

export type UserTypeKey = 'STUDENT' | 'EMPLOYEE' | 'ALUMNI' | 'GUEST'

export const USER_TYPE_KEYS: UserTypeKey[] = [
  'STUDENT',
  'EMPLOYEE',
  'ALUMNI',
  'GUEST'
]

/**
 * Paper size for the PDF export. Maps to the corresponding
 * jsPDF `format` string. Landscape orientation is always
 * applied regardless of size so wide tables never wrap.
 */
export type PaperSize = 'short' | 'legal' | 'a4'

export const PAPER_SIZE_KEYS: PaperSize[] = ['short', 'legal', 'a4']

export const PAPER_SIZE_LABELS: Record<PaperSize, string> = {
  short: 'Short (8.5 × 11 in)',
  legal: 'Legal (8.5 × 14 in)',
  a4: 'A4 (210 × 297 mm)'
}

// jsPDF `format` strings. Short → 'letter', Legal → 'legal',
// A4 → 'a4'. All rendered in landscape so the table has
// enough horizontal room.
export const PAPER_SIZE_JS_PDF: Record<PaperSize, string> = {
  short: 'letter',
  legal: 'legal',
  a4: 'a4'
}

export const USER_TYPE_LABELS: Record<UserTypeKey, string> = {
  STUDENT: 'Students',
  EMPLOYEE: 'Employees',
  ALUMNI: 'Alumni',
  GUEST: 'Guests'
}

export const USER_TYPE_SHORT_LABELS: Record<UserTypeKey, string> = {
  STUDENT: 'Student',
  EMPLOYEE: 'Employee',
  ALUMNI: 'Alumni',
  GUEST: 'Guest'
}

export type SortKey = 'last_name_asc' | 'last_name_desc' | 'first_name_asc' | 'first_name_desc' | 'id_asc' | 'id_desc'
export const SORT_LABELS: Record<SortKey, string> = {
  last_name_asc: 'Last name · A → Z',
  last_name_desc: 'Last name · Z → A',
  first_name_asc: 'First name · A → Z',
  first_name_desc: 'First name · Z → A',
  id_asc: 'Account ID · ascending',
  id_desc: 'Account ID · descending'
}

/**
 * Column profile — describes which fields are shown on the
 * PDF / Excel export and in what order. The page passes a
 * pre-built profile to the modal so each page type renders
 * a different spreadsheet without the export utility
 * hard-coding the schema.
 *
 * Use one of the two built-in profiles below, or define a
 * custom one on the page.
 */
export interface ColumnDef {
  /** Header label shown in Excel / PDF. */
  label: string
  /**
   * Resolves the cell value from a UserRow. Returning
   * `null` or `undefined` renders an empty cell. The
   * `idx` is the row's 0-based position in the
   * (already-filtered-and-sorted) export, useful for
   * auto-numbered "No." columns.
   */
  get: (u: UserRow, idx: number) => string | null | undefined
}

export interface ExportColumnProfile {
  id: string
  label: string
  columns: ColumnDef[]
}

/**
 * Build a column profile for the page-type-specific export.
 * The page passes one of these to the modal so the
 * exported spreadsheet/PDF matches the page context.
 *
 *  - 'program'        → /library-users/categories/program/[id]
 *                        (Program column is omitted; the
 *                        department of the program is shown
 *                        in the header subtitle instead)
 *  - 'department'    → /library-users/categories/department/[id]
 *                        (Department column is omitted; the
 *                        viewer already knows the department)
 *  - 'section_grade_strand' → sections / grade levels / strands
 */
export const EXPORT_PROFILES: Record<string, ExportColumnProfile> = {
  /**
   * Program detail — "Program" column is removed because
   * it's redundant. "Year (Grade Level)" combines the
   * student year with the program-grade band so a single
   * column carries both pieces of context.
   */
  program: {
    id: 'program',
    label: 'Program detail',
    columns: [
      { label: 'No.', get: (_u, idx) => String(idx + 1) },
      { label: 'ID Number', get: (u) => u.account_id },
      { label: 'Full Name', get: (u) => u.full_name },
      {
        label: 'Year (Grade Level)',
        get: (u) => {
          const year = (u.year_level || '').trim()
          const grade = u.grade_level
            ? `${u.grade_level.code || ''} ${u.grade_level.name || ''}`.trim()
            : ''
          if (year && grade) return `${year} · ${grade}`
          return year || grade
        }
      },
      {
        label: 'Strand',
        get: (u) =>
          u.strand
            ? `${u.strand.abbreviation || ''} ${u.strand.name || ''}`.trim()
            : ''
      },
      { label: 'Contact Number', get: (u) => u.contact_number || '' }
    ]
  },
  /**
   * Department detail — "Department" column is removed
   * because the visitor already chose the department on the
   * page. "Year (Grade Level)" is included so a single
   * column carries the year + the program-grade band.
   */
  department: {
    id: 'department',
    label: 'Department detail',
    columns: [
      { label: 'No.', get: (_u, idx) => String(idx + 1) },
      { label: 'ID Number', get: (u) => u.account_id },
      { label: 'Full Name', get: (u) => u.full_name },
      {
        label: 'Year (Grade Level)',
        get: (u) => {
          const year = (u.year_level || '').trim()
          const grade = u.grade_level
            ? `${u.grade_level.code || ''} ${u.grade_level.name || ''}`.trim()
            : ''
          if (year && grade) return `${year} · ${grade}`
          return year || grade
        }
      },
      {
        label: 'Program',
        get: (u) => (u.program?.name || '').trim()
      },
      { label: 'Contact Number', get: (u) => u.contact_number || '' }
    ]
  },
  /**
   * Sections, grade levels, strands — no change to the
   * original column set. Kept under the legacy id so the
   * categories index page can keep using it.
   */
  section_grade_strand: {
    id: 'section_grade_strand',
    label: 'Sections · Grade Levels · Strands',
    columns: [
      { label: 'No.', get: (_u, idx) => String(idx + 1) },
      { label: 'ID Number', get: (u) => u.account_id },
      { label: 'Full Name', get: (u) => u.full_name },
      { label: 'Section', get: (u) => u.section?.name || '' },
      {
        label: 'Grade Level',
        get: (u) =>
          u.grade_level
            ? `${u.grade_level.code || ''} ${u.grade_level.name || ''}`.trim()
            : ''
      },
      {
        label: 'Strand',
        get: (u) =>
          u.strand
            ? `${u.strand.abbreviation || ''} ${u.strand.name || ''}`.trim()
            : ''
      },
      { label: 'Contact Number', get: (u) => u.contact_number || '' }
    ]
  }
}

export interface UserRow {
  user_id: number
  account_id: string
  full_name: string
  email: string | null
  contact_number: string | null
  user_type: string
  year_level?: string | null
  status: string
  section?: { name: string } | null
  program?: { name: string; code: string } | null
  department_ref?: { name: string; code: string } | null
  grade_level?: { name: string; code: string } | null
  strand?: { name: string; abbreviation: string } | null
  office_ref?: { name: string; code: string } | null
}

/**
 * Parse a full name into its parts.
 * - last  → the surname (last whitespace-separated token)
 * - first → the given name (first token)
 * - middle → everything in between, or '' if only two tokens
 *
 * Falls back to the raw string for names that don't split
 * cleanly (single-word names, suffixes, etc.) so nothing is
 * ever lost.
 */
export function parseFullName(fullName: string): {
  first: string
  middle: string
  last: string
} {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: '', middle: '', last: '' }
  if (parts.length === 1) {
    return { first: parts[0], middle: '', last: '' }
  }
  if (parts.length === 2) {
    return { first: parts[0], middle: '', last: parts[1] }
  }
  return {
    first: parts[0],
    middle: parts.slice(1, -1).join(' '),
    last: parts[parts.length - 1]
  }
}

/**
 * Format a full name for the spreadsheet / PDF. When
 * `lastNameFirst` is true, output is "Lastname, Firstname
 * Middlename" — used by both the Excel sheet and the PDF
 * when the user picked one of the "last name" sort orders.
 */
export function formatFullName(
  fullName: string,
  lastNameFirst: boolean
): string {
  const { first, middle, last } = parseFullName(fullName)
  if (!lastNameFirst) {
    // Standard "First Middle Last" — preserve the original
    // formatting for edge cases (suffixes, single-word).
    if (middle) return `${first} ${middle} ${last}`.trim()
    if (last) return `${first} ${last}`.trim()
    return first
  }
  if (!last) {
    return middle ? `${first} ${middle}` : first
  }
  if (middle) return `${last}, ${first} ${middle}`
  if (first) return `${last}, ${first}`
  return last
}

export interface ExportFilterOptions {
  /** When true, include ALL user types regardless of the
   *  checklist. */
  includeAllTypes: boolean
  /** Which user-type keys to include when
   *  `includeAllTypes` is false. */
  selectedTypes: UserTypeKey[]
  /** Which statuses to include. Empty = all. */
  selectedStatuses: string[]
  /** Last/first/id sort. */
  sortBy: SortKey
  /** When true, include ALL programs regardless of the
   *  checklist. Only relevant on pages that show programs
   *  (e.g. the department details page). */
  includeAllPrograms: boolean
  /** Which program codes to include when
   *  `includeAllPrograms` is false. */
  selectedPrograms: string[]
  /** PDF page size. Ignored by the Excel export. */
  paperSize: PaperSize
}

export const DEFAULT_FILTER_OPTIONS: ExportFilterOptions = {
  includeAllTypes: true,
  selectedTypes: [...USER_TYPE_KEYS],
  selectedStatuses: [],
  sortBy: 'last_name_asc',
  includeAllPrograms: true,
  selectedPrograms: [],
  paperSize: 'short'
}

export function applyExportFilters(
  users: UserRow[],
  options: ExportFilterOptions
): UserRow[] {
  const filtered = users.filter((u) => {
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
    // Program filter (only enforced when the user picked
    // a specific subset). Compare against the program code
    // first, falling back to the name.
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

  return [...filtered].sort((a, b) => {
    const aLast = a.full_name.split(/\s+/).slice(-1)[0] || ''
    const bLast = b.full_name.split(/\s+/).slice(-1)[0] || ''
    const aFirst = a.full_name.split(/\s+/)[0] || ''
    const bFirst = b.full_name.split(/\s+/)[0] || ''
    switch (options.sortBy) {
      case 'last_name_asc':
        return aLast.localeCompare(bLast) || aFirst.localeCompare(bFirst)
      case 'last_name_desc':
        return bLast.localeCompare(aLast) || bFirst.localeCompare(aFirst)
      case 'first_name_asc':
        return aFirst.localeCompare(bFirst) || aLast.localeCompare(bLast)
      case 'first_name_desc':
        return bFirst.localeCompare(aFirst) || bLast.localeCompare(aLast)
      case 'id_asc':
        return a.account_id.localeCompare(b.account_id)
      case 'id_desc':
        return b.account_id.localeCompare(a.account_id)
      default:
        return 0
    }
  })
}

function buildSpreadsheetRows(
  users: UserRow[],
  lastNameFirst: boolean,
  profile: ExportColumnProfile
) {
  return users.map((u, idx) => {
    const row: Record<string, string> = {}
    for (const col of profile.columns) {
      if (col.label === 'Full Name') {
        // Full Name has special handling so multi-word
        // names render in full and follow the sort order
        // (Last, First Middle when sorting by last name).
        row[col.label] = formatFullName(u.full_name, lastNameFirst)
      } else {
        const value = col.get(u, idx)
        row[col.label] = value === null || value === undefined ? '' : String(value)
      }
    }
    return row
  })
}

export function downloadExcel(
  users: UserRow[],
  filename: string,
  options: ExportFilterOptions,
  profile: ExportColumnProfile = EXPORT_PROFILES.section_grade_strand
) {
  const lastNameFirst =
    options.sortBy === 'last_name_asc' ||
    options.sortBy === 'last_name_desc'
  const rows = buildSpreadsheetRows(
    applyExportFilters(users, options),
    lastNameFirst,
    profile
  )
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Users')
  // Auto-size columns
  const colWidths = Object.keys(rows[0] || {}).map((key) => {
    const maxLen = Math.max(
      key.length,
      ...rows.map((r: any) => String(r[key] || '').length)
    )
    return { wch: Math.min(maxLen + 2, 40) }
  })
  ;(worksheet as any)['!cols'] = colWidths
  XLSX.writeFile(workbook, filename)
}

export function downloadPDF(
  users: UserRow[],
  filename: string,
  options: ExportFilterOptions,
  meta: { title: string; subtitle?: string },
  profile: ExportColumnProfile = EXPORT_PROFILES.section_grade_strand
) {
  const lastNameFirst =
    options.sortBy === 'last_name_asc' ||
    options.sortBy === 'last_name_desc'
  const rows = buildSpreadsheetRows(
    applyExportFilters(users, options),
    lastNameFirst,
    profile
  )
  // PDF is always rendered in landscape so wide tables
  // (especially with the full name column) never wrap.
  // The page size is driven by the modal's paperSize
  // option — short / legal / a4.
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: PAPER_SIZE_JS_PDF[options.paperSize]
  })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 36

  // ===== Centered, simple header =====
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Divine Word College of Calapan', pageWidth / 2, margin, {
    align: 'center'
  })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.text(meta.title, pageWidth / 2, margin + 20, { align: 'center' })
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139) // slate-500
  if (meta.subtitle) {
    doc.text(meta.subtitle, pageWidth / 2, margin + 36, { align: 'center' })
  }
  doc.setTextColor(15, 23, 42) // back to gray-900

  // ===== Table (no header band, no alternating colors) =====
  // Column order and labels come from the page-specific
  // profile. Per-column widths are tuned for readability:
  //   - No.            : very narrow (just a counter)
  //   - ID Number      : narrow (account IDs are short)
  //   - Full Name      : wide (so "Cruz dela, Juan Pedro III"
  //                      never truncates)
  //   - everything else: split the remaining width evenly
  const headers = profile.columns.map((c) => c.label)
  const usableWidth = pageWidth - margin * 2
  const fullNameCol = usableWidth * 0.22
  const narrowCol = usableWidth * 0.05
  const noColWidth = narrowCol * 0.5
  const remainingWidth = usableWidth - fullNameCol - narrowCol - noColWidth
  const remainingCount = headers.length - 3
  const remainingColWidth =
    remainingCount > 0 ? remainingWidth / remainingCount : 0
  const colWidths = headers.map((h) => {
    if (h === 'Full Name') return fullNameCol
    if (h === 'No.') return noColWidth
    if (h === 'ID Number') return narrowCol
    return remainingColWidth
  })
  const rowHeight = 16
  const tableTop = margin + (meta.subtitle ? 56 : 40)

  let y = tableTop
  // Cumulative left-edge of every column, used by the body
  // and border loops.
  const colLefts: number[] = []
  let cursor = margin
  for (const w of colWidths) {
    colLefts.push(cursor)
    cursor += w
  }

  // === Table border (outer + inner grid) =====================
  // The user wants the table to look like a normal HTML
  // table with a `border-collapse` style. We use a
  // single hairline stroke for every horizontal line and a
  // vertical divider between each pair of columns.
  // `setDrawColor(200, 200, 200)` picks a light grey
  // (#c8c8c8) that reads as a subtle border on the white
  // page background. `setLineWidth(0.5)` ≈ 0.5pt, which is
  // the same width browsers use for `border-collapse: collapse`.
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.5)
  const drawHorizontalRule = (yy: number) => {
    doc.line(margin, yy, margin + usableWidth, yy)
  }

  // Header row — plain bold text on a light grey strip
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(241, 245, 249) // slate-100
  doc.rect(margin, y - 12, usableWidth, rowHeight, 'F')
  doc.setTextColor(15, 23, 42)
  // Top border of the table
  drawHorizontalRule(y - 12)
  headers.forEach((h, i) => {
    const text = doc.splitTextToSize(String(h), colWidths[i] - 4)[0] || ''
    doc.text(text, colLefts[i] + 2, y)
  })
  y += rowHeight
  // Border under the header
  drawHorizontalRule(y - 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)

  // Body rows — no alternating colors
  rows.forEach((r: any) => {
    headers.forEach((h, i) => {
      const value = String(r[h] ?? '')
      const colLeft = colLefts[i]
      // The full name is allowed up to two lines so
      // long names like "Cruz dela, Juan Pedro III" are
      // not silently truncated.
      const lines = doc.splitTextToSize(value, colWidths[i] - 4)
      if (h === 'Full Name' && lines.length > 1) {
        doc.text(lines[0], colLeft + 2, y)
        doc.text(lines[1], colLeft + 2, y + 9)
      } else {
        doc.text(lines[0] || '', colLeft + 2, y)
      }
    })
    y += rowHeight
    // Horizontal divider between body rows
    drawHorizontalRule(y - 12)
    if (y > pageHeight - margin) {
      // Re-draw the outer bottom border on the page that's
      // about to be filled, then start a new page with
      // the top border already drawn.
      drawHorizontalRule(margin)
      doc.addPage()
      y = margin
      drawHorizontalRule(y - 12)
    }
  })

  // Vertical column dividers — drawn last so they sit on
  // top of the body fills. We skip the first one (which
  // would be the left edge of the table — the outer border
  // already covers it).
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.5)
  for (let i = 1; i < colWidths.length; i++) {
    const x = colLefts[i]
    doc.line(x, tableTop - 12, x, y - 12)
  }
  // Bottom border of the last page
  drawHorizontalRule(y - 12)

  // ===== Simple footer =====
  // A single centered line at the bottom of the last page.
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text(
    `Generated ${new Date().toLocaleDateString()} · ${rows.length} record${
      rows.length === 1 ? '' : 's'
    }`,
    pageWidth / 2,
    pageHeight - 20,
    { align: 'center' }
  )

  doc.save(filename)
}
