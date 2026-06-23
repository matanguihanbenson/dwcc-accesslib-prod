import { type ClassValue, clsx } from 'clsx'
import { UserRole, UserType, PaginatedResponse, SearchFilters, Campus } from '@/types'
import { PAGINATION, VALIDATION } from './constants'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'PHP',
  }).format(amount)
}

export function formatPenalty(penalty: any): string {
  const penaltyNum = Number(penalty || 0)
  return penaltyNum > 0 ? `₱${penaltyNum.toFixed(2)}` : '-'
}

export function hasPenalty(penalty: any): boolean {
  return penalty != null && Number(penalty) > 0
}

/**
 * Calendar-day difference between two dates. Both sides are
 * normalized to midnight so the time-of-day doesn't bump the
 * result up. Example: start = Jun 21 14:00, end = Jun 22 10:00
 * -> 1 day (not 2, which Math.ceil of the millisecond diff
 * would return because the gap is ~20h ≈ 0.83 days).
 */
export function calculateDaysDifference(start: Date, end: Date): number {
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const b = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

export function calculateHoursDifference(start: Date, end: Date): number {
  const diffTime = Math.abs(end.getTime() - start.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60))
}

export function isOverdue(dueDate: Date): boolean {
  // Compare on calendar days, not on the raw timestamp, so a
  // book due "today" isn't reported as overdue until the next
  // day. We treat the due date as end-of-day so a book due
  // today at any time-of-day is still considered on-time.
  const due = new Date(dueDate)
  const dueEnd = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 59, 999)
  return Date.now() > dueEnd.getTime()
}

export function getDaysOverdue(dueDate: Date): number {
  if (!isOverdue(dueDate)) return 0
  return calculateDaysDifference(dueDate, new Date())
}

export function getHoursOverdue(dueDate: Date): number {
  if (!isOverdue(dueDate)) return 0
  return calculateHoursDifference(dueDate, new Date())
}

export function generateAccountId(userType: UserType, year?: string): string {
  const prefix = userType.charAt(0).toUpperCase()
  const currentYear = year || new Date().getFullYear().toString().slice(-2)
  const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `${prefix}${currentYear}${randomNum}`
}

export function generateRFIDCode(): string {
  return Math.random().toString(36).substring(2, 15).toUpperCase()
}

/**
 * Human-friendly, sortable, unique-looking transaction ID.
 *
 * Format: `BT-YYMM-NNNNNN`
 *   - BT     = Book Transaction prefix (consistent with the
 *             library's BT-* / LIB-* naming scheme)
 *   - YYMM   = two-digit year + month of the transaction
 *   - NNNNNN = six-digit zero-padded numeric id
 *
 * The numeric id is whatever the caller passes in (usually the
 * DB `transaction_id`). Since the underlying id is already
 * unique, the rendered string is unique by construction.
 *
 * Examples:
 *   generateTransactionId(1, new Date('2024-06-21'))  -> 'BT-2406-000001'
 *   generateTransactionId(42)                          -> 'BT-YYMM-000042'
 */
export function generateTransactionId(id: number | string, when?: Date): string {
  const d = when || new Date()
  const yy = d.getFullYear().toString().slice(-2)
  const mm = (d.getMonth() + 1).toString().padStart(2, '0')
  const n = String(id).padStart(6, '0')
  return `BT-${yy}${mm}-${n}`
}

// Email validation moved to validations.ts to avoid conflicts

// Password validation moved to validations.ts to avoid conflicts

// Username validation moved to validations.ts to avoid conflicts

export function sanitizeString(input: string): string {
  return input.trim().replace(/\s+/g, ' ')
}

export function capitalizeWords(str: string): string {
  return str.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  )
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2)
}

export function hasRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole)
}

export function isAdmin(role: UserRole): boolean {
  return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === UserRole.SUPER_ADMIN
}

export function isStaff(role: UserRole): boolean {
  return role === UserRole.STAFF || isAdmin(role)
}

export function createPaginationResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit)
  
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  }
}

