import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { UserRole, UserType, ApiResponse, AuthSession } from '@/types'
import { getErrorResponse, logError, AppError, AuthorizationError, ValidationError } from './errors'
import { hasPermission } from './auth-middleware'
import { prisma } from './prisma'
import { cache, generateCacheKey } from './cache'

/**
 * Consolidated API Utilities
 * This file contains all API-related helper functions including:
 * - Authentication wrappers
 * - Response creators
 * - Session helpers
 * - Performance utilities
 * - Caching support
 */

export function withAuth(
  handler: (req: NextRequest, session: AuthSession, context?: any) => Promise<NextResponse>,
  requiredRoles?: UserRole[]
) {
  return async (req: NextRequest, context?: any) => {
    try {
      const session = await getServerSession(authOptions) as AuthSession | null

      if (!session) {
        return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED')
      }

      if (requiredRoles && !hasPermission(session.user.role, requiredRoles)) {
        return createErrorResponse('Insufficient permissions', 403, 'FORBIDDEN')
      }

      return await handler(req, session, context)
    } catch (error) {
      if (error instanceof AppError) {
        return createErrorResponse(error.message, error.statusCode, error.code)
      }
      return handleApiError(error)
    }
  }
}

export function withValidation(
  req: NextRequest,
  validator: (data: any) => { isValid: boolean; errors: string[] },
  handler: (req: NextRequest, data: any) => Promise<NextResponse>
) {
  return async () => {
    try {
      const body = await req.json()
      const validation = validator(body)
      
      if (!validation.isValid) {
        return createErrorResponse(validation.errors.join(', '), 400, 'VALIDATION_ERROR')
      }
      
      return await handler(req, body)
    } catch (error) {
      if (error instanceof ValidationError) {
        return createErrorResponse(error.message, 400, 'VALIDATION_ERROR')
      }
      return handleApiError(error)
    }
  }
}

export function createSuccessResponse<T>(
  data?: T,
  message?: string,
  status: number = 200
): NextResponse {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  }

  // Add cache control headers to prevent caching for real-time data
  return NextResponse.json(response, { 
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
    }
  })
}

export function createErrorResponse(
  error: string,
  status: number = 500,
  code?: string
): NextResponse {
  const response: ApiResponse<null> = {
    success: false,
    error,
    code,
  }

  return NextResponse.json(response, { 
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
    }
  })
}

export function handleApiError(error: any): NextResponse {
  
  if (error instanceof AppError) {
    return createErrorResponse(error.message, error.statusCode, error.code)
  }
  
  if (error instanceof AuthorizationError) {
    return createErrorResponse(error.message, 403, 'FORBIDDEN')
  }
  
  if (error instanceof ValidationError) {
    return createErrorResponse(error.message, 400, 'VALIDATION_ERROR')
  }
  
  // Log unexpected errors
  logError(error, 'API_ERROR')
  
  return createErrorResponse(
    'Internal server error',
    500,
    'INTERNAL_ERROR'
  )
}

export function getSearchParams(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  
  const role = searchParams.get('role')
  const userType = searchParams.get('userType')

  return {
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '25'),
    query: searchParams.get('query') || '',
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    userType: userType ? (userType as UserType) : undefined,
    departmentId: searchParams.get('departmentId') || '',
    programId: searchParams.get('programId') || '',
    yearLevel: searchParams.get('yearLevel') || '',
    user_id: searchParams.get('user_id') || '',
    department: searchParams.get('department') || '',
    year_level: searchParams.get('year_level') || '',
    campus: searchParams.get('campus') || '',
    date_from: searchParams.get('date_from') || '',
    date_to: searchParams.get('date_to') || '',
    include_user: searchParams.get('include_user') || '',
    searchType: searchParams.get('searchType') || '',
    action: searchParams.get('action') || '',
    role: role ? (role as UserRole) : undefined,
    dateFrom: searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : undefined,
    dateTo: searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : undefined,
    section_id: searchParams.get('section_id') || '',
    grade_level_id: searchParams.get('grade_level_id') || '',
    strand_id: searchParams.get('strand_id') || '',
    office_id: searchParams.get('office_id') || '',
    program_id: searchParams.get('program_id') || '',
    department_id: searchParams.get('department_id') || '',
  }
}

export async function getCurrentUser(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as AuthSession | null
    
    if (!session?.user?.id) {
      return null
    }

    const userAccount = await prisma.userAccount.findUnique({
      where: { id: parseInt(session.user.id) },
      include: {
        user: {
          select: {
            user_id: true,
            full_name: true,
            account_id: true,
            user_type: true,
            email: true,
            status: true
          }
        }
      }
    })

    if (!userAccount) {
      return null
    }

    return {
      id: userAccount.id,
      username: userAccount.username,
      role: userAccount.role,
      user: userAccount.user
    }
  } catch (error) {
    return null
  }
}

