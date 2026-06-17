'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui'
import { useApiSWR, useApi } from '@/lib/hooks/useApi'
import { useCacheManager } from '@/lib/hooks/useCacheManager'
import { notify } from '@/lib/notification'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'


interface ActivityLog {
  id: number
  user_id: number
  action: string
  ip_address?: string
  user_agent?: string
  details?: string
  created_at: string
  user?: {
    full_name: string
    account_id: string
    role: string
    user_type: string
    email?: string
    status?: string
  }
}

export default function ActivityLogsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [authReady, setAuthReady] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf' | 'excel'>('csv')
  const [showExportDropdown, setShowExportDropdown] = useState(false)
  const [exportAction, setExportAction] = useState('')
  const [exportRole, setExportRole] = useState('')
  const [exportDateRange, setExportDateRange] = useState({ start: '', end: '' })
  const [exportDatePreset, setExportDatePreset] = useState('')
  const [uniqueActions, setUniqueActions] = useState<string[]>([])

  // Cache management
  const { invalidateUserData } = useCacheManager()

  // Build API endpoint with filters
  const apiEndpoint = React.useMemo(() => {
    if (!authReady) return null
    
    const params = new URLSearchParams()
    if (searchTerm) params.append('search', searchTerm)
    if (actionFilter) params.append('action', actionFilter)
    if (roleFilter) params.append('role', roleFilter)
    if (dateRange.start) params.append('dateFrom', dateRange.start)
    if (dateRange.end) params.append('dateTo', dateRange.end)
    params.append('page', currentPage.toString())
    params.append('limit', itemsPerPage.toString())
    
    return `/api/activity-logs?${params.toString()}`
  }, [authReady, searchTerm, actionFilter, roleFilter, dateRange.start, dateRange.end, currentPage, itemsPerPage])

  // SWR for activity logs data
  const { 
    data: logsResponse, 
    error, 
    isLoading, 
    mutate: refreshLogs 
  } = useApiSWR<{ logs: ActivityLog[]; total?: number; pagination?: { total?: number; page?: number; limit?: number } }>(apiEndpoint)

  const logs = logsResponse?.logs || []
  // Get total from API pagination - this is the TOTAL count across all pages
  const totalLogsFromAPI = logsResponse?.pagination?.total || logs.length

  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') {
        return
      }

      if (status === 'authenticated' && session?.user) {
        console.log('NextAuth session ready for activity logs')
        setAuthReady(true)
      } else {
        try {
          const response = await fetch('/api/users/profile', {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          })
          
          if (response.ok) {
            console.log('JWT token authentication ready for activity logs')
            setAuthReady(true)
          } else {
            console.warn('No valid authentication found, redirecting to login')
            router.push('/login')
            return
          }
        } catch (error) {
          console.warn('Auth check failed, redirecting to login:', error)
          router.push('/login')
          return
        }
      }
    }

    checkAuth()
  }, [session, status, router])

  const handleRefresh = () => {
    refreshLogs()
    notify.info('Refreshing', 'Updating activity logs...')
  }

  useEffect(() => {
    if (authReady) {
      refreshLogs()
      // Fetch unique actions
      fetch('/api/activity-logs/actions', {
        credentials: 'include'
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.actions) {
            setUniqueActions(data.actions)
          }
        })
        .catch(err => console.error('Failed to fetch unique actions:', err))
    }
  }, [authReady, refreshLogs])

  // Since API does server-side pagination, we use the logs directly
  // No need for client-side filtering/slicing - API already handles this
  const currentLogs = logs
  
  // Calculate total pages based on API's total count
  const totalPages = Math.ceil(totalLogsFromAPI / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, totalLogsFromAPI)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, actionFilter, roleFilter, dateRange])

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'login':
        return <i className="fas fa-sign-in-alt text-green-600"></i>
      case 'logout':
        return <i className="fas fa-sign-out-alt text-red-600"></i>
      case 'login_failed':
        return <i className="fas fa-exclamation-triangle text-red-500"></i>
      case 'user_create':
        return <i className="fas fa-user-plus text-green-600"></i>
      case 'user_update':
        return <i className="fas fa-user-edit text-blue-600"></i>
      case 'user_delete':
        return <i className="fas fa-user-times text-red-600"></i>
      case 'user_activate':
        return <i className="fas fa-user-check text-green-600"></i>
      case 'user_deactivate':
        return <i className="fas fa-user-slash text-red-600"></i>
      case 'profile_update':
        return <i className="fas fa-user-edit text-blue-600"></i>
      case 'password_change':
      case 'password_reset':
        return <i className="fas fa-key text-purple-600"></i>
      case 'status_change':
        return <i className="fas fa-toggle-on text-orange-600"></i>
      case 'book_add':
        return <i className="fas fa-book-medical text-green-600"></i>
      case 'book_update':
        return <i className="fas fa-book text-blue-600"></i>
      case 'book_delete':
        return <i className="fas fa-book-dead text-red-600"></i>
      case 'book_borrow':
        return <i className="fas fa-hand-holding text-indigo-600"></i>
      case 'book_return':
        return <i className="fas fa-undo text-green-600"></i>
      case 'system_config':
        return <i className="fas fa-cogs text-gray-600"></i>
      case 'backup_create':
        return <i className="fas fa-download text-blue-600"></i>
      case 'backup_restore':
        return <i className="fas fa-upload text-green-600"></i>
      case 'maintenance':
        return <i className="fas fa-tools text-orange-600"></i>
      default:
        return <i className="fas fa-info-circle text-gray-600"></i>
    }
  }

  const getActionBadgeColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'login':
        return 'bg-green-100 text-green-800'
      case 'logout':
        return 'bg-red-100 text-red-800'
      case 'user_create':
      case 'profile_update':
        return 'bg-blue-100 text-blue-800'
      case 'password_reset':
        return 'bg-purple-100 text-purple-800'
      case 'status_change':
        return 'bg-orange-100 text-orange-800'
      case 'book_add':
      case 'book_update':
      case 'book_delete':
        return 'bg-indigo-100 text-indigo-800'
      case 'system_config':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  const exportLogs = async (format: 'csv' | 'pdf' | 'excel') => {
    try {
      setIsExporting(true)
      const params = new URLSearchParams()
      // Use action parameter for filtering
      if (exportAction) params.append('action', exportAction)
      // Only privileged roles can filter by role
      const role = session?.user?.role as string | undefined
      const canFilterRole = role === 'ADMIN' || role === 'SUPER_ADMIN'
      if (canFilterRole && exportRole) params.append('role', exportRole)
      if (exportDateRange.start) params.append('dateFrom', exportDateRange.start)
      if (exportDateRange.end) params.append('dateTo', exportDateRange.end)
      // Request a high limit to include all filtered rows
      params.append('page', '1')
      params.append('limit', '10000')

      const response = await fetch(`/api/activity-logs?${params.toString()}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        console.error('Failed to fetch logs for export', response.status)
        return
      }

      const data = await response.json()
      const rows: ActivityLog[] = data.logs || data.data || []
      const timestamp = new Date().toISOString().split('T')[0]
      const dateRangeLabel = getDateRangeLabel(exportDateRange.start, exportDateRange.end)
      
      if (format === 'csv') {
        const headerLines = [
          'Divine Word College of Calapan Inc.',
          'College Library',
          'Activity Logs',
          `Date Range: ${dateRangeLabel}`,
          `Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}`,
          '',
        ]
        const headers = ['Date/Time', 'User', 'ID Number', 'Role', 'Action', 'Details', 'IP Address']
        const csvContent = [
          ...headerLines,
          headers.join(','),
          ...rows.map(log => [
            formatDateTime(log.created_at),
            `"${log.user?.full_name || 'Unknown'}"`,
            log.user?.account_id || 'N/A',
            log.user?.role || 'Unknown',
            log.action,
            `"${log.details || 'No details'}"`,
            log.ip_address || 'N/A'
          ].join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `activity_logs_${timestamp}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else if (format === 'excel') {
        const worksheetData = [
          ['Divine Word College of Calapan, Inc.'],
          ['College Library'],
          ['Activity Logs'],
          [`Date Range: ${dateRangeLabel}`],
          [`Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}`],
          [],
          ['Date/Time', 'User', 'ID Number', 'Role', 'Action', 'Details', 'IP Address'],
          ...rows.map(log => [
            formatDateTime(log.created_at),
            log.user?.full_name || 'Unknown',
            log.user?.account_id || 'N/A',
            log.user?.role || 'Unknown',
            log.action,
            log.details || 'No details',
            log.ip_address || 'N/A'
          ])
        ]

        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
        
        // Merge cells for header
        worksheet['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // Divine Word College
          { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }, // College Library
          { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } }, // Activity Logs
          { s: { r: 3, c: 0 }, e: { r: 3, c: 6 } }, // Date Range
          { s: { r: 4, c: 0 }, e: { r: 4, c: 6 } }, // Generated
        ]

        // Style header cells
        const headerStyle = { alignment: { horizontal: 'center' }, font: { bold: true } }
        worksheet['A1'].s = { ...headerStyle, font: { bold: true, sz: 16 } }
        worksheet['A2'].s = { ...headerStyle, font: { bold: true, sz: 14 } }
        worksheet['A3'].s = { ...headerStyle, font: { bold: true, sz: 12 } }
        worksheet['A4'].s = { alignment: { horizontal: 'center' } }
        worksheet['A5'].s = { alignment: { horizontal: 'center' } }
        
        worksheet['!cols'] = [
          { width: 20 },
          { width: 25 },
          { width: 15 },
          { width: 12 },
          { width: 20 },
          { width: 40 },
          { width: 15 }
        ]

        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Activity Logs')
        XLSX.writeFile(workbook, `activity_logs_${timestamp}.xlsx`)
      } else if (format === 'pdf') {
        const doc = new jsPDF('p', 'mm', 'a4')
        const pageWidth = doc.internal.pageSize.getWidth()
        
        // Compact header (no logo) with space for fastening
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('Divine Word College of Calapan, Inc.', pageWidth / 2, 18, { align: 'center' })
        
        doc.setFontSize(11)
        doc.text('College Library', pageWidth / 2, 24, { align: 'center' })
        
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text('Activity Logs', pageWidth / 2, 30, { align: 'center' })
        
        // Date range and generated info
        doc.setFontSize(9)
        doc.text(`Date Range: ${dateRangeLabel}`, pageWidth / 2, 36, { align: 'center' })
        doc.text(`Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}`, pageWidth / 2, 42, { align: 'center' })
        
        // Add a line separator
        doc.setDrawColor(200, 200, 200)
        doc.line(14, 48, pageWidth - 14, 48)
        
        const tableData = rows.map(log => [
          formatDateTime(log.created_at),
          log.user?.full_name || 'Unknown',
          log.user?.account_id || 'N/A',
          log.user?.role || 'Unknown',
          log.action,
          log.details || 'No details',
        ])

        autoTable(doc, {
          startY: 52,
          head: [['Date/Time', 'User', 'ID Number', 'Role', 'Action', 'Details']],
          body: tableData,
          styles: { fontSize: 7, cellPadding: 1.2, overflow: 'linebreak' },
          headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          // Generous top margin on first page; smaller on subsequent pages
          margin: { top: 52, left: 12, right: 12 },
          didDrawPage: (data) => {
            if (data.pageNumber > 1) {
              // Reduce top margin for pages after the first
              data.settings.margin.top = 20
            }
          },
          columnStyles: {
            0: { cellWidth: 24 },              // Date/Time
            1: { cellWidth: 32 },              // User
            2: { cellWidth: 20 },              // ID Number
            3: { cellWidth: 18 },              // Role
            4: { cellWidth: 24 },              // Action
            5: { cellWidth: 54 },              // Details
          },
        })

        // Add footer with page numbers
        const pageCount = (doc as any).internal.getNumberOfPages()
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i)
          doc.setFontSize(8)
          doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' })
        }

        doc.save(`activity_logs_${timestamp}.pdf`)
      }
      
      setIsExportModalOpen(false)
      await notify.success('Success', `Activity logs exported as ${format.toUpperCase()}`)
    } catch (e) {
      console.error('Export error', e)
      await notify.error('Error', 'Failed to export activity logs')
    } finally {
      setIsExporting(false)
    }
  }

  const openLogModal = (log: ActivityLog) => {
    setSelectedLog(log)
    setShowModal(true)
  }

  // Helper function to get date range label
  const getDateRangeLabel = (start: string, end: string) => {
    const today = new Date()

    if (!start && !end) return 'All Time'

    // Check for today
    const todayStr = today.toISOString().split('T')[0]
    if (start === todayStr && (!end || end === todayStr)) {
      return `Today (${new Date(start).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })})`
    }

    // Check for this week
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay())
    const weekStartStr = weekStart.toISOString().split('T')[0]
    if (start === weekStartStr && !end) {
      return 'This Week'
    }

    // Check for this month
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const monthStartStr = monthStart.toISOString().split('T')[0]
    if (start === monthStartStr && !end) {
      return `${today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
    }

    // Check for this year
    const yearStart = new Date(today.getFullYear(), 0, 1)
    const yearStartStr = yearStart.toISOString().split('T')[0]
    if (start === yearStartStr && !end) {
      return `${today.getFullYear()}`
    }

    // Custom range
    if (start && end) {
      return `${new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    }
    if (start) {
      return `From ${new Date(start).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
    }
    if (end) {
      return `Until ${new Date(end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
    }

    return 'All Time'
  }

  const closeLogModal = () => {
    setSelectedLog(null)
    setShowModal(false)
  }

  if (!authReady) {
    return (
      <div className="px-6 py-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Checking authentication...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-800">
              Activity Logs
            </h1>
            <div className="relative">
              <button 
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
              >
                <i className="fas fa-download"></i>
                Export
                <i className="fas fa-chevron-down text-xs"></i>
              </button>
              
              {showExportDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setExportFormat('csv')
                        setShowExportDropdown(false)
                        setIsExportModalOpen(true)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <i className="fas fa-file-csv text-green-600"></i>
                      Export as CSV
                    </button>
                    <button
                      onClick={() => {
                        setExportFormat('excel')
                        setShowExportDropdown(false)
                        setIsExportModalOpen(true)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <i className="fas fa-file-excel text-green-700"></i>
                      Export as Excel
                    </button>
                    <button
                      onClick={() => {
                        setExportFormat('pdf')
                        setShowExportDropdown(false)
                        setIsExportModalOpen(true)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <i className="fas fa-file-pdf text-red-600"></i>
                      Export as PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Action Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Actions</option>
                  {uniqueActions.map(action => (
                    <option key={action} value={action}>
                      {action.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Role Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User Role</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Roles</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="ADMIN">Admin</option>
                  <option value="STAFF">Staff</option>
                  <option value="USER">User</option>
                </select>
              </div>

              {/* Items per page */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Per Page</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                  <option value={200}>200 per page</option>
                </select>
              </div>
            </div>

            {/* Search */}
            <div className="lg:w-80">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search by user name, ID number, action..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Date Range Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Activity Logs Table */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="text-gray-500">Loading activity logs...</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Activity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        {searchTerm || actionFilter || roleFilter ? 'No activity logs found matching your filters.' : 'No activity logs found.'}
                      </td>
                    </tr>
                  ) : (
                    currentLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center">
                                <span className="text-sm font-medium text-white">
                                  {log.user?.full_name ? log.user.full_name.charAt(0).toUpperCase() : '?'}
                                </span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {log.user?.full_name || 'Unknown User'}
                              </div>
                              <div className="text-sm text-gray-500">
                                {log.user?.account_id || 'N/A'} • {log.user?.role || 'Unknown'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="mr-3">
                              {getActionIcon(log.action)}
                            </div>
                            <div>
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionBadgeColor(log.action)}`}>
                                {log.action.replace(/_/g, ' ')}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDateTime(log.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.ip_address || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <button
                            onClick={() => openLogModal(log)}
                            className="text-indigo-600 hover:text-indigo-900 transition-colors"
                            title="View Details"
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination - Always visible when there are logs */}
        {!isLoading && logs.length > 0 && (
          <div className="mt-4 flex items-center justify-between bg-white px-4 py-3 rounded-lg border border-gray-200 shadow-sm">
            <div className="text-sm font-medium text-gray-700">
              Showing {startIndex + 1} to {endIndex} of {totalLogsFromAPI} activity logs
            </div>
            {totalPages > 1 ? (
              <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="fas fa-chevron-left"></i>
              </button>

              <div className="flex items-center space-x-1">
                {(() => {
                  const pages = [];
                  const maxPagesToShow = 7; // Total page numbers to show
                  
                  if (totalPages <= maxPagesToShow) {
                    // Show all pages if total is small
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i)}
                          className={`px-3 py-2 text-sm font-medium border rounded-md ${
                            currentPage === i
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {i}
                        </button>
                      );
                    }
                  } else {
                    // Always show first page
                    pages.push(
                      <button
                        key={1}
                        onClick={() => setCurrentPage(1)}
                        className={`px-3 py-2 text-sm font-medium border rounded-md ${
                          currentPage === 1
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        1
                      </button>
                    );

                    // Show ellipsis if current page is far from start
                    if (currentPage > 3) {
                      pages.push(
                        <span key="ellipsis-start" className="px-2 text-gray-500">
                          ...
                        </span>
                      );
                    }

                    // Show pages around current page
                    const startPage = Math.max(2, currentPage - 1);
                    const endPage = Math.min(totalPages - 1, currentPage + 1);

                    for (let i = startPage; i <= endPage; i++) {
                      pages.push(
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i)}
                          className={`px-3 py-2 text-sm font-medium border rounded-md ${
                            currentPage === i
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {i}
                        </button>
                      );
                    }

                    // Show ellipsis if current page is far from end
                    if (currentPage < totalPages - 2) {
                      pages.push(
                        <span key="ellipsis-end" className="px-2 text-gray-500">
                          ...
                        </span>
                      );
                    }

                    // Always show last page
                    pages.push(
                      <button
                        key={totalPages}
                        onClick={() => setCurrentPage(totalPages)}
                        className={`px-3 py-2 text-sm font-medium border rounded-md ${
                          currentPage === totalPages
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {totalPages}
                      </button>
                    );
                  }

                  return pages;
                })()}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>
            ) : (
              <div className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <span className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md">
                  Page 1 of 1
                </span>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Log Details Modal */}
      {showModal && selectedLog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Activity Log Details
                </h3>
                <button
                  onClick={closeLogModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              {/* Modal Content */}
              <div className="space-y-4">
                {/* User Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">User Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-gray-500">Full Name:</span>
                      <p className="text-sm font-medium">{selectedLog.user?.full_name || 'Unknown'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">ID Number:</span>
                      <p className="text-sm font-medium">{selectedLog.user?.account_id || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Role:</span>
                      <p className="text-sm font-medium">{selectedLog.user?.role || 'Unknown'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">User Type:</span>
                      <p className="text-sm font-medium">{selectedLog.user?.user_type || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Email:</span>
                      <p className="text-sm font-medium">{selectedLog.user?.email || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Status:</span>
                      <p className="text-sm font-medium">{selectedLog.user?.status || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Activity Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Activity Information</h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs text-gray-500">Action:</span>
                      <div className="flex items-center mt-1">
                        <div className="mr-2">
                          {getActionIcon(selectedLog.action)}
                        </div>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionBadgeColor(selectedLog.action)}`}>
                          {selectedLog.action.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Details:</span>
                      <p className="text-sm mt-1 bg-white p-3 rounded border">
                        {selectedLog.details || 'No additional details available'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Technical Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Technical Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-gray-500">Date & Time:</span>
                      <p className="text-sm font-medium">{formatDateTime(selectedLog.created_at)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">IP Address:</span>
                      <p className="text-sm font-medium">{selectedLog.ip_address || 'N/A'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-xs text-gray-500">User Agent:</span>
                      <p className="text-sm font-medium break-all">{selectedLog.user_agent || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end mt-6">
                <button
                  onClick={closeLogModal}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Filters Modal */}
      <Modal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
        title={`Export Activity Logs as ${exportFormat.toUpperCase()}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                <select
                  value={exportAction}
                  onChange={(e) => setExportAction(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Actions</option>
                  {uniqueActions.map(action => (
                    <option key={action} value={action}>
                      {action.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

            {(session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User Role</label>
                <select
                  value={exportRole}
                  onChange={(e) => setExportRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Roles</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="ADMIN">Admin</option>
                  <option value="STAFF">Staff</option>
                  <option value="USER">User</option>
                </select>
              </div>
            )}
          </div>

          {/* Date Range Presets */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quick Date Range</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0]
                  setExportDateRange({ start: today, end: today })
                  setExportDatePreset('today')
                }}
                className={`px-3 py-2 text-sm border rounded-md transition-colors ${
                  exportDatePreset === 'today'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => {
                  const today = new Date()
                  const weekStart = new Date(today)
                  weekStart.setDate(today.getDate() - today.getDay())
                  setExportDateRange({ start: weekStart.toISOString().split('T')[0], end: '' })
                  setExportDatePreset('week')
                }}
                className={`px-3 py-2 text-sm border rounded-md transition-colors ${
                  exportDatePreset === 'week'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => {
                  const today = new Date()
                  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
                  setExportDateRange({ start: monthStart.toISOString().split('T')[0], end: '' })
                  setExportDatePreset('month')
                }}
                className={`px-3 py-2 text-sm border rounded-md transition-colors ${
                  exportDatePreset === 'month'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => {
                  const today = new Date()
                  const yearStart = new Date(today.getFullYear(), 0, 1)
                  setExportDateRange({ start: yearStart.toISOString().split('T')[0], end: '' })
                  setExportDatePreset('year')
                }}
                className={`px-3 py-2 text-sm border rounded-md transition-colors ${
                  exportDatePreset === 'year'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                This Year
              </button>
            </div>
          </div>

          {/* Custom Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Custom Date Range</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={exportDateRange.start}
                  onChange={(e) => {
                    setExportDateRange(prev => ({ ...prev, start: e.target.value }))
                    setExportDatePreset('')
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={exportDateRange.end}
                  onChange={(e) => {
                    setExportDateRange(prev => ({ ...prev, end: e.target.value }))
                    setExportDatePreset('')
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">Leave end date empty to include all logs from start date to present</p>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              onClick={() => setIsExportModalOpen(false)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={isExporting}
            >
              Cancel
            </button>
            <button
              onClick={() => exportLogs(exportFormat)}
              className={`px-4 py-2 text-sm rounded-md text-white ${isExporting ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'}`}
              disabled={isExporting}
            >
              {isExporting ? 'Exporting...' : `Export ${exportFormat.toUpperCase()}`}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