export function validatePagination(page?: number, limit?: number) {
  const validatedPage = Math.max(1, page || PAGINATION.DEFAULT_PAGE)
  const validatedLimit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(PAGINATION.MIN_LIMIT, limit || PAGINATION.DEFAULT_LIMIT)
  )
  
  return { page: validatedPage, limit: validatedLimit }
}

export function buildSearchQuery(filters: SearchFilters) {
  const where: any = {}
  
  if (filters.query) {
    where.OR = [
      { full_name: { contains: filters.query } },
      { account_id: { contains: filters.query } },
      { email: { contains: filters.query } },
    ]
  }
  
  if (filters.userType) {
    where.user_type = filters.userType
  }
  
  if (filters.department) {
    where.department = filters.department
  }
  
  if (filters.yearLevel) {
    where.year_level = filters.yearLevel
  }
  
  if (filters.status) {
    where.status = filters.status
  }
  
  if (filters.dateFrom || filters.dateTo) {
    where.created_at = {}
    if (filters.dateFrom) {
      where.created_at.gte = filters.dateFrom
    }
    if (filters.dateTo) {
      where.created_at.lte = filters.dateTo
    }
  }
  
  return where
}

export function buildOrderBy(sortBy?: string, sortOrder?: 'asc' | 'desc') {
  if (!sortBy) return { created_at: 'desc' }
  
  return {
    [sortBy]: sortOrder || 'asc'
  }
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-')
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

export function parseJSON<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString)
  } catch {
    return fallback
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'An unknown error occurred'
}

export function removeEmptyValues<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Partial<T> = {}
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined && value !== '') {
      result[key as keyof T] = value
    }
  }
  
  return result
}

export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>
  
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key]
    }
  }
  
  return result
}

export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj }
  
  for (const key of keys) {
    delete result[key]
  }
  
  return result
}

/**
 * Categorize a user for entrance/exit control statistics
 * Returns one of: ADMIN, FACULTY, EMPLOYEE, GUEST, ALUMNI, BASIC_EDUCATION, COLLEGE_STUDENTS
 */
export function categorizeUserForEntranceExit(user: {
  role?: string
  user_type?: string
  grade_level_id?: number | null
  section_id?: number | null
  department_id?: number | null
  program_id?: number | null
}): 'ADMIN' | 'FACULTY' | 'EMPLOYEE' | 'GUEST' | 'ALUMNI' | 'BASIC_EDUCATION' | 'COLLEGE_STUDENTS' {
  // Check role first for admin and faculty
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
    return 'ADMIN'
  }
  
  if (user.role === 'FACULTY') {
    return 'FACULTY'
  }
  
  // Check user type
  if (user.user_type === 'EMPLOYEE') {
    return 'EMPLOYEE'
  }
  
  if (user.user_type === 'GUEST') {
    return 'GUEST'
  }
  
  if (user.user_type === 'ALUMNI') {
    return 'ALUMNI'
  }
  
  // For students, distinguish between basic education and college
  if (user.user_type === 'STUDENT') {
    // Basic education students have grade_level_id and/or section_id
    // College students have department_id and/or program_id
    if (user.grade_level_id || user.section_id) {
      return 'BASIC_EDUCATION'
    }
    
    // College students have department_id or program_id
    if (user.department_id || user.program_id) {
      return 'COLLEGE_STUDENTS'
    }
    
    // Default to college students if no clear indicator
    return 'COLLEGE_STUDENTS'
  }
  
  // Default to college students for unclassified
  return 'COLLEGE_STUDENTS'
}

/**
 * Date preset types for report filtering
 */
export type DatePreset = 'today' | 'week' | 'month' | 'year' | 'date' | 'custom'

/**
 * Format date range for human-readable report titles
 * Returns format: "Month Day, Year" or "Month Day - Month Day, Year" or "Month Day, Year - Month Day, Year"
 */