// Helper function to get user ID from session (returns UserAccount.id)
export function getUserAccountId(session: AuthSession | null): number | null {
  if (!session?.user?.id) {
    return null
  }
  return parseInt(session.user.id)
}

// Helper function to get User.user_id from UserAccount
export async function getUserId(userAccountId: number): Promise<number | null> {
  try {
    const userAccount = await prisma.userAccount.findUnique({
      where: { id: userAccountId },
      select: { user_id: true }
    })
    return userAccount?.user_id || null
  } catch (error) {
    console.error('Error getting user ID:', error)
    return null
  }
}

// Get the actual User.user_id from session
export function getUserIdFromSession(session: AuthSession | null): Promise<number | null> {
  const userAccountId = getUserAccountId(session)
  if (!userAccountId) return Promise.resolve(null)
  return getUserId(userAccountId)
}

// Validate that an ID is a positive integer
export function validateId(id: string | number, fieldName?: string): number {
  const numId = typeof id === 'string' ? parseInt(id, 10) : id
  
  if (isNaN(numId) || numId <= 0 || !Number.isInteger(numId)) {
    const field = fieldName || 'ID'
    throw new ValidationError(`Invalid ${field}: must be a positive integer`)
  }
  
  return numId
}

/**
 * ============================================================================
 * PERFORMANCE & CACHING UTILITIES
 * ============================================================================
 */

/**
 * Enhanced API wrapper with caching support
 * Use this for GET endpoints that can benefit from caching
 */
export function withCachedAuth(
  handler: (req: NextRequest, session: any) => Promise<NextResponse>,
  requiredRoles?: UserRole[],
  cacheConfig?: {
    ttl?: number // Cache TTL in milliseconds
    skipCache?: (req: NextRequest) => boolean // Function to determine if cache should be skipped
    generateKey?: (req: NextRequest, session: any) => string // Custom cache key generator
  }
) {
  return async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions)

      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      if (requiredRoles && !hasPermission(session.user.role as UserRole, requiredRoles)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      // Handle caching for GET requests only
      if (req.method === 'GET' && cacheConfig) {
        const shouldSkipCache = cacheConfig.skipCache?.(req) || false
        
        if (!shouldSkipCache) {
          const cacheKey = cacheConfig.generateKey 
            ? cacheConfig.generateKey(req, session)
            : generateCacheKey('api', {
                url: req.url,
                role: session.user.role,
                userId: session.user.id
              })
          
          const cached = cache.get(cacheKey)
          if (cached) {
            return NextResponse.json(cached)
          }
          
          // Execute handler and cache result
          const response = await handler(req, session)
          
          if (response.status === 200) {
            const responseData = await response.json()
            cache.set(cacheKey, responseData, cacheConfig.ttl || 300000) // Default 5 minutes
            
            // Return new response with the data
            return NextResponse.json(responseData)
          }
          
          return response
        }
      }

      return await handler(req, session)
    } catch (error) {
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Optimized response creator with compression hints
 * Use this for responses that might be large
 */
export function createOptimizedResponse<T>(
  data?: T,
  message?: string,
  status: number = 200
): NextResponse {
  const response: any = {
    success: true,
    data,
    message,
  }

  const nextResponse = NextResponse.json(response, { status })
  
  // Add compression headers for large responses
  if (JSON.stringify(response).length > 1024) {
    nextResponse.headers.set('Content-Encoding', 'gzip')
  }
  
  // Add cache headers for GET requests
  if (status === 200) {
    nextResponse.headers.set('Cache-Control', 'public, max-age=300') // 5 minutes
  }
  
  return nextResponse
}

/**
 * Batch processing utility for handling multiple items efficiently
 * Useful for bulk operations to avoid overwhelming the database
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 10
): Promise<R[]> {
  const results: R[] = []
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(processor))
    results.push(...batchResults)
  }
  
  return results
}

/**
 * Utility to prefetch related data to avoid N+1 queries
 * Example: Prefetch all related users when fetching transactions
 */
export async function prefetchRelatedData<T>(
  items: T[],
  getRelatedIds: (item: T) => number[],
  fetchRelated: (ids: number[]) => Promise<any[]>
): Promise<Map<number, any>> {
  const relatedIds = Array.from(
    new Set(items.flatMap(getRelatedIds))
  )
  
  if (relatedIds.length === 0) {
    return new Map()
  }
  
  const relatedData = await fetchRelated(relatedIds)
  const relatedMap = new Map()
  
  relatedData.forEach(item => {
    relatedMap.set(item.id, item)
  })
  
  return relatedMap
}

/**
 * Performance monitoring wrapper
 * Wraps async functions and logs slow operations
 */
export function withPerformanceMonitoring<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  operationName: string
) {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now()
    
    try {
      const result = await fn(...args)
      const duration = Date.now() - startTime
      
      // Log slow operations
      if (duration > 1000) {
      }
      
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      throw error
    }
  }
}
