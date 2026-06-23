import { 
  UserRole, 
  UserType, 
  UserStatus, 
  BookStatus,
  Campus,
  LockerStatus,
  ReportModule,
  PenaltyType,
  ConfigDataType,
  OverdueTransactionType,
  OverdueSettlementStatus,
  EducationLevel,
  ExportJobStatus
} from '@prisma/client'

// Temporary enums until Prisma client includes them after migration
export enum MaterialType {
  BOOK = 'BOOK',
  EBOOK = 'EBOOK',
  AUDIOBOOK = 'AUDIOBOOK',
  DVD = 'DVD',
  CD = 'CD',
  PERIODICAL = 'PERIODICAL',
  MAGAZINE = 'MAGAZINE',
  JOURNAL = 'JOURNAL',
  REFERENCE = 'REFERENCE',
  THESIS = 'THESIS',
  OTHER = 'OTHER'
}

export enum BookCondition {
  EXCELLENT = 'EXCELLENT',
  GOOD = 'GOOD',
  FAIR = 'FAIR',
  POOR = 'POOR',
  DAMAGED = 'DAMAGED',
  MISSING = 'MISSING'
}

export enum TransactionStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

export enum NotificationType {
  LOCKER_OVERDUE = 'LOCKER_OVERDUE',
  BOOK_OVERDUE = 'BOOK_OVERDUE',
  LOCKER_ASSIGNED = 'LOCKER_ASSIGNED',
  BOOK_APPROVED = 'BOOK_APPROVED',
  BOOK_REJECTED = 'BOOK_REJECTED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  ACCOUNT_UPDATE = 'ACCOUNT_UPDATE'
}

export enum NotificationStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  FAILED = 'FAILED',
  READ = 'READ'
}

export interface AuthUser {
  id: string
  username: string
  role: UserRole
  userType: UserType
  accountId: string
  name: string
  email?: string
  /** Current campus designation for STAFF accounts. NULL for
   *  ADMIN / SUPER_ADMIN and for non-staff roles. */
  campus?: Campus | null
}

export interface AuthSession {
  user: AuthUser
  expires: string
}

export interface JWTPayload {
  userId: number
  username: string
  role: UserRole
  userType: UserType
  accountId: string
  iat?: number
  exp?: number
}

export interface ApiResponse<T = any> {
  data?: T
  message?: string
  error?: string
  success: boolean
  code?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface LibraryUser {
  user_id: number
  account_id: string
  first_name: string
  last_name: string
  // Optional string/number fields use `string | null` (or
  // `number | null`) to match the underlying Prisma schema
  // where the column is `String?` / `Int?`. Prisma returns
  // `null` for missing values, not `undefined`, so the type
  // has to allow `null` or strict callers (like
  // EntryService.recordEntry which returns EntryLog with an
  // included user) fail to compile.
  middle_name?: string | null
  suffix?: string | null
  full_name?: string | null
  user_type: UserType
  education_level?: EducationLevel
  grade_level_id?: number | null
  section_id?: number | null
  strand_id?: number | null
  // Compact codes for the table view. The full
  // department_ref / program relations are still
  // available on the user object if a page needs the
  // long name.
  course?: string | null
  department?: string | null
  office_id?: number | null
  year_level?: string | null
  email?: string | null
  rfid_code?: string | null
  purpose?: string | null
  contact_number?: string | null
  status: UserStatus
  created_at: Date
  updated_at: Date
  archived_at?: Date | null
}

export interface UserAccount {
  id: number
  username: string
  role: UserRole
  last_login?: Date
  login_attempts: number
  locked_until?: Date
  user_id: number
  created_at: Date
  updated_at?: Date
  is_active: boolean
  user?: LibraryUser
}

export interface BookCategory {
  category_id: number
  name: string
  description?: string
  created_at: Date
}

export interface BookAuthor {
  id: number
  book_id: number
  name: string
  dates?: string
  display_order: number
  created_at: Date
}

export interface BookContributor {
  id: number
  book_id: number
  name: string
  role: string
  dates?: string
  display_order: number
  created_at: Date
}

export interface AlternateTitle {
  id: number
  book_id: number
  title: string
  type: string
  created_at: Date
}

export interface BookLink {
  id: number
  book_id: number
  url: string
  description?: string
  created_at: Date
}

export interface DigitalContent {
  id: number
  book_id: number
  title: string
  file_path?: string
  file_type?: string
  file_size?: number
  url?: string
  description?: string
  created_at: Date
}

export interface Book {
  book_id: number
  
