import { UserType, UserRole, BookStatus, LockerStatus } from '@/types'
import { VALIDATION } from './constants'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export function validateRequired(value: any, fieldName: string): string | null {
  if (value === null || value === undefined || value === '') {
    return `${fieldName} is required`
  }
  return null
}

export function validateEmail(email: string): string | null {
  if (!email) return null
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address'
  }
  
  if (email.length > VALIDATION.EMAIL_MAX_LENGTH) {
    return `Email must be less than ${VALIDATION.EMAIL_MAX_LENGTH} characters`
  }
  
  return null
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required'
  
  if (password.length < VALIDATION.PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${VALIDATION.PASSWORD_MIN_LENGTH} characters long`
  }
  
  return null
}

export function validateUsername(username: string): string | null {
  if (!username) return 'Username is required'
  
  if (username.length < VALIDATION.USERNAME_MIN_LENGTH) {
    return `Username must be at least ${VALIDATION.USERNAME_MIN_LENGTH} characters long`
  }
  
  if (username.length > VALIDATION.USERNAME_MAX_LENGTH) {
    return `Username must be less than ${VALIDATION.USERNAME_MAX_LENGTH} characters`
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return 'Username can only contain letters, numbers, hyphens, and underscores'
  }
  
  return null
}

export function validateName(name: string): string | null {
  if (!name) return 'Name is required'
  
  if (name.length > VALIDATION.NAME_MAX_LENGTH) {
    return `Name must be less than ${VALIDATION.NAME_MAX_LENGTH} characters`
  }
  
  if (!/^[a-zA-Z\s.,'-]+$/.test(name)) {
    return 'Name contains invalid characters'
  }
  
  return null
}

export function validateAccountId(accountId: string): string | null {
  if (!accountId) return 'ID Number is required'
  
  if (accountId.length > VALIDATION.ACCOUNT_ID_MAX_LENGTH) {
    return `ID Number must be less than ${VALIDATION.ACCOUNT_ID_MAX_LENGTH} characters`
  }
  
  if (!/^[a-zA-Z0-9-]+$/.test(accountId)) {
    return 'ID Number can only contain letters, numbers, and hyphens'
  }
  
  return null
}

export function validateRFIDCode(rfidCode: string): string | null {
  if (!rfidCode) return null
  
  if (rfidCode.length > VALIDATION.RFID_CODE_MAX_LENGTH) {
    return `RFID code must be less than ${VALIDATION.RFID_CODE_MAX_LENGTH} characters`
  }
  
  if (!/^[a-zA-Z0-9]+$/.test(rfidCode)) {
    return 'RFID code can only contain letters and numbers'
  }
  
  return null
}

export function validateUserType(userType: string): string | null {
  if (!userType) return 'User type is required'
  
  if (!Object.values(UserType).includes(userType as UserType)) {
    return 'Invalid user type'
  }
  
  return null
}

export function validateUserRole(role: string): string | null {
  if (!role) return 'Role is required'
  
  if (!Object.values(UserRole).includes(role as UserRole)) {
    return 'Invalid role'
  }
  
  return null
}

export function validateBookStatus(status: string): string | null {
  if (!status) return 'Status is required'
  
  if (!Object.values(BookStatus).includes(status as BookStatus)) {
    return 'Invalid book status'
  }
  
  return null
}

export function validateLockerStatus(status: string): string | null {
  if (!status) return 'Status is required'
  
  if (!Object.values(LockerStatus).includes(status as LockerStatus)) {
    return 'Invalid locker status'
  }
  
  return null
}

export function validateISBN(isbn: string): string | null {
  if (!isbn) return null
  
  const cleanISBN = isbn.replace(/[-\s]/g, '')
  
  if (!/^\d{10}(\d{3})?$/.test(cleanISBN)) {
    return 'ISBN must be 10 or 13 digits'
  }
  
  return null
}

export function validateYear(year: number): string | null {
  const currentYear = new Date().getFullYear()
  
  if (year < 1900 || year > currentYear + 5) {
    return `Year must be between 1900 and ${currentYear + 5}`
  }
  
  return null
}

export function validatePhone(phone: string): string | null {
  if (!phone) return null
  
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '')

  // Allow local numbers that may start with 0 (e.g. 09xxxxxxxxx)
  // Enforce only that it is all digits and has a reasonable length
  const phoneRegex = /^\d{7,15}$/
  if (!phoneRegex.test(cleanPhone)) {
    return 'Please enter a valid phone number'
  }
  
  return null
}

export function validateDate(date: string | Date): string | null {
  const d = typeof date === 'string' ? new Date(date) : date
  
  if (isNaN(d.getTime())) {
    return 'Please enter a valid date'
  }
  
  return null
}

export function validateFutureDate(date: string | Date): string | null {
  const dateError = validateDate(date)
  if (dateError) return dateError
  
  const d = typeof date === 'string' ? new Date(date) : date
  
  if (d <= new Date()) {
    return 'Date must be in the future'
  }
  
  return null
}

export function validatePastDate(date: string | Date): string | null {
  const dateError = validateDate(date)
  if (dateError) return dateError
  
  const d = typeof date === 'string' ? new Date(date) : date
  
  if (d >= new Date()) {
    return 'Date must be in the past'
  }
  
  return null
}

export function validateCreateUser(data: any): ValidationResult {
  const errors: string[] = []
  
  // Support both old (full_name) and new (first_name, last_name) formats
  if (data.full_name) {
    const nameError = validateName(data.full_name)
    if (nameError) errors.push(nameError)
  } else {
    // Validate first_name and last_name separately
    if (!data.first_name || !data.first_name.trim()) {
      errors.push('First name is required')
    } else {
      const firstNameError = validateName(data.first_name)
      if (firstNameError) errors.push(`First name: ${firstNameError}`)
    }
    
    if (!data.last_name || !data.last_name.trim()) {
      errors.push('Last name is required')
    } else {
      const lastNameError = validateName(data.last_name)
      if (lastNameError) errors.push(`Last name: ${lastNameError}`)
    }
    
    if (data.middle_name) {
      const middleNameError = validateName(data.middle_name)
      if (middleNameError) errors.push(`Middle name: ${middleNameError}`)
    }
  }
  
  const accountIdError = validateAccountId(data.account_id)
  if (accountIdError) errors.push(accountIdError)
  
  const userTypeError = validateUserType(data.user_type)
  if (userTypeError) errors.push(userTypeError)
  
  if (data.email) {
    const emailError = validateEmail(data.email)
    if (emailError) errors.push(emailError)
  }
  
  if (data.contact_number) {
    const phoneError = validatePhone(data.contact_number)
    if (phoneError) errors.push(phoneError)
  }
  
  if (data.rfid_code) {
    const rfidError = validateRFIDCode(data.rfid_code)
    if (rfidError) errors.push(rfidError)
  }
  
  return { isValid: errors.length === 0, errors }
}

export function validateCreateUserAccount(data: any): ValidationResult {
  const errors: string[] = []
  
  const usernameError = validateUsername(data.username)
  if (usernameError) errors.push(usernameError)
  
  const passwordError = validatePassword(data.password)
  if (passwordError) errors.push(passwordError)
  
  const roleError = validateUserRole(data.role)
  if (roleError) errors.push(roleError)
  
  if (data.user_data) {
    const userValidation = validateCreateUser(data.user_data)
    errors.push(...userValidation.errors)
  } else {
    errors.push('User data is required')
  }
  
  return { isValid: errors.length === 0, errors }
}

export function validateCreateBook(data: any): ValidationResult {
  const errors: string[] = []
  
  if (!data.title) {
    errors.push('Title is required')
  } else if (data.title.length > 150) {
    errors.push('Title must be less than 150 characters')
  }
  
  // Accept primary author from any of: book_author, authors[0].name, contributors[0].name
  const firstAuthorName = (
    (typeof data.book_author === 'string' && data.book_author.trim()) ||
    (Array.isArray(data.authors) && data.authors.find((a: any) => a?.name?.trim())?.name) ||
    (Array.isArray(data.contributors) && data.contributors.find((c: any) => c?.name?.trim())?.name) ||
    ''
  ) as string

  if (!firstAuthorName) {
    errors.push('Author is required')
  } else if (firstAuthorName.length > 100) {
    errors.push('Author must be less than 100 characters')
  }
  
  if (!data.category_id) {
    errors.push('Category is required')
  } else if (typeof data.category_id !== 'number' || data.category_id <= 0) {
    errors.push('Invalid category')
  }
  
  if (data.isbn) {
    const isbnError = validateISBN(data.isbn)
    if (isbnError) errors.push(isbnError)
  }
  
  if (data.year_published) {
    const yearError = validateYear(data.year_published)
    if (yearError) errors.push(yearError)
  }
  
  if (data.copies_total !== undefined) {
    if (typeof data.copies_total !== 'number' || data.copies_total < 1) {
      errors.push('Total copies must be at least 1')
    }
  }
  
  return { isValid: errors.length === 0, errors }
}

export function validateCreateLocker(data: any): ValidationResult {
  const errors: string[] = []
  
  if (!data.locker_number) {
    errors.push('Locker number is required')
  } else if (data.locker_number.length > 20) {
    errors.push('Locker number must be less than 20 characters')
  }
  
  if (!data.location) {
    errors.push('Location is required')
  } else if (data.location.length > 100) {
    errors.push('Location must be less than 100 characters')
  }
  
  return { isValid: errors.length === 0, errors }
}

export function validateLogin(data: any): ValidationResult {
  const errors: string[] = []
  
  if (!data.username) {
    errors.push('Username is required')
  }
  
  if (!data.password) {
    errors.push('Password is required')
  }
  
  return { isValid: errors.length === 0, errors }
}

export function validatePasswordReset(data: any): ValidationResult {
  const errors: string[] = []
  
  const passwordError = validatePassword(data.newPassword)
  if (passwordError) errors.push(passwordError)
  
  if (data.newPassword !== data.confirmPassword) {
    errors.push('Passwords do not match')
  }
  
  return { isValid: errors.length === 0, errors }
}