export function formatDateRangeForTitle(
  dateFrom: string,
  dateTo: string,
  preset?: DatePreset
): string {
  if (!dateFrom || !dateTo) {
    return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const startDate = new Date(dateFrom)
  const endDate = new Date(dateTo)

  const formatSingleDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  if (dateFrom === dateTo) {
    return formatSingleDate(startDate)
  }

  const sameYear = startDate.getFullYear() === endDate.getFullYear()
  const sameMonth = sameYear && startDate.getMonth() === endDate.getMonth()

  if (preset === 'today') {
    return formatSingleDate(startDate)
  }

  if (preset === 'week') {
    if (sameMonth) {
      return `Week of ${startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}-${endDate.getDate()}, ${startDate.getFullYear()}`
    } else if (sameYear) {
      return `Week of ${startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}, ${startDate.getFullYear()}`
    } else {
      return `Week of ${formatSingleDate(startDate)} - ${formatSingleDate(endDate)}`
    }
  }

  if (preset === 'month') {
    return startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  if (preset === 'year') {
    return `Year ${startDate.getFullYear()}`
  }

  if (sameMonth) {
    return `${startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}-${endDate.getDate()}, ${startDate.getFullYear()}`
  } else if (sameYear) {
    return `${startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}, ${startDate.getFullYear()}`
  } else {
    return `${formatSingleDate(startDate)} - ${formatSingleDate(endDate)}`
  }
}

/**
 * Format date range for filename-safe strings
 */
export function formatDateRangeForFilename(
  dateFrom: string,
  dateTo: string,
  preset?: DatePreset
): string {
  if (!dateFrom || !dateTo) {
    const today = new Date()
    return today.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    }).replace(/,/g, '').replace(/\s+/g, '_')
  }

  const startDate = new Date(dateFrom)
  const endDate = new Date(dateTo)

  const formatSingleDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    }).replace(/,/g, '').replace(/\s+/g, '_')
  }

  if (dateFrom === dateTo) {
    return formatSingleDate(startDate)
  }

  const sameYear = startDate.getFullYear() === endDate.getFullYear()
  const sameMonth = sameYear && startDate.getMonth() === endDate.getMonth()

  if (preset === 'today') {
    return formatSingleDate(startDate)
  }

  if (preset === 'week') {
    if (sameMonth) {
      return `Week_${startDate.toLocaleDateString('en-US', { month: 'short' })}_${startDate.getDate()}-${endDate.getDate()}_${startDate.getFullYear()}`
    } else if (sameYear) {
      return `Week_${startDate.toLocaleDateString('en-US', { month: 'short' })}_${startDate.getDate()}-${endDate.toLocaleDateString('en-US', { month: 'short' })}_${endDate.getDate()}_${startDate.getFullYear()}`
    } else {
      return `Week_${formatSingleDate(startDate)}-${formatSingleDate(endDate)}`.replace(/-/g, '_')
    }
  }

  if (preset === 'month') {
    return startDate.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    }).replace(/\s+/g, '_')
  }

  if (preset === 'year') {
    return `Year_${startDate.getFullYear()}`
  }

  if (sameMonth) {
    return `${startDate.toLocaleDateString('en-US', { month: 'short' })}_${startDate.getDate()}-${endDate.getDate()}_${startDate.getFullYear()}`
  } else if (sameYear) {
    return `${startDate.toLocaleDateString('en-US', { month: 'short' })}_${startDate.getDate()}-${endDate.toLocaleDateString('en-US', { month: 'short' })}_${endDate.getDate()}_${startDate.getFullYear()}`
  } else {
    return `${startDate.toLocaleDateString('en-US', { month: 'short' })}_${startDate.getDate()}_${startDate.getFullYear()}-${endDate.toLocaleDateString('en-US', { month: 'short' })}_${endDate.getDate()}_${endDate.getFullYear()}`
  }
}

/**
 * Map a Campus enum value to the human-readable library label used
 * in report headers (PDF / Excel / CSV) and the page UI.
 *
 *   COLLEGE          -> "College Library"
 *   BASIC_EDUCATION  -> "Basic Education Library"
 *   null / undefined -> "" (caller decides what to show for "all")
 */
export function campusLibraryLabel(
  campus: Campus | null | undefined
): string {
  if (campus === Campus.COLLEGE) return 'College Library'
  if (campus === Campus.BASIC_EDUCATION) return 'Basic Education Library'
  return ''
}
