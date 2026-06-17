/**
 * Simple in-memory cache utility for API responses
 * Optimized for serverless environments
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class Cache {
  private store = new Map<string, CacheEntry<any>>()
  private maxSize = 1000 // Limit cache size for memory efficiency

  /**
   * Get cached data if valid
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    
    if (!entry) {
      return null
    }
    
    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.store.delete(key)
      return null
    }
    
    return entry.data
  }

  /**
   * Set cache data with TTL
   */
  set<T>(key: string, data: T, ttlMs: number = 300000): void { // Default 5 minutes
    // Clean up if cache is too large
    if (this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value
      if (oldestKey) {
        this.store.delete(oldestKey)
      }
    }
    
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    })
  }

  /**
   * Delete specific cache entry
   */
  delete(key: string): void {
    this.store.delete(key)
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.store.clear()
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.store.size,
      maxSize: this.maxSize
    }
  }
}

// Global cache instance
export const cache = new Cache()

/**
 * Cache decorator for functions
 */
export function withCache<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  keyGenerator: (...args: T) => string,
  ttlMs: number = 300000
) {
  return async (...args: T): Promise<R> => {
    const key = keyGenerator(...args)
    
    // Try to get from cache
    const cached = cache.get<R>(key)
    if (cached !== null) {
      return cached
    }
    
    // Execute function and cache result
    const result = await fn(...args)
    cache.set(key, result, ttlMs)
    
    return result
  }
}

/**
 * Generate cache key for common patterns
 */
export function generateCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|')
  
  return `${prefix}:${sortedParams}`
}
