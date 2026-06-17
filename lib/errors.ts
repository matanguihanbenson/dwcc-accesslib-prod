import { ERROR_CODES, ERROR_MESSAGES } from './constants'

export class AppError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly details?: any
  public readonly isOperational: boolean

  constructor(
    message: string,
    code: string = ERROR_CODES.SERVER_ERROR,
    statusCode: number = 500,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.statusCode = statusCode
    this.details = details
    this.isOperational = isOperational

    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message: string = ERROR_MESSAGES.VALIDATION_ERROR, details?: any) {
    super(message, ERROR_CODES.VALIDATION_ERROR, 400, details)
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = ERROR_MESSAGES.INVALID_CREDENTIALS) {
    super(message, ERROR_CODES.INVALID_CREDENTIALS, 401)
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = ERROR_MESSAGES.FORBIDDEN) {
    super(message, ERROR_CODES.FORBIDDEN, 403)
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = ERROR_MESSAGES.NOT_FOUND) {
    super(message, ERROR_CODES.NOT_FOUND, 404)
  }
}

export class DuplicateError extends AppError {
  constructor(message: string = ERROR_MESSAGES.DUPLICATE_ENTRY, details?: any) {
    super(message, ERROR_CODES.DUPLICATE_ENTRY, 409, details)
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = ERROR_MESSAGES.DATABASE_ERROR, details?: any) {
    super(message, ERROR_CODES.DATABASE_ERROR, 500, details)
  }
}

export class BusinessLogicError extends AppError {
  constructor(message: string, code: string, details?: any) {
    super(message, code, 400, details)
  }
}

export class AccountLockedError extends AppError {
  constructor(message: string = ERROR_MESSAGES.ACCOUNT_LOCKED) {
    super(message, ERROR_CODES.ACCOUNT_LOCKED, 423)
  }
}

export class SessionExpiredError extends AppError {
  constructor(message: string = ERROR_MESSAGES.SESSION_EXPIRED) {
    super(message, ERROR_CODES.SESSION_EXPIRED, 401)
  }
}

export function createErrorFromPrisma(error: any): AppError {
  if (error.code === 'P2002') {
    const field = error.meta?.target?.[0] || 'field'
    return new DuplicateError(`${field} already exists`)
  }

  if (error.code === 'P2025') {
    return new NotFoundError('Record not found')
  }

  if (error.code === 'P2003') {
    return new ValidationError('Foreign key constraint failed')
  }

  if (error.code === 'P2014') {
    return new ValidationError('Required field missing')
  }

  return new DatabaseError(`Database operation failed: ${error.message}`)
}

export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational
  }
  return false
}

export function getErrorResponse(error: AppError | Error) {
  if (error instanceof AppError) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      details: error.details,
    }
  }

  return {
    success: false,
    error: ERROR_MESSAGES.SERVER_ERROR,
    code: ERROR_CODES.SERVER_ERROR,
  }
}

export function logError(error: Error, context?: string) {
  console.error(`[${context || 'ERROR'}]`, {
    message: error.message,
    stack: error.stack,
    ...(error instanceof AppError && {
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
    }),
  })
}
