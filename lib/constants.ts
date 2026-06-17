import type { NavigationItem } from '@/types'

export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN' as const,
  ADMIN: 'ADMIN' as const,
  STAFF: 'STAFF' as const,
  USER: 'USER' as const,
} as const

export const USER_TYPES = {
  STUDENT: 'STUDENT' as const,
  EMPLOYEE: 'EMPLOYEE' as const,
  ALUMNI: 'ALUMNI' as const,
  GUEST: 'GUEST' as const,
} as const

export const BOOK_STATUSES = {
  AVAILABLE: 'AVAILABLE' as const,
  BORROWED: 'BORROWED' as const,
  LOST: 'LOST' as const,
  DAMAGED: 'DAMAGED' as const,
  ARCHIVED: 'ARCHIVED' as const,
} as const

export const LOCKER_STATUSES = {
  AVAILABLE: 'AVAILABLE' as const,
  OCCUPIED: 'OCCUPIED' as const,
  DAMAGED: 'DAMAGED' as const,
  MAINTENANCE: 'MAINTENANCE' as const,
  ARCHIVED: 'ARCHIVED' as const,
} as const

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
} as const

export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 50,
  EMAIL_MAX_LENGTH: 100,
  NAME_MAX_LENGTH: 100,
  ACCOUNT_ID_MAX_LENGTH: 20,
  RFID_CODE_MAX_LENGTH: 50,
} as const

export const SESSION = {
  MAX_AGE_PROD: 24 * 60 * 60,
  MAX_AGE_DEV: 30 * 60,
  UPDATE_AGE: 5 * 60,
  COOKIE_NAME: 'accesslib-session',
} as const

export const PENALTIES = {
  BOOK_GRACE_PERIOD_DAYS: 3,
  LOCKER_GRACE_PERIOD_HOURS: 2,
  LOCKER_GRACE_PERIOD_MINUTES: 15,
  DEFAULT_BOOK_PENALTY_PER_DAY: 5.00,
  DEFAULT_LOCKER_PENALTY_PER_HOUR: 2.00,
  MAX_BOOK_PENALTY: 100.00,
  MAX_LOCKER_PENALTY: 50.00,
} as const

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: 'fa-tachometer-alt',
    roles: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.STAFF]
  },
  {
    name: 'Entry Monitoring',
    href: '/entry-monitoring',
    icon: 'fa-door-open',
    roles: [USER_ROLES.ADMIN, USER_ROLES.STAFF]
  },
  {
    name: 'Books',
    href: '/books',
    icon: 'fa-book',
    roles: [USER_ROLES.ADMIN, USER_ROLES.STAFF, USER_ROLES.USER],
    children: [
      {
        name: 'Add Book',
        href: '/books/add',
        icon: 'fa-plus',
        roles: [USER_ROLES.ADMIN, USER_ROLES.STAFF]
      },
      {
        name: 'Manage Books',
        href: '/books',
        icon: 'fa-cogs',
        roles: [USER_ROLES.ADMIN, USER_ROLES.STAFF]
      },
      {
        name: 'Manage Categories',
        href: '/books/categories',
        icon: 'fa-tags',
        roles: [USER_ROLES.ADMIN]
      },
      {
        name: 'Manage Sections',
        href: '/books/sections',
        icon: 'fa-layer-group',
        roles: [USER_ROLES.ADMIN]
      },
      {
        name: 'Borrow Books',
        href: '/books/borrow',
        icon: 'fa-hand-holding',
        roles: [USER_ROLES.STAFF]
      },
      {
        name: 'Return Books',
        href: '/books/return',
        icon: 'fa-undo',
        roles: [USER_ROLES.STAFF]
      },
      {
        name: 'Browse Books',
        href: '/browse',
        icon: 'fa-search',
        roles: [USER_ROLES.USER]
      },
      {
        name: 'Book Transaction History',
        href: '/books/transactions',
        icon: 'fa-history',
        roles: [USER_ROLES.ADMIN, USER_ROLES.STAFF]
      }
    ]
  },
  {
    name: 'Lockers',
    href: '/lockers',
    icon: 'fa-lock',
    roles: [USER_ROLES.ADMIN, USER_ROLES.STAFF]
  },
  {
    name: 'Overdue',
    href: '/overdue',
    icon: 'fa-exclamation-triangle',
    roles: [USER_ROLES.ADMIN, USER_ROLES.STAFF],
    children: [
      {
        name: 'Overdue Items',
        href: '/overdue',
        icon: 'fa-exclamation-triangle',
        roles: [USER_ROLES.ADMIN, USER_ROLES.STAFF]
      },
      {
        name: 'User Penalty Summary',
        href: '/user-penalties',
        icon: 'fa-receipt',
        roles: [USER_ROLES.ADMIN, USER_ROLES.STAFF]
      }
    ]
  },
  {
    name: 'Users',
    href: '/users',
    icon: 'fa-users',
    roles: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN],
    children: [
      {
        name: 'Library Users',
        href: '/library-users',
        icon: 'fa-id-card',
        roles: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.STAFF]
      },
      {
        name: 'Staff Accounts',
        href: '/staff-accounts',
        icon: 'fa-user-tie',
        roles: [USER_ROLES.ADMIN]
      },
      {
        name: 'Library Admin',
        href: '/admin-accounts',
        icon: 'fa-user-shield',
        roles: [USER_ROLES.SUPER_ADMIN]
      }
    ]
  },
  {
    name: 'Programs',
    href: '/programs',
    icon: 'fa-graduation-cap',
    roles: [USER_ROLES.SUPER_ADMIN]
  },
  {
    name: 'Departments',
    href: '/departments',
    icon: 'fa-building',
    roles: [USER_ROLES.SUPER_ADMIN]
  },
  {
    name: 'Basic Education',
    href: '/basic-education',
    icon: 'fa-school',
    roles: [USER_ROLES.SUPER_ADMIN]
  },
  {
    name: 'Offices',
    href: '/offices',
    icon: 'fa-briefcase',
    roles: [USER_ROLES.SUPER_ADMIN]
  },
  {
    name: 'Holidays',
    href: '/holidays',
    icon: 'fa-calendar-times',
    roles: [USER_ROLES.ADMIN]
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: 'fa-chart-bar',
    roles: [USER_ROLES.ADMIN, USER_ROLES.STAFF]
  },
  {
    name: 'Activity Logs',
    href: '/activity-logs',
    icon: 'fa-history',
    roles: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.STAFF]
  },
  {
    name: 'Profile',
    href: '/profile',
    icon: 'fa-user',
    roles: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.STAFF, USER_ROLES.USER]
  }
]

