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
import { formatDate, formatDateTime } from '@/lib/utils'
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
    copy_id?: number | null
    borrow_date: string | null
    due_date: string | null
    return_date: string | null
    status: string
    created_at: string
    book: {
      title: string
      book_author: string
      book_copies?: Array<{
        copy_id: number
        accession_number: string
      }>
    }
  }[]
  entry_logs?: {
    entry_id: number
    entry_time: string
    exit_time?: string | null
    purpose?: string | null
    campus: 'COLLEGE' | 'BASIC_EDUCATION'
    entrance?: {
      entrance_id: number
      name: string
    } | null
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
      if (
        userRole !== UserRole.SUPER_ADMIN &&
        userRole !== UserRole.ADMIN &&
        userRole !== UserRole.STAFF
      ) {
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

  // Pretty-print a millisecond duration as e.g. "2h 14m"
  // or "47m 03s" or "12s". Used on the entry-logs table
  // so staff can see at a glance how long a visit lasted
  // (or how long the current visit has been running).
  const formatDuration = (ms: number): string => {
    if (!Number.isFinite(ms) || ms < 0) return '-'
    const totalSec = Math.floor(ms / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    const pad = (n: number) => String(n).padStart(2, '0')
    if (h > 0) return `${h}h ${pad(m)}m`
    if (m > 0) return `${m}m ${pad(s)}s`
    return `${s}s`
  }

  // Pick the accession number for a transaction. Prefer
  // the copy that was actually borrowed (`copy_id` set on
  // the transaction); fall back to the first copy of the
  // book for legacy book-level transactions. Returns
  // `null` when the book has no copies (which shouldn't
  // happen for a borrowable book, but we handle it
  // defensively).
  const getTransactionAccession = (tx: NonNullable<LibraryUser['book_transactions']>[number]): string | null => {
    const copies = tx.book?.book_copies
    if (!copies || copies.length === 0) return null
    if (tx.copy_id) {
      const match = copies.find((c) => c.copy_id === tx.copy_id)
      if (match) return match.accession_number
    }
    return copies[0].accession_number
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
              {session?.user?.role === UserRole.SUPER_ADMIN ||
              session?.user?.role === UserRole.ADMIN ||
              session?.user?.role === UserRole.STAFF ? (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/library-users/${userId}/edit`)}
                  className='py-5 px-4 bg-primary-600 text-white hover:bg-primary-700'
                >
                  <i className="fas fa-edit mr-2" />
                  Edit User
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="py-4 space-y-6">
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
                className='py-5 px-4 bg-primary-600 text-white hover:bg-primary-700'
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
                  {user.book_transactions.slice(0, 5).map((transaction) => {
                    const accession = getTransactionAccession(transaction)
                    return (
                      <TableRow key={transaction.transaction_id}>
                        <TableCell className="font-medium">
                          <div className="space-y-1">
                            {/* Accession number sits at the top
                                so the LIBADMIN can scan the
                                column and match it against a
                                shelf sticker without having to
                                look down at the title. */}
                            {accession ? (
                              <div className="inline-flex items-center gap-1.5">
                                <Badge variant="outline" className="font-mono text-xs">
                                  <i className="fas fa-barcode mr-1 text-gray-400"></i>
                                  {accession}
                                </Badge>
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400 italic">no copy</div>
                            )}
                            <div className="font-medium text-gray-900">{transaction.book.title}</div>
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
                            transaction.status === 'OVERDUE' ? 'error' : 'outline'
                          }>
                            {transaction.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(transaction.created_at)}</TableCell>
                      </TableRow>
                    )
                  })}
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
                className='py-5 px-4 bg-primary-600 text-white hover:bg-primary-700'
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
                    <TableHead>Duration</TableHead>
                    <TableHead>Entrance</TableHead>
                    <TableHead>Campus</TableHead>
                    <TableHead>Purpose</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.entry_logs.slice(0, 5).map((log) => {
                    const isInside = !log.exit_time
                    // The "duration" column shows a live
                    // ticker for entries the user hasn't
                    // exited yet and a fixed value for
                    // completed ones. We use `now` from a
                    // tiny local ref so the value refreshes
                    // when the page re-renders, without
                    // needing a per-second interval for a
                    // 5-row list.
                    const end = log.exit_time ? new Date(log.exit_time).getTime() : Date.now()
                    const start = new Date(log.entry_time).getTime()
                    return (
                      <TableRow key={log.entry_id} className={isInside ? 'bg-blue-50/40' : ''}>
                        <TableCell className="whitespace-nowrap text-sm">
                          <div className="font-medium text-gray-900">{formatDateTime(log.entry_time)}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {log.exit_time ? (
                            <div className="text-gray-700">{formatDateTime(log.exit_time)}</div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                              Still inside
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          <span className="font-mono text-gray-800">
                            {formatDuration(end - start)}
                          </span>
                          {isInside && (
                            <span className="ml-1 text-[10px] uppercase tracking-wide text-blue-600 font-semibold">live</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.entrance?.name ? (
                            <span className="inline-flex items-center gap-1 text-gray-800">
                              <i className="fas fa-door-closed text-gray-400 text-xs"></i>
                              {log.entrance.name}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic text-xs">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            log.campus === 'COLLEGE'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            <i className={`fas ${log.campus === 'COLLEGE' ? 'fa-graduation-cap' : 'fa-school'} text-[10px]`}></i>
                            {log.campus === 'COLLEGE' ? 'College' : 'Basic Ed'}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-700">
                          {log.purpose || <span className="text-gray-400 italic text-xs">—</span>}
                        </TableCell>
                      </TableRow>
                    )
                  })}
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