  // Title Information
  title: string
  subtitle?: string
  uniform_title?: string
  varying_form?: string
  
  // Standard Numbers
  isbn?: string
  issn?: string
  lccn?: string
  
  // Material Type
  material_type: MaterialType
  subtype?: string
  
  // Series Information
  series_title?: string
  volume_number?: string
  
  // Reading Level Information
  interest_level?: string
  lexile_code?: string
  fountas_pinnell?: string
  
  // Publication Information
  publisher?: string
  publication_place?: string
  publication_date?: string
  year_published?: number
  edition?: string
  
  // Physical Description
  pages?: number
  extent?: string
  size?: string
  other_details?: string
  
  // Content Information
  description?: string
  summary?: string
  notes?: string
  language?: string
  
  // Library Management
  category_id: number
  section_id?: number
  location?: string
  copies_total: number
  copies_available: number
  copies_borrowed?: number
  status: BookStatus
  
  // Metadata
  created_at: Date
  updated_at: Date
  archived_at?: Date
  created_by?: number
  updated_by?: number
  
  // Legacy field (kept for backward compatibility)
  book_author?: string
  
  // Relations
  category?: BookCategory
  section?: BookSection
  authors?: BookAuthor[]
  contributors?: BookContributor[]
  alternate_titles?: AlternateTitle[]
  links?: BookLink[]
  digital_content?: DigitalContent[]
  book_copies?: BookCopy[]
  book_transactions?: BookTransaction[]
}

export interface BookCopy {
  copy_id: number
  book_id: number
  copy_number: string
  barcode?: string
  condition: BookCondition
  status: BookStatus
  location?: string
  acquisition_date?: Date
  acquisition_cost?: number
  notes?: string
  created_at: Date
  updated_at: Date
  archived_at?: Date
  book?: Book
  book_transactions?: BookTransaction[]
}

export interface BookSection {
  section_id: number
  name: string
  description?: string
  is_active: boolean
  created_at: Date
}

export interface BookTransaction {
  transaction_id: number
  borrow_date?: Date
  return_date?: Date
  due_date?: Date
  penalty: number
  status: TransactionStatus
  book_id: number
  user_id: number
  requested_by?: number
  approved_by?: number
  returned_by?: number
  notes?: string
  condition_on_borrow?: BookCondition
  condition_on_return?: BookCondition
  created_at: Date
  updated_at: Date
  book?: Book
  user?: LibraryUser
}

export interface Locker {
  locker_id: number
  locker_number: string
  location: string
  status: LockerStatus
  created_at: Date
  updated_at: Date
  archived_at?: Date
}

export interface LockerTransaction {
  transaction_id: number
  borrow_time: Date
  return_time?: Date
  due_time: Date
  penalty: number
  status: TransactionStatus
  user_id: number
  locker_id: number
  assigned_by?: number
  returned_by?: number
  notes?: string
  created_at: Date
  updated_at: Date
  locker?: Locker
  user?: LibraryUser
}

export interface EntryLog {
  entry_id: number
  entry_time: Date
  exit_time: Date  | null
  user_id: number
  rfid_code: string | null
  purpose: string | null
  verified_by: number | null
  campus: Campus
  user?: LibraryUser
}

export interface AuditLog {
  event_id: number
  action: string
  description: string
  ip_address?: string
  user_agent?: string
  date_time_log: Date
  user_id: number
  role: UserRole
  user?: LibraryUser
}

export interface NotificationLog {
  notification_id: number
  user_id: number
  type: NotificationType
  title: string
  message: string
  status: NotificationStatus
  sent_at?: Date
  read_at?: Date
  metadata?: any
  created_at: Date
  user?: LibraryUser
}

export interface ReportLog {
  report_id: number
  module: ReportModule
  title: string
  parameters?: any
  file_path?: string
  date_generated: Date
  generated_by: number
  download_count: number
  user?: LibraryUser
}

export interface PenaltyConfig {
  config_id: number
  type: PenaltyType
  penalty_per_day: number
  penalty_per_hour?: number
  grace_period_days: number
  grace_period_hours?: number
  max_penalty?: number
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export interface SystemConfig {
  config_id: number
  key: string
  value: string
  description?: string
  data_type: ConfigDataType
  is_encrypted: boolean
  created_at: Date
  updated_at: Date
}

export interface Holiday {
  holiday_id: number
  name: string
  date: Date
  end_date?: Date | null
  description?: string
  is_recurring: boolean
  start_time?: string
  end_time?: string
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export interface CreateHolidayData {
  name: string
  date: Date | string
  end_date?: Date | string
  description?: string
  is_recurring?: boolean
  start_time?: string
  end_time?: string
}

export interface UpdateHolidayData extends Partial<CreateHolidayData> {
  is_active?: boolean
}

export interface CreateUserData {
  first_name: string
  last_name: string
  middle_name?: string
  suffix?: string
  full_name?: string
  account_id: string
  user_type: UserType
  education_level?: EducationLevel
  grade_level_id?: number
  section_id?: number
  strand_id?: number
  department_id?: number
  program_id?: number
  office_id?: number
  year_level?: string
  email?: string
  contact_number?: string
  rfid_code?: string
  purpose?: string
}

export interface CreateUserAccountData {
  username: string
  password: string
  role: UserRole
  user_data: CreateUserData
}

export interface UpdateUserData {
  first_name?: string
  last_name?: string
  middle_name?: string
  suffix?: string
  full_name?: string
  education_level?: EducationLevel
  grade_level_id?: number
  section_id?: number
  strand_id?: number
  course?: string
  department?: string
  year_level?: string
  email?: string
  contact_number?: string
  rfid_code?: string
  purpose?: string
  status?: UserStatus
}

export interface CreateBookData {
  // Title Information
  title: string
  subtitle?: string
  uniform_title?: string
  varying_form?: string
  
