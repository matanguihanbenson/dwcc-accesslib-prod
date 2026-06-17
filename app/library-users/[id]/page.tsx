'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingScreen } from '@/components/ui/loading-spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { UserRole, UserType, UserStatus } from '@/types'
import { formatDate } from '@/lib/utils'
import { notify } from '@/lib/notification'

interface LibraryUser {
  user_id: number
  account_id: string
  full_name: string
  user_type: UserType
  department_id?: number
  program_id?: number
  year_level?: string
  email?: string
  contact_number?: string
  purpose?: string
  status: UserStatus
  created_at: string
  updated_at: string
  archived_at?: string
  department_ref?: {
    department_id: number
    name: string
    code: string
    is_active: boolean
  }
  program?: {
    program_id: number
    name: string
    code: string
    is_active: boolean
  }
  book_transactions?: {
    transaction_id: number
    book_id: number
    borrow_date: string | null
    due_date: string | null
    return_date: string | null
    status: string
    created_at: string
    book: {
      title: string
      book_author: string
    }
  }[]
  entry_logs?: {
    entry_id: number
    entry_time: string
    exit_time?: string | null
    purpose?: string | null
  }[]
}

export default function LibraryUserViewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const userId = params.id as string

  const [user, setUser] = useState<LibraryUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') {
        return
      }

      if (!session) {
        router.push('/login')
        return
      }

      const userRole = session.user.role as UserRole
      if (userRole !== UserRole.SUPER_ADMIN && userRole !== UserRole.ADMIN) {
        router.push('/dashboard')
        return
      }

      setAuthReady(true)
    }

    checkAuth()
  }, [session, status, router])

  useEffect(() => {
    if (authReady && userId) {
      fetchUser()
    }
  }, [authReady, userId])

  const fetchUser = async () => {
    try {
      setLoading(true)
      
      const response = await fetch(`/api/library-users/${userId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setUser(data.data)
      } else if (response.status === 404) {
        router.push('/library-users')
        return
      } else {
        console.error('Failed to fetch user:', response.status)
        notify.error('Error', 'Failed to fetch user details')
      }
    } catch (error) {
      console.error('Error fetching user:', error)
      notify.error('Error', 'Error fetching user details')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: UserStatus) => {
    const variants = {
      ACTIVE: 'success' as const,
      INACTIVE: 'default' as const,
      ARCHIVED: 'outline' as const,
      SUSPENDED: 'error' as const,
    }
    return <Badge variant={variants[status]}>{status}</Badge>
  }

  const getUserTypeBadge = (userType: UserType) => {
    const colors = {
      STUDENT: 'bg-blue-100 text-blue-800',
      EMPLOYEE: 'bg-green-100 text-green-800',
      ALUMNI: 'bg-purple-100 text-purple-800',
      GUEST: 'bg-gray-100 text-gray-800',
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[userType]}`}>
        {userType}
      </span>
    )
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

  if (loading) {
    return (
      <div className="px-6 py-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Loading user details...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="px-6 py-4">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900">User Not Found</h1>
          <p className="text-gray-600 mt-2">The user you're looking for doesn't exist.</p>
          <Button onClick={() => router.push('/library-users')} className="mt-4">
            Back to Library Users
          </Button>
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
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <i className="fas fa-arrow-left text-lg"></i>
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-800">
                  {user.full_name}
                </h1>
                {/* Breadcrumb */}
                <nav className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                  <span>Library Users</span>
                  <i className="fas fa-chevron-right text-xs"></i>
                  <span className="text-gray-900 font-medium">{user.full_name}</span>
                </nav>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {session?.user?.role === UserRole.SUPER_ADMIN && (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/library-users/${userId}/edit`)}
                >
                  <i className="fas fa-edit mr-2" />
                  Edit User
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4 space-y-6">
        {/* User Details */}
        <Card>
          <CardHeader>
            <CardTitle>User Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                  <span className="text-gray-900 font-medium">{user.full_name}</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID Number
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                  <Badge variant="outline" className="text-sm">
                    {user.account_id}
                  </Badge>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User Type
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                  {getUserTypeBadge(user.user_type)}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                  {getStatusBadge(user.status)}
                </div>
              </div>
              
              {user.department_ref && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department
                  </label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-900">{user.department_ref.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {user.department_ref.code}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
              
              {user.program && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Program
                  </label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-900">{user.program.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {user.program.code}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
              
              {user.year_level && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Year Level
                  </label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                    <span className="text-gray-900">{user.year_level}</span>
                  </div>
                </div>
              )}
              
              {user.email && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                    <span className="text-gray-900">{user.email}</span>
                  </div>
                </div>
              )}
              
              {user.contact_number && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Number
                  </label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                    <span className="text-gray-900">{user.contact_number}</span>
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Created Date
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                  <span className="text-gray-900">{formatDate(user.created_at)}</span>
                </div>
              </div>
              
              {user.purpose && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Purpose
                  </label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                    <span className="text-gray-900">{user.purpose}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Book Transactions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Book Transactions ({user.book_transactions?.length || 0})</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(`/borrowing-transactions?user=${userId}`)}
              >
                <i className="fas fa-external-link-alt mr-2" />
                View All Transactions
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {user.book_transactions && user.book_transactions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Book</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.book_transactions.slice(0, 5).map((transaction) => (
                    <TableRow key={transaction.transaction_id}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-medium">{transaction.book.title}</div>
                          <div className="text-sm text-gray-500">{transaction.book.book_author}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          {transaction.borrow_date && (
                            <div><span className="text-gray-500">Borrowed:</span> {formatDate(transaction.borrow_date)}</div>
                          )}
                          {transaction.due_date && (
                            <div><span className="text-gray-500">Due:</span> {formatDate(transaction.due_date)}</div>
                          )}
                          {transaction.return_date && (
                            <div><span className="text-gray-500">Returned:</span> {formatDate(transaction.return_date)}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          transaction.status === 'ACTIVE' ? 'primary' : 
                          transaction.status === 'COMPLETED' ? 'success' : 
                          transaction.status === 'OVERDUE' ? 'error' :
                          transaction.status === 'PENDING_APPROVAL' ? 'warning' : 'outline'
                        }>
                          {transaction.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(transaction.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No book transactions found for this user.
              </div>
            )}
            {user.book_transactions && user.book_transactions.length > 5 && (
              <div className="text-center mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/borrowing-transactions?user=${userId}`)}
                >
                  View {user.book_transactions.length - 5} more transactions
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Entry Logs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Entry Logs ({user.entry_logs?.length || 0})</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(`/entry-monitoring?user=${userId}`)}
              >
                <i className="fas fa-external-link-alt mr-2" />
                View All Logs
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {user.entry_logs && user.entry_logs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entry Time</TableHead>
                    <TableHead>Exit Time</TableHead>
                    <TableHead>Purpose</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.entry_logs.slice(0, 5).map((log) => (
                    <TableRow key={log.entry_id}>
                      <TableCell>{formatDate(log.entry_time)}</TableCell>
                      <TableCell>{log.exit_time ? formatDate(log.exit_time) : 'Still inside'}</TableCell>
                      <TableCell>{log.purpose || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No entry logs found for this user.
              </div>
            )}
            {user.entry_logs && user.entry_logs.length > 5 && (
              <div className="text-center mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/entry-monitoring?user=${userId}`)}
                >
                  View {user.entry_logs.length - 5} more logs
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
