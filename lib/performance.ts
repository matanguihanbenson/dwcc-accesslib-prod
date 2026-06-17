import logger from './logger'

export interface PerformanceMetrics {
  name: string
  duration: number
  timestamp: Date
  metadata?: Record<string, any>
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: PerformanceMetrics[] = []
  private timers: Map<string, number> = new Map()

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  /**
   * Start timing a performance metric
   */
  startTimer(name: string): void {
    this.timers.set(name, globalThis.performance.now())
  }

  /**
   * End timing and record performance metric
   */
  endTimer(name: string, metadata?: Record<string, any>): number {
    const startTime = this.timers.get(name)
    if (!startTime) {
      logger.warn('Performance timer not found', { timerName: name })
      return 0
    }

    const endTime = globalThis.performance.now()
    const duration = endTime - startTime

    this.recordMetric({
      name,
      duration,
      timestamp: new Date(),
      metadata
    })

    this.timers.delete(name)
    return duration
  }

  /**
   * Measure a function's execution time
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    this.startTimer(name)
    try {
      const result = await fn()
      this.endTimer(name, { ...metadata, success: true })
      return result
    } catch (error) {
      this.endTimer(name, { ...metadata, success: false, error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  /**
   * Measure a synchronous function's execution time
   */
  measure<T>(
    name: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    this.startTimer(name)
    try {
      const result = fn()
      this.endTimer(name, { ...metadata, success: true })
      return result
    } catch (error) {
      this.endTimer(name, { ...metadata, success: false, error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  /**
   * Record a performance metric directly
   */
  recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric)

    // Log slow operations (over 1 second)
    if (metric.duration > 1000) {
      logger.warn('Slow operation detected', {
        operation: metric.name,
        duration: `${metric.duration.toFixed(2)}ms`,
        metadata: metric.metadata
      })
    }

    // Keep only last 1000 metrics in memory
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(name?: string): PerformanceMetrics[] {
    if (name) {
      return this.metrics.filter(metric => metric.name === name)
    }
    return [...this.metrics]
  }

  /**
   * Get average performance for a metric name
   */
  getAveragePerformance(name: string): number {
    const metrics = this.getMetrics(name)
    if (metrics.length === 0) return 0

    const total = metrics.reduce((sum, metric) => sum + metric.duration, 0)
    return total / metrics.length
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = []
    this.timers.clear()
  }

  /**
   * Get performance summary
   */
  getSummary(): {
    totalOperations: number
    averageResponseTime: number
    slowestOperations: PerformanceMetrics[]
  } {
    const totalOperations = this.metrics.length
    const averageResponseTime = totalOperations > 0 
      ? this.metrics.reduce((sum, metric) => sum + metric.duration, 0) / totalOperations
      : 0

    const slowestOperations = [...this.metrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)

    return {
      totalOperations,
      averageResponseTime,
      slowestOperations
    }
  }
}

// Performance monitoring decorators and utilities
export const performance = PerformanceMonitor.getInstance()

/**
 * Decorator for measuring method performance
 */
export function measurePerformance(name?: string) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    const metricName = name || `${target.constructor.name}.${propertyKey}`

    descriptor.value = async function(...args: any[]) {
      return performance.measureAsync(metricName, () => originalMethod.apply(this, args))
    }

    return descriptor
  }
}

/**
 * Database query performance monitoring
 */
export class DatabasePerformanceMonitor {
  static logQuery(query: string, duration: number, params?: any) {
    performance.recordMetric({
      name: 'database_query',
      duration,
      timestamp: new Date(),
      metadata: {
        query: query.substring(0, 200), // Truncate long queries
        params: params ? JSON.stringify(params).substring(0, 100) : undefined
      }
    })

    if (duration > 500) { // Log slow queries (over 500ms)
      logger.warn('Slow database query detected', {
        query: query.substring(0, 200),
        duration: `${duration}ms`,
        params
      })
    }
  }
}

/**
 * API request performance monitoring
 */
export function monitorApiPerformance(req: any, res: any, next: any) {
  const startTime = globalThis.performance.now()
  const originalEnd = res.end

  res.end = function(...args: any[]) {
    const duration = globalThis.performance.now() - startTime
    performance.recordMetric({
      name: 'api_request',
      duration,
      timestamp: new Date(),
      metadata: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent')
      }
    })

    originalEnd.apply(res, args)
  }

  next()
}

export default performance
