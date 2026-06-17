'use client'

import { useCallback } from 'react'
import { apiCache } from './useApi'

/**
 * Hook for managing real-time cache invalidation after mutations
 * This ensures that all related data is refreshed after any changes
 */
export function useCacheManager() {
  const invalidateUserData = useCallback(() => {
    // Invalidate all user-related cache
    apiCache.invalidatePattern('/api/library-users')
    apiCache.invalidatePattern('/api/users')
    apiCache.invalidatePattern('/api/staff')
    apiCache.invalidatePattern('/api/admin')
  }, [])

  const invalidateBookData = useCallback(() => {
    // Invalidate all book-related cache
    apiCache.invalidatePattern('/api/books')
    apiCache.invalidatePattern('/api/borrowing-transactions')
    apiCache.invalidatePattern('/api/overdue')
  }, [])

  const invalidateDashboardData = useCallback(() => {
    // Invalidate dashboard cache
    apiCache.invalidatePattern('/api/dashboard')
  }, [])

  const invalidateActivityData = useCallback(() => {
    // Invalidate activity logs
    apiCache.invalidatePattern('/api/activity-logs')
    apiCache.invalidatePattern('/api/entry-logs')
  }, [])

  const invalidateSystemData = useCallback(() => {
    // Invalidate system settings
    apiCache.invalidatePattern('/api/departments')
    apiCache.invalidatePattern('/api/programs')
    apiCache.invalidatePattern('/api/book-categories')
    apiCache.invalidatePattern('/api/sections')
  }, [])

  const invalidateNotifications = useCallback(() => {
    // Invalidate notifications
    apiCache.invalidatePattern('/api/notifications')
  }, [])

  const invalidateAll = useCallback(() => {
    // Nuclear option - refresh everything
    apiCache.clearAll()
  }, [])

  return {
    invalidateUserData,
    invalidateBookData,
    invalidateDashboardData,
    invalidateActivityData,
    invalidateSystemData,
    invalidateNotifications,
    invalidateAll,
  }
}

/**
 * Mutation success handler that automatically invalidates related cache
 */
export function createMutationHandler(
  invalidatePatterns: string[],
  onSuccess?: (data: any) => void,
  onError?: (error: string) => void
) {
  return {
    onSuccess: (data: any) => {
      // Invalidate all specified patterns
      invalidatePatterns.forEach(pattern => {
        apiCache.invalidatePattern(pattern)
      })
      
      // Call custom success handler
      onSuccess?.(data)
    },
    onError: (error: string) => {
      // Call custom error handler
      onError?.(error)
    }
  }
}
