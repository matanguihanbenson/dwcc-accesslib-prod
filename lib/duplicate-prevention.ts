/**
 * Duplicate submission prevention utilities
 * Prevents accidental multiple submissions on forms and API calls
 */

import { NextRequest, NextResponse } from 'next/server'

interface SubmissionTracker {
  [key: string]: {
    timestamp: number
    ttl: number
  }
}

class DuplicateSubmissionPreventer {
  private submissions: SubmissionTracker = {}
  private defaultTTL = 5000 // 5 seconds default prevention window

  /**
   * Check if a submission is a duplicate
   */
  isDuplicate(key: string, ttl: number = this.defaultTTL): boolean {
    const now = Date.now()
    const submission = this.submissions[key]

    if (!submission) {
      return false
    }

    // Check if the submission is still within the prevention window
    const isWithinWindow = (now - submission.timestamp) < submission.ttl
    
    if (!isWithinWindow) {
      // Clean up expired submission
      delete this.submissions[key]
      return false
    }

    return true
  }

  /**
   * Mark a submission as in progress
   */
  markSubmission(key: string, ttl: number = this.defaultTTL): void {
    this.submissions[key] = {
      timestamp: Date.now(),
      ttl
    }
  }

  /**
   * Clear a specific submission (call when operation completes)
   */
  clearSubmission(key: string): void {
    delete this.submissions[key]
  }

  /**
   * Generate a submission key based on user, action, and data
   */
  generateKey(userId: string, action: string, data?: any): string {
    const dataHash = data ? this.simpleHash(JSON.stringify(data)) : ''
    return `${userId}:${action}:${dataHash}`
  }

  /**
   * Simple hash function for data
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash 
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * Clean up expired submissions (run periodically)
   */
  cleanup(): void {
    const now = Date.now()
    Object.keys(this.submissions).forEach(key => {
      const submission = this.submissions[key]
      if ((now - submission.timestamp) >= submission.ttl) {
        delete this.submissions[key]
      }
    })
  }

  getStats() {
    return {
      activeSubmissions: Object.keys(this.submissions).length,
      submissions: { ...this.submissions }
    }
  }
}

export const duplicatePreventer = new DuplicateSubmissionPreventer()

setInterval(() => {
  duplicatePreventer.cleanup()
}, 30000)

/**
 * Middleware for preventing duplicate API submissions
 */
export function withDuplicatePreventionByBody(
  handler: (...args: any[]) => Promise<any>,
  options: {
    ttl?: number
    keyFields?: string[] // Specific fields to use for duplicate detection
    skipDuplicateCheck?: (req: any) => boolean
  } = {}
) {
  return async (req: any, ...args: any[]) => {
    try {
      // Skip duplicate check for GET requests
      if (req.method === 'GET') {
        return await handler(req, ...args)
      }

      // Allow custom skip logic
      if (options.skipDuplicateCheck?.(req)) {
        return await handler(req, ...args)
      }

      // Get user info from session (if available)
      const session = args.find(arg => arg?.user?.id) || { user: { id: 'anonymous' } }
      const userId = session.user.id

      // Parse request body
      let requestData = {}
      try {
        const body = await req.clone().json()
        
        // Use only specified fields for duplicate detection if provided
        if (options.keyFields) {
          requestData = options.keyFields.reduce((acc, field) => {
            if (body[field] !== undefined) {
              acc[field] = body[field]
            }
            return acc
          }, {} as any)
        } else {
          requestData = body
        }
      } catch (error) {
        // If we can't parse the body, skip duplicate prevention
        return await handler(req, ...args)
      }

      // Generate submission key
      const action = `${req.method}:${new URL(req.url).pathname}`
      const submissionKey = duplicatePreventer.generateKey(userId, action, requestData)

      // Check for duplicate
      if (duplicatePreventer.isDuplicate(submissionKey, options.ttl)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Duplicate submission detected. Please wait before trying again.',
            code: 'DUPLICATE_SUBMISSION'
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '5'
            }
          }
        )
      }

      // Mark submission as in progress
      duplicatePreventer.markSubmission(submissionKey, options.ttl)

      try {
        // Execute the handler
        const result = await handler(req, ...args)
        
        // Clear submission on success
        duplicatePreventer.clearSubmission(submissionKey)
        
        return result
      } catch (error) {
        // Clear submission on error too (to allow retry)
        duplicatePreventer.clearSubmission(submissionKey)
        throw error
      }

    } catch (error) {
      console.error('Duplicate prevention error:', error)
      // If duplicate prevention fails, continue with the request
      return await handler(req, ...args)
    }
  }
}

/**
 * Database-level duplicate prevention for critical operations
 */
export async function withDatabaseDuplicateCheck<T>(
  operation: () => Promise<T>,
  checkQuery: () => Promise<any>,
  errorMessage: string = 'Duplicate record detected'
): Promise<T> {
  // Check if record already exists
  const existing = await checkQuery()
  
  if (existing) {
    throw new Error(`${errorMessage}: Record already exists`)
  }
  
  // Proceed with operation
  return await operation()
}

/**
 * Client-side duplicate prevention hook (for frontend)
 */
export function createClientDuplicatePreventer() {
  const pendingRequests = new Set<string>()

  return {
    async preventDuplicate<T>(
      key: string,
      operation: () => Promise<T>,
      ttl: number = 5000
    ): Promise<T> {
      if (pendingRequests.has(key)) {
        throw new Error('Operation already in progress')
      }

      pendingRequests.add(key)

      try {
        const result = await operation()
        
        // Keep the key for a short time to prevent rapid resubmission
        setTimeout(() => {
          pendingRequests.delete(key)
        }, ttl)
        
        return result
      } catch (error) {
        // Remove immediately on error to allow retry
        pendingRequests.delete(key)
        throw error
      }
    },

    isInProgress(key: string): boolean {
      return pendingRequests.has(key)
    },

    clear(key: string): void {
      pendingRequests.delete(key)
    }
  }
}

export default duplicatePreventer