  // Standard Numbers
  isbn?: string
  issn?: string
  lccn?: string
  
  // Material Type
  material_type?: MaterialType
  subtype?: string
  
  // Series Information
  series_title?: string
  volume_number?: string
  
  // Reading Level Information
  interest_level?: string
  lexile_code?: string
  fountas_pinnell?: string
  
  // Publication Information
  publisher?: string
  publication_place?: string
  publication_date?: string
  year_published?: number
  edition?: string
  
  // Physical Description
  pages?: number
  extent?: string
  size?: string
  other_details?: string
  
  // Content Information
  description?: string
  summary?: string
  notes?: string
  language?: string
  
  // Library Management
  category_id: number
  section_id?: number
  location?: string
  copies_total?: number
  
  // Legacy field (kept for backward compatibility)
  book_author?: string
  
  // Related entities
  authors?: Partial<BookAuthor>[]
  contributors?: Partial<BookContributor>[]
  alternate_titles?: Partial<AlternateTitle>[]
  links?: Partial<BookLink>[]
  digital_content?: Partial<DigitalContent>[]
}

export interface UpdateBookData {
  // Title Information
  title?: string
  subtitle?: string
  uniform_title?: string
  varying_form?: string
  
  // Standard Numbers
  isbn?: string
  issn?: string
  lccn?: string
  
  // Material Type
  material_type?: MaterialType
  subtype?: string
  
  // Series Information
  series_title?: string
  volume_number?: string
  
  // Reading Level Information
  interest_level?: string
  lexile_code?: string
  fountas_pinnell?: string
  
  // Publication Information
  publisher?: string
  publication_place?: string
  publication_date?: string
  year_published?: number
  edition?: string
  
  // Physical Description
  pages?: number
  extent?: string
  size?: string
  other_details?: string
  
  // Content Information
  description?: string
  summary?: string
  notes?: string
  language?: string
  
  // Library Management
  category_id?: number
  section_id?: number
  location?: string
  copies_total?: number
  copies_available?: number
  status?: BookStatus
  
  // Legacy field (kept for backward compatibility)
  book_author?: string
  
