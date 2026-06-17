'use client'

import { useState, useCallback } from 'react'
import useSWR, { mutate, SWRResponse } from 'swr'
import { ApiResponse } from '@/types'

interface UseApiOptions {
  onSuccess?: (data: any) => void
  onError?: (error: string) => void
}

// Global fetcher function for SWR
const fetcher = async (url: string) => {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-cache', // Disable browser caching
  })

  if (!response.ok) {
    const error = new Error('An error occurred while fetching the data.')
    // @ts-expect-error Adding info property to Error object
    error.info = await response.json()
    // @ts-expect-error Adding status property to Error object
    error.status = response.status
    throw error
  }

  return response.json()
}

// New SWR-based hook for real-time data fetching
export function useApiSWR<T = any>(
  key: string | null, 
  options: {
    refreshInterval?: number
    revalidateOnFocus?: boolean
    revalidateOnReconnect?: boolean
    dedupingInterval?: number
  } = {}
): SWRResponse<T, any> & { 
  refresh: () => void
  refreshAll: (pattern?: string) => void
} {
  const {
    refreshInterval = 0, // Set to 0 for manual control
    revalidateOnFocus = true, // Refresh when window gains focus
    revalidateOnReconnect = true, // Refresh when reconnecting
    dedupingInterval = 2000, // Prevent duplicate requests within 2 seconds
  } = options

  const swrResponse = useSWR<T>(
    key,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus,
      revalidateOnReconnect,
      dedupingInterval,
      errorRetryCount: 3,
      errorRetryInterval: 5000,
      // Keep data fresh but don't show loading state on background updates
      keepPreviousData: true,
    }
  )

  // Manual refresh function for this specific key
  const refresh = useCallback(() => {
    if (key) {
      mutate(key)
    }
  }, [key])

  // Refresh all cache keys matching a pattern
  const refreshAll = useCallback((pattern?: string) => {
    if (pattern) {
      // Refresh all keys that match the pattern
      mutate(
        (key) => typeof key === 'string' && key.includes(pattern),
        undefined,
        { revalidate: true }
      )
    } else {
      // Refresh all cache
      mutate(() => true, undefined, { revalidate: true })
    }
  }, [])

  return {
    ...swrResponse,
    refresh,
    refreshAll,
  }
}

// Original useApi hook for mutations (POST, PUT, DELETE)
export function useApi<T = any>(options: UseApiOptions = {}) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(async (
    url: string,
    requestOptions: RequestInit = {}
  ): Promise<ApiResponse<T>> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...requestOptions.headers,
        },
        cache: 'no-cache', // Disable browser caching
        ...requestOptions,
      })

      const result: ApiResponse<T> = await response.json()

      if (result.success) {
        setData(result.data || null)
        options.onSuccess?.(result.data)
      } else {
        setError(result.error || 'An error occurred')
        options.onError?.(result.error || 'An error occurred')
      }

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error'
      setError(errorMessage)
      options.onError?.(errorMessage)
      return {
        success: false,
        error: errorMessage,
      }
    } finally {
      setLoading(false)
    }
  }, [options])

  const get = useCallback((url: string) => 
    execute(url, { method: 'GET' }), [execute])

  const post = useCallback((url: string, body?: any) => 
    execute(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }), [execute])

  const put = useCallback((url: string, body?: any) => 
    execute(url, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }), [execute])

  const del = useCallback((url: string) => 
    execute(url, { method: 'DELETE' }), [execute])

  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setLoading(false)
  }, [])

  return {
    data,
    loading,
    error,
    execute,
    get,
    post,
    put,
    delete: del,
    reset,
  }
}

// Utility functions for manual cache management
export const apiCache = {
  // Invalidate specific cache key
  invalidate: (key: string) => {
    mutate(key)
  },

  // Invalidate all cache keys matching pattern
  invalidatePattern: (pattern: string) => {
    mutate(
      (key) => typeof key === 'string' && key.includes(pattern),
      undefined,
      { revalidate: true }
    )
  },

  // Clear all cache
  clearAll: () => {
    mutate(() => true, undefined, { revalidate: false })
  },

  // Update cache with new data (optimistic updates)
  updateCache: <T>(key: string, data: T) => {
    mutate(key, data, { revalidate: false })
  },
}

// Pre-defined API endpoints for consistency
export const API_ENDPOINTS = {
  LIBRARY_USERS: '/api/library-users',
  STAFF_ACCOUNTS: '/api/staff-accounts',
  ADMIN_ACCOUNTS: '/api/admin-accounts',
  BOOKS: '/api/books',
  BORROWING_TRANSACTIONS: '/api/borrowing-transactions',
  ENTRY_LOGS: '/api/entry-logs',
  ACTIVITY_LOGS: '/api/activity-logs',
  DEPARTMENTS: '/api/departments',
  // PROGRAMS: '/api/programs',
  BOOK_CATEGORIES: '/api/book-categories',
  SECTIONS: '/api/sections',
  OVERDUE: '/api/overdue',
  NOTIFICATIONS: '/api/notifications',
  DASHBOARD_STATS: '/api/dashboard/stats',
  DASHBOARD_ADMIN_ANALYTICS: '/api/dashboard/admin-analytics',
  DASHBOARD_STAFF_ANALYTICS: '/api/dashboard/staff-analytics',
} as const
