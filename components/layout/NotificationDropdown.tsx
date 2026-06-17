'use client'

import { useState, useEffect, useRef } from 'react'
import { Icon } from '@/components/ui/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/lib/hooks/useNotifications'

interface NotificationDropdownProps {
  userId?: string
}

export function NotificationDropdown({ userId }: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  // Use faster polling for real-time notifications (3 seconds instead of default 30)
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications(3000)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'BOOK_OVERDUE':
        return 'fa-book text-red-500'
      case 'LOCKER_OVERDUE':
        return 'fa-lock text-orange-500'
      case 'BOOK_APPROVED':
        return 'fa-check-circle text-green-500'
      case 'BOOK_REJECTED':
        return 'fa-times-circle text-red-500'
      case 'LOCKER_ASSIGNED':
        return 'fa-key text-blue-500'
      case 'SYSTEM_ALERT':
        return 'fa-exclamation-triangle text-yellow-500'
      case 'ACCOUNT_UPDATE':
        return 'fa-user text-blue-500'
      default:
        return 'fa-bell text-gray-500'
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-md hover:bg-gray-100"
      >
        <Icon name="fa-bell" size="md" />
        {unreadCount > 0 && (
          <Badge 
            variant="error" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs p-0 min-w-[20px]"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
          <div className="p-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Mark all read
              </Button>
            )}
          </div>
          
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center">
                <Icon name="fa-bell-slash" size="lg" className="text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.notification_id}
                  className={cn(
                    'p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors',
                    !notification.read_at && 'bg-blue-50'
                  )}
                  onClick={() => {
                    if (!notification.read_at) {
                      markAsRead([notification.notification_id])
                    }
                  }}
                >
                  <div className="flex items-start space-x-3">
                    <Icon 
                      name={getNotificationIcon(notification.type)} 
                      size="sm" 
                      className="mt-1 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm font-medium text-gray-900 truncate',
                        !notification.read_at && 'font-semibold'
                      )}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatTimeAgo(notification.created_at)}
                      </p>
                    </div>
                    {!notification.read_at && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          
          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 text-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-gray-600 hover:text-gray-800"
                onClick={() => {
                  setIsOpen(false)
                  // Navigate to notifications page if you create one
                }}
              >
                View all notifications
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