  // Related entities
  authors?: Partial<BookAuthor>[]
  contributors?: Partial<BookContributor>[]
  alternate_titles?: Partial<AlternateTitle>[]
  links?: Partial<BookLink>[]
  digital_content?: Partial<DigitalContent>[]
}

export interface CreateLockerData {
  locker_number: string
  location: string
}

export interface UpdateLockerData {
  locker_number?: string
  location?: string
  status?: LockerStatus
}

export interface ServiceResult<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  code?: string
}

export interface DashboardStats {
  todayEntries: number
  activeLockers: number
  borrowedBooks: number
  overdueBooks: number
  overdueLockers: number
  totalUsers: number
}

export interface ReportParams {
  module: ReportModule
  startDate?: Date
  endDate?: Date
  filters?: Record<string, any>
  format?: 'excel' | 'pdf'
}

export interface SearchFilters {
  query?: string
  category?: string
  status?: string
  searchType?: string
  userType?: UserType
  role?: UserRole
  action?: string
  departmentId?: string
  programId?: string
  department?: string
  yearLevel?: string
  dateFrom?: Date
  dateTo?: Date
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface NavigationItem {
  name: string
  href: string
  icon: string
  roles: readonly UserRole[]
  children?: NavigationItem[]
}

export interface AppError extends Error {
  code?: string
  statusCode?: number
  details?: any
}

export interface AppConfig {
  DATABASE_URL: string
  JWT_SECRET: string
  NEXTAUTH_SECRET: string
  NEXTAUTH_URL: string
  NODE_ENV: 'development' | 'production' | 'test'
  EMAIL_HOST?: string
  EMAIL_PORT?: number
  EMAIL_USER?: string
  EMAIL_PASS?: string
  EMAIL_FROM?: string
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface PasswordResetData {
  newPassword: string
  confirmPassword: string
}

export interface RolePermissions {
  [key: string]: UserRole[]
}

export interface ActivityLogEntry {
  id: string
  timestamp: Date
  user: string
  action: string
  details: string
  ip?: string
}

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export interface NotificationPreferences {
  email: boolean
  inApp: boolean
  overdueReminders: boolean
  systemAlerts: boolean
}

export interface OverdueSettlement {
  settlement_id: number
  user_id: number
  transaction_type: OverdueTransactionType
  transaction_id: number
  penalty_amount: number
  amount_paid: number
  remaining_balance: number
  status: OverdueSettlementStatus
  settled_at?: Date
  processed_by?: number
  notes?: string
  created_at: Date
  updated_at: Date
}

export {
  UserRole,
  UserType,
  UserStatus,
  BookStatus,
  Campus,
  LockerStatus,
  ReportModule,
  PenaltyType,
  ConfigDataType,
  OverdueTransactionType,
  OverdueSettlementStatus
}
// Basic Education Types
export interface Strand {
  strand_id: number
  name: string
  code: string
  abbreviation: string
  is_active: boolean
  created_at: Date
  updated_at: Date
  archived_at?: Date
}

export interface GradeLevel {
  grade_level_id: number
  name: string
  code: string
  level_number: number
  education_level: EducationLevel
  is_active: boolean
  created_at: Date
  updated_at: Date
  archived_at?: Date
}

export interface Section {
  section_id: number
  grade_level_id: number
  strand_id?: number
  name: string
  is_active: boolean
  created_at: Date
  updated_at: Date
  archived_at?: Date
  grade_level?: GradeLevel
  strand?: Strand
}

// Export Types
export type ExportFormat = 'excel' | 'csv' | 'pdf'

export interface ExportJob {
  job_id: number
  user_id: number
  filters: string
  columns: string
  format: string
  status: ExportJobStatus
  file_url?: string
  error_message?: string
  created_at: Date
  completed_at?: Date
}

export interface ExportOptions {
  filters: Record<string, any>
  columns: string[]
  format: ExportFormat
}

// Entrance/Exit Control Report Types
export interface EntranceExitTimeRangeData {
  timeRange: string
  admin: number
  faculty: number
  employee: number
  guest: number
  alumni: number
  basicEducation: number
  collegeStudents: number
  total: number
}

export interface EntranceExitReportData {
  month: number
  year: number
  timeRangeData: EntranceExitTimeRangeData[]
  summary: {
    totalEntries: number
    peakTimeRange: string
    averagePerHour: number
  }
}

// Locker Statistics Report Types
export interface LockerStatisticsReportData {
  month: number
  year: number
  dailyData: Array<{
    date: string
    dayOfWeek: string
    dayOfMonth: number
    hours: Record<number, number>
    total: number
    uniqueCount?: number
    holiday?: { name: string; description?: string | null }
  }>
  hourlyTotals: Record<number, number>
  hourlyAverages?: Record<number, number>
  peakHours?: Array<{ hour: number; count: number }>
  userTypeStats: Record<string, number>
  summary: {
    totalAssignments: number
    totalDays: number
    averagePerDay: number
    maxOccupancy?: number
    averageOccupancy?: number
    peakHour?: number
    totalUniqueUsers?: number
  }
}

// Re-export Prisma enums
export { EducationLevel, ExportJobStatus }
