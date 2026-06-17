import { NextRequest, NextResponse } from 'next/server'
import { performance } from '@/lib/performance'

export async function performanceMiddleware(
  request: NextRequest,
  next: () => Promise<NextResponse>
) {
  const startTime = Date.now()
  const url = new URL(request.url)
  
  try {
    const response = await next()
    const duration = Date.now() - startTime
    
    // Record performance metrics
    performance.recordMetric({
      name: 'api_request',
      duration,
      timestamp: new Date(),
      metadata: {
        method: request.method,
        path: url.pathname,
        statusCode: response.status,
        userAgent: request.headers.get('user-agent')?.substring(0, 100)
      }
    })
    
    // Add performance headers
    response.headers.set('X-Response-Time', `${duration}ms`)
    response.headers.set('X-Timestamp', new Date().toISOString())
    
    // Log slow requests
    if (duration > 2000) {
      console.warn(`Slow API request detected: ${request.method} ${url.pathname} took ${duration}ms`)
    }
    
    return response
  } catch (error) {
    const duration = Date.now() - startTime
    
    // Record error metrics
    performance.recordMetric({
      name: 'api_error',
      duration,
      timestamp: new Date(),
      metadata: {
        method: request.method,
        path: url.pathname,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })
    
    console.error(`API request failed: ${request.method} ${url.pathname} after ${duration}ms`, error)
    throw error
  }
}

// Performance monitoring hook for API routes
export function withPerformanceTracking(handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>) {
  return async (req: NextRequest, ...args: any[]) => {
    return performanceMiddleware(req, () => handler(req, ...args))
  }
}
