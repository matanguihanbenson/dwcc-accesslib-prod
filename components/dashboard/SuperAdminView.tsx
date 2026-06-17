'use client'

import React, { useState, useEffect } from 'react'

interface UserStats {
  totalAdmins: number
  totalStaff: number
  totalUsers: number
  recentRegistrations: number
}

interface SystemLog {
  id: number
  action: string
  user: string
  timestamp: string
  details: string
  type: 'login' | 'logout' | 'registration' | 'modification' | 'error'
}

interface SuperAdminViewProps {
  className?: string
}

function SuperAdminView({ className }: SuperAdminViewProps) {
  const [userStats, setUserStats] = useState<UserStats>({
    totalAdmins: 0,
    totalStaff: 0,
    totalUsers: 0,
    recentRegistrations: 0
  })
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUserStats()
    fetchSystemLogs()
  }, [])

  const fetchUserStats = async () => {
    try {
      const response = await fetch('/api/admin/user-stats')
      if (response.ok) {
        const stats = await response.json()
        setUserStats(stats)
      }
    } catch (error) {
      console.error('Error fetching user stats:', error)
    }
  }

  const fetchSystemLogs = async () => {
    try {
      const response = await fetch('/api/admin/system-logs?limit=10')
      if (response.ok) {
        const logs = await response.json()
        setSystemLogs(logs)
      }
    } catch (error) {
      console.error('Error fetching system logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getLogTypeIcon = (type: string) => {
    switch (type) {
      case 'login':
        return <i className="fas fa-sign-in-alt text-green-500" />
      case 'logout':
        return <i className="fas fa-sign-out-alt text-blue-500" />
      case 'registration':
        return <i className="fas fa-user-plus text-purple-500" />
      case 'modification':
        return <i className="fas fa-edit text-orange-500" />
      case 'error':
        return <i className="fas fa-exclamation-triangle text-red-500" />
      default:
        return <i className="fas fa-info-circle text-gray-500" />
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading super admin dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`p-4 space-y-4 ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">System Overview</h2>
        <div className="text-xs text-gray-500">
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>

      {/* Quick Actions for Super Admin */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-xs font-medium transition-colors flex items-center gap-1">
            <i className="fas fa-user-friends text-xs" />
            Manage Library Users
          </button>
          <button className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded text-xs font-medium transition-colors flex items-center gap-1">
            <i className="fas fa-user-shield text-xs" />
            Manage Administrators
          </button>
          <button className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-xs font-medium transition-colors flex items-center gap-1">
            <i className="fas fa-plus text-xs" />
            Create Admin
          </button>
          <button className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded text-xs font-medium transition-colors flex items-center gap-1">
            <i className="fas fa-file-alt text-xs" />
            Full Logs
          </button>
          <button className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-xs font-medium transition-colors flex items-center gap-1">
            <i className="fas fa-database text-xs" />
            Backup System
          </button>
        </div>
      </div>

      {/* User Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Admins</p>
              <p className="text-2xl font-bold text-blue-600">{userStats.totalAdmins}</p>
            </div>
            <i className="fas fa-user-shield text-blue-500 text-2xl" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Staff</p>
              <p className="text-2xl font-bold text-green-600">{userStats.totalStaff}</p>
            </div>
            <i className="fas fa-users text-green-500 text-2xl" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-purple-600">{userStats.totalUsers}</p>
            </div>
            <i className="fas fa-user text-purple-500 text-2xl" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Recent Registrations</p>
              <p className="text-2xl font-bold text-orange-600">{userStats.recentRegistrations}</p>
              <p className="text-xs text-gray-500">Last 7 days</p>
            </div>
            <i className="fas fa-user-plus text-orange-500 text-2xl" />
          </div>
        </div>
      </div>

      {/* System Logs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Recent System Activity</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {systemLogs.length > 0 ? (
            systemLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {getLogTypeIcon(log.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        {log.action}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatTimestamp(log.timestamp)}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      User: {log.user}
                    </p>
                    {log.details && (
                      <p className="text-xs text-gray-500 mt-1">
                        {log.details}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-gray-500">
              No recent system activity found.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SuperAdminView