export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SERVER_ERROR: 'SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  BOOK_NOT_AVAILABLE: 'BOOK_NOT_AVAILABLE',
  LOCKER_NOT_AVAILABLE: 'LOCKER_NOT_AVAILABLE',
  TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  BOOK_NOT_FOUND: 'BOOK_NOT_FOUND',
  LOCKER_NOT_FOUND: 'LOCKER_NOT_FOUND',
} as const

export const SUCCESS_MESSAGES = {
  USER_CREATED: 'User created successfully',
  USER_UPDATED: 'User updated successfully',
  USER_DELETED: 'User deleted successfully',
  BOOK_CREATED: 'Book added successfully',
  BOOK_UPDATED: 'Book updated successfully',
  BOOK_DELETED: 'Book deleted successfully',
  BOOK_BORROWED: 'Book borrowed successfully',
  BOOK_RETURNED: 'Book returned successfully',
  LOCKER_ASSIGNED: 'Locker assigned successfully',
  LOCKER_RETURNED: 'Locker returned successfully',
  PASSWORD_RESET: 'Password reset successfully',
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  PROFILE_UPDATED: 'Profile updated successfully',
  SETTINGS_SAVED: 'Settings saved successfully',
} as const

export const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid username or password',
  ACCOUNT_LOCKED: 'Account is temporarily locked. Please try again later.',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  FORBIDDEN: 'Access denied',
  NOT_FOUND: 'Resource not found',
  VALIDATION_ERROR: 'Validation failed',
  DUPLICATE_ENTRY: 'Record already exists',
  SESSION_EXPIRED: 'Your session has expired. Please login again.',
  SERVER_ERROR: 'An internal server error occurred',
  DATABASE_ERROR: 'Database operation failed',
  BOOK_NOT_AVAILABLE: 'Book is not available for borrowing',
  LOCKER_NOT_AVAILABLE: 'Locker is not available',
  TRANSACTION_NOT_FOUND: 'Transaction not found',
  USER_NOT_FOUND: 'User not found',
  BOOK_NOT_FOUND: 'Book not found',
  LOCKER_NOT_FOUND: 'Locker not found',
  WEAK_PASSWORD: 'Password must be at least 8 characters long',
  INVALID_EMAIL: 'Please enter a valid email address',
  REQUIRED_FIELD: 'This field is required',
} as const

export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const

export const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024,
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
  UPLOAD_PATH: '/uploads',
} as const

export const REPORT_FORMATS = {
  EXCEL: 'excel',
  PDF: 'pdf',
} as const

export const EMAIL_TEMPLATES = {
  OVERDUE_BOOK: 'overdue-book',
  OVERDUE_LOCKER: 'overdue-locker',
  WELCOME: 'welcome',
  PASSWORD_RESET: 'password-reset',
  ACCOUNT_LOCKED: 'account-locked',
} as const
