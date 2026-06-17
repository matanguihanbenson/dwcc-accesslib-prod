'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { notify } from '@/lib/notification'

interface EntryLog {
  entry_id: number
  entry_time: string
  exit_time?: string | null
  purpose?: string | null
  rfid_code?: string | null
  user: {
    user_id: number
    account_id: string
    full_name: string
    user_type: string
    department_ref?: {
      name: string
      code: string
    }
    program?: {
      name: string
      code: string
    }
  }
  verified_by?: number | null
  created_at: string
}

export default function EntryLogsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const userId = searchParams.get('user')
  
  const [logs, setLogs] = useState<EntryLog[]>([])
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [totalLogs, setTotalLogs] = useState(0)
  const [userInfo, setUserInfo] = useState<{ full_name: string; account_id: string } | null>(null)

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') {
        return
      }

      if (status === 'authenticated' && session?.user) {
        if (!['ADMIN', 'STAFF'].includes(session.user.role)) {
          console.warn('Access denied: User does not have required privileges')
          router.push('/dashboard')
          return
        }
        console.log('NextAuth session ready for entry logs')
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
            const userData = await response.json()
            if (!['ADMIN', 'STAFF'].includes(userData.role)) {
              console.warn('Access denied: User does not have required privileges')
              router.push('/dashboard')
              return
            }
            console.log('JWT token authentication ready for entry logs')
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

  useEffect(() => {
    if (authReady) {
      fetchLogs()
      if (userId) {
        fetchUserInfo()
      }
    }
  }, [authReady, currentPage, itemsPerPage, searchTerm, statusFilter, dateFilter, userId])

  const fetchUserInfo = async () => {
    try {
      const response = await fetch(`/api/library-users/${userId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const result = await response.json()
        setUserInfo({
          full_name: result.data.full_name,
          account_id: result.data.account_id
        })
      }
    } catch (error) {
      console.error('Error fetching user info:', error)
    }
  }

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        include_user: 'true', // Always include user data
        ...(searchTerm && { query: searchTerm }),
        ...(statusFilter && { status: statusFilter }),
        ...(dateFilter && { date: dateFilter }),
        ...(userId && { user_id: userId })
      })

      const response = await fetch(`/api/entry-logs?${params}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const result = await response.json()
        
        // Handle the API response structure
        if (result.success) {
          // The API returns { data: { logs: [...] } }
          const logsArray = Array.isArray(result.data?.logs) ? result.data.logs : []
          const totalCount = result.pagination?.total || logsArray.length
          
          setLogs(logsArray)
          setTotalLogs(totalCount)
        } else {
          console.warn('API response indicates failure:', result)
          setLogs([])
          setTotalLogs(0)
        }
      } else {
        const errorData = await response.text()
        console.error('Failed to fetch entry logs:', response.status, errorData)
        await notify.error('Error', 'Failed to fetch entry logs')
      }
    } catch (error) {
      console.error('Error fetching entry logs:', error)
      await notify.error('Error', 'Network error occurred while fetching entry logs')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (exitTime?: string | null) => {
    return exitTime 
      ? 'bg-gray-100 text-gray-800' 
      : 'bg-green-100 text-green-800'
  }

  const getStatusIcon = (exitTime?: string | null) => {
    return exitTime 
      ? 'fa-sign-out-alt text-gray-600' 
      : 'fa-sign-in-alt text-green-600'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const totalPages = Math.ceil(totalLogs / itemsPerPage)

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {userId && userInfo ? `${userInfo.full_name}'s Entry Logs` : 'Entry Logs'}
              </h1>
              <p className="mt-1 text-gray-600">
                {userId && userInfo 
                  ? `All entry and exit logs for ${userInfo.account_id}`
                  : 'View all library entry and exit logs'
                }
              </p>
            </div>
            <Button 
              variant="outline"
              onClick={() => router.back()}
            >
              <i className="fas fa-arrow-left mr-2"></i>
              Back
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <Input
                  type="text"
                  placeholder="Search by name, ID number, or purpose..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Status</option>
                  <option value="inside">Currently Inside</option>
                  <option value="exited">Exited</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Per Page</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Entry Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Entry Logs ({totalLogs} total)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading entry logs...</p>
              </div>
            ) : !Array.isArray(logs) || logs.length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-door-open text-4xl text-gray-300 mb-4"></i>
                <p className="text-gray-500">No entry logs found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Entry ID
                      </th>
                      {!userId && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Entry Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Exit Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Purpose
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr key={log.entry_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              #{log.entry_id}
                            </div>
                            {log.rfid_code && (
                              <div className="text-xs text-gray-500">
                                RFID: {log.rfid_code}
                              </div>
                            )}
                          </div>
                        </td>
                        
                        {!userId && (
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">
                                {log.user.full_name}
                              </div>
                              <div className="text-gray-500">
                                {log.user.account_id}
                              </div>
                              <div className="text-xs text-gray-400">
                                {log.user.user_type}
                                {log.user.department_ref && ` • ${log.user.department_ref.name}`}
                              </div>
                            </div>
                          </td>
                        )}
                        
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(log.entry_time)}
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.exit_time ? formatDate(log.exit_time) : 'Still inside'}
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <i className={`fas ${getStatusIcon(log.exit_time)} mr-2`}></i>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(log.exit_time)}`}>
                              {log.exit_time ? 'Exited' : 'Inside'}
                            </span>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {log.purpose || 'General'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {!loading && totalLogs > 0 && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between bg-white px-4 py-3 rounded-lg border border-gray-200 shadow-sm">
            <div className="text-sm font-medium text-gray-700">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalLogs)} of {totalLogs} logs
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-2"
              >
                <i className="fas fa-chevron-left"></i>
              </Button>

              <div className="flex items-center space-x-1">
                {(() => {
                  const pages = [];
                  const maxPagesToShow = 7;
                  
                  if (totalPages <= maxPagesToShow) {
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(
                        <Button
                          key={i}
                          variant={currentPage === i ? "default" : "outline"}
                          onClick={() => setCurrentPage(i)}
                          className="px-3 py-2"
                        >
                          {i}
                        </Button>
                      );
                    }
                  } else {
                    pages.push(
                      <Button
                        key={1}
                        variant={currentPage === 1 ? "default" : "outline"}
                        onClick={() => setCurrentPage(1)}
                        className="px-3 py-2"
                      >
                        1
                      </Button>
                    );

                    if (currentPage > 3) {
                      pages.push(
                        <span key="ellipsis-start" className="px-2 text-gray-500">
                          ...
                        </span>
                      );
                    }

                    const startPage = Math.max(2, currentPage - 1);
                    const endPage = Math.min(totalPages - 1, currentPage + 1);

                    for (let i = startPage; i <= endPage; i++) {
                      pages.push(
                        <Button
                          key={i}
                          variant={currentPage === i ? "default" : "outline"}
                          onClick={() => setCurrentPage(i)}
                          className="px-3 py-2"
                        >
                          {i}
                        </Button>
                      );
                    }

                    if (currentPage < totalPages - 2) {
                      pages.push(
                        <span key="ellipsis-end" className="px-2 text-gray-500">
                          ...
                        </span>
                      );
                    }

                    pages.push(
                      <Button
                        key={totalPages}
                          variant={currentPage === totalPages ? "default" : "outline"}
                        onClick={() => setCurrentPage(totalPages)}
                        className="px-3 py-2"
                      >
                        {totalPages}
                      </Button>
                    );
                  }

                  return pages;
                })()}
              </div>

              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-2"
              >
                <i className="fas fa-chevron-right"></i>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
