'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface RealTimeStatusProps {
  isLoading?: boolean
  error?: any
  lastUpdated?: Date
  onRefresh?: () => void
  className?: string
}

export function RealTimeStatus({ 
  isLoading, 
  error, 
  lastUpdated, 
  onRefresh, 
  className = '' 
}: RealTimeStatusProps) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  return (
    <div className={`flex items-center space-x-2 text-sm ${className}`}>
      {isLoading && (
        <Badge variant="outline" className="animate-pulse">
          <i className="fas fa-sync-alt fa-spin mr-1" />
          Updating...
        </Badge>
      )}
      
      {error && (
        <Badge variant="error">
          <i className="fas fa-exclamation-triangle mr-1" />
          Error
        </Badge>
      )}
      
      {!isLoading && !error && (
        <Badge variant="success">
          <i className="fas fa-check-circle mr-1" />
          Live
        </Badge>
      )}
      
      {lastUpdated && (
        <span className="text-gray-500">
          Updated {getTimeAgo(lastUpdated)}
        </span>
      )}
      
      {onRefresh && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-6 w-6 p-0"
          title="Refresh data"
        >
          <i className={`fas fa-refresh text-xs ${isLoading ? 'fa-spin' : ''}`} />
        </Button>
      )}
    </div>
  )
}
