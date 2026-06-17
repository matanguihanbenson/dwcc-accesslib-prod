import { useState, useEffect, useCallback } from 'react'
import { useApiSWR } from './useApi'

interface Notification {
  notification_id: number
  type: string
  title: string
  message: string
  created_at: string
  read_at: string | null
  metadata?: any
}

interface UseNotificationsReturn {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  fetchNotifications: () => void
  markAsRead: (notificationIds: number[]) => Promise<void>
  markAllAsRead: () => Promise<void>
}

export function useNotifications(pollingInterval = 5000): UseNotificationsReturn {
  // Use SWR for real-time notifications
  const { 
    data: notificationsData, 
    error, 
    isLoading,
    mutate: refreshNotifications 
  } = useApiSWR<{ notifications: Notification[], unreadCount: number }>(
    '/api/notifications?limit=10',
    {
      refreshInterval: pollingInterval, // Much faster refresh for real-time notifications
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 1000,
    }
  )

  const notifications = notificationsData?.notifications || []
  const unreadCount = notificationsData?.unreadCount || 0
  const loading = isLoading

  const markAsRead = useCallback(async (notificationIds: number[]) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ notificationIds })
      })
      
      if (response.ok) {
        // Refresh notifications to get updated state
        refreshNotifications()
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error)
    }
  }, [refreshNotifications])

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ markAllAsRead: true })
      })
      
      if (response.ok) {
        // Refresh notifications to get updated state
        refreshNotifications()
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }, [refreshNotifications])

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications: refreshNotifications,
    markAsRead,
    markAllAsRead
  }
}
