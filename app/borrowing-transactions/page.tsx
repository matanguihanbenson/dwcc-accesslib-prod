'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useApiSWR, useApi } from '@/lib/hooks/useApi'
import { useCacheManager } from '@/lib/hooks/useCacheManager'
import { notify } from '@/lib/notification'
import { generateTransactionId } from '@/lib/utils'

interface BookTransaction {
  transaction_id: number
  borrow_date: string | null
  return_date: string | null
  due_date: string
  status: string
  penalty: number
  condition_on_borrow: string | null
  condition_on_return: string | null
  notes: string | null
  borrower_representative?: string | null
  copy?: {
    accession_number: string
  } | null
  book: {
    book_id: number
    title: string
    book_author: string
    isbn?: string
    category?: { name: string }
  }
  user?: {
    user_id: number
    account_id: string
    full_name: string
    user_type: string
  } | null
  department?: {
    department_id: number
    name: string
  } | null
  office?: {
    office_id: number
    name: string
  } | null
  requestedBy?: {
    username: string
    role: string
  }
  approvedBy?: {
    username: string
    role: string
  }
  created_at: string
  updated_at: string
}

export default function BorrowingTransactionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const userId = searchParams.get('user') || searchParams.get('user_id') // Handle both parameter names
  
  const [authReady, setAuthReady] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchType, setSearchType] = useState<'all' | 'accession' | 'isbn' | 'title' | 'author' | 'user' | 'account_id'>('all')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [userInfo, setUserInfo] = useState<{ full_name: string; account_id: string } | null>(null)

  // Cache management
  const { invalidateBookData } = useCacheManager()

  // Build API endpoint with filters
  const apiEndpoint = React.useMemo(() => {
    if (!authReady) return null
    
    const params = new URLSearchParams()
    if (searchTerm) params.append('search', searchTerm)
    if (searchType) params.append('searchType', searchType)
    if (statusFilter) params.append('status', statusFilter)
    if (dateFilter) {
      const [year, month, day] = dateFilter.split('-').map(Number)
      if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
        const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0)
        const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999)
        params.append('dateFrom', startOfDay.toISOString())
        params.append('dateTo', endOfDay.toISOString())
      }
    }
    if (userId) params.append('user_id', userId) // Changed from 'user' to 'user_id'
    params.append('page', currentPage.toString())
    params.append('limit', itemsPerPage.toString())
    
    return `/api/borrowing-transactions?${params.toString()}`
  }, [authReady, searchTerm, searchType, statusFilter, dateFilter, userId, currentPage, itemsPerPage])

  /*
  
  */
  const { 
    data: transactionsResponse, 
    error, 
    isLoading, 
    mutate: refreshTransactions 
  } = useApiSWR<any>(apiEndpoint, {
    refreshInterval: 5000, 
    revalidateOnFocus: true,
    revalidateOnReconnect: true
  })
  
  // Handle different response formats from the API
  const transactions = React.useMemo(() => {
    if (!transactionsResponse) return []
    
    // Handle different API response formats
    if (Array.isArray(transactionsResponse)) {
      return transactionsResponse
    }
    
    // Check for nested data structures
    const txns = transactionsResponse.transactions || 
                 transactionsResponse.data?.transactions || 
                 transactionsResponse.data || 
                 []
    
    return Array.isArray(txns) ? txns : []
  }, [transactionsResponse])

  const totalTransactions = React.useMemo(() => {
    if (!transactionsResponse) return transactions.length
    
    return transactionsResponse?.total || 
           transactionsResponse?.data?.total || 
           transactions.length
  }, [transactionsResponse, transactions])

  // Update userInfo when data changes
  React.useEffect(() => {
    const userInfoData = transactionsResponse?.userInfo || transactionsResponse?.data?.userInfo
    if (userInfoData) {
      setUserInfo(userInfoData)
    }
  }, [transactionsResponse])

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
        console.log('NextAuth session ready for borrowing transactions')
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
            console.log('JWT token authentication ready for borrowing transactions')
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

  // Reset to first page when filters change so results stay in range
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, searchType, statusFilter, dateFilter])

  useEffect(() => {
    if (authReady) {
      refreshTransactions()
      if (userId && !userInfo) {
        fetchUserInfo()
      }
    }
  }, [authReady, refreshTransactions, userId, userInfo])

  // Remove the old manual dependencies, SWR handles this automatically

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

  /*
  
  */

  // Handler functions
  const handleRefresh = () => {
    refreshTransactions()
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-blue-100 text-blue-800'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'OVERDUE':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'fa-book-reader text-blue-600'
      case 'COMPLETED':
        return 'fa-check-circle text-green-600'
      case 'OVERDUE':
        return 'fa-exclamation-triangle text-red-600'
      case 'REJECTED':
        return 'fa-times-circle text-gray-600'
      default:
        return 'fa-question-circle text-gray-600'
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const totalPages = Math.ceil(totalTransactions / itemsPerPage)

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
                {userId && userInfo ? `${userInfo.full_name}'s Book Transaction History` : 'Book Transaction History'}
              </h1>
              <p className="mt-1 text-gray-600">
                {userId && userInfo 
                  ? `All book transactions for ${userInfo.account_id}`
                  : 'Book Transaction History'
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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <Input
                  type="text"
                  placeholder={(() => {
                    switch (searchType) {
                      case 'accession': return 'Search by accession number'
                      case 'isbn': return 'Search by ISBN'
                      case 'title': return 'Search by book title'
                      case 'author': return 'Search by author name'
                      case 'user': return 'Search by user name'
                      case 'account_id': return 'Search by account ID'
                      default: return 'Search by title, author, name, account ID, or accession'
                    }
                  })()}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Type</label>
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="accession">Accession No.</option>
                  <option value="isbn">ISBN</option>
                  <option value="title">Title</option>
                  <option value="author">Author</option>
                  <option value="user">User Name</option>
                  <option value="account_id">Account ID</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="OVERDUE">Overdue</option>
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

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Transactions ({totalTransactions} total)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading transactions...</p>
              </div>
            ) : !Array.isArray(transactions) || transactions.length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-book text-4xl text-gray-300 mb-4"></i>
                <p className="text-gray-500">No transactions found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transaction
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Book
                      </th>
                      {!userId && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Borrower
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Dates
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Condition
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(Array.isArray(transactions) ? transactions : []).map((transaction) => (
                      <tr key={transaction.transaction_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900 font-mono">
                              {generateTransactionId(
                                transaction.transaction_id,
                                transaction.borrow_date
                                  ? new Date(transaction.borrow_date)
                                  : transaction.created_at
                                    ? new Date(transaction.created_at)
                                    : undefined
                              )}
                            </div>
                            <div className="text-gray-500">
                              {formatDate(transaction.created_at)}
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            {transaction.copy?.accession_number && (
                              <div className="text-xs text-gray-500">
                                {transaction.copy.accession_number}
                              </div>
                            )}
                            <div className="font-medium text-gray-900 max-w-xs truncate">
                              {transaction.book.title}
                            </div>
                            <div className="text-gray-500">
                              by {transaction.book.book_author}
                            </div>
                            {transaction.book.isbn && (
                              <div className="text-xs text-gray-400">
                                ISBN: {transaction.book.isbn}
                              </div>
                            )}
                          </div>
                        </td>
                        
                        {!userId && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              {transaction.user ? (
                                <>
                                  <div className="font-medium text-gray-900">
                                    {transaction.user.full_name}
                                  </div>
                                  <div className="text-gray-500">
                                    {transaction.user.account_id}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {transaction.user.user_type}
                                  </div>
                                </>
                              ) : transaction.department ? (
                                <>
                                  <div className="font-medium text-gray-900">
                                    {transaction.department.name}
                                  </div>
                                  <div className="text-gray-500 text-xs">
                                    Department
                                  </div>
                                  {transaction.borrower_representative && (
                                    <div className="text-xs text-gray-400">
                                      Rep: {transaction.borrower_representative}
                                    </div>
                                  )}
                                </>
                              ) : transaction.office ? (
                                <>
                                  <div className="font-medium text-gray-900">
                                    {transaction.office.name}
                                  </div>
                                  <div className="text-gray-500 text-xs">
                                    Office
                                  </div>
                                  {transaction.borrower_representative && (
                                    <div className="text-xs text-gray-400">
                                      Rep: {transaction.borrower_representative}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="text-gray-400">N/A</div>
                              )}
                            </div>
                          </td>
                        )}
                        
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="space-y-1">
                            <div>
                              <span className="text-gray-500">Borrow:</span> {formatDate(transaction.borrow_date)}
                            </div>
                            <div>
                              <span className="text-gray-500">Due:</span> {formatDate(transaction.due_date)}
                            </div>
                            {transaction.return_date && (
                              <div>
                                <span className="text-gray-500">Return:</span> {formatDate(transaction.return_date)}
                              </div>
                            )}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <i className={`fas ${getStatusIcon(transaction.status)} mr-2`}></i>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(transaction.status)}`}>
                              {transaction.status.replace('_', ' ')}
                            </span>
                          </div>
                          {transaction.penalty && Number(transaction.penalty) > 0 && (
                            <div className="text-xs text-red-600 mt-1">
                              Penalty: ₱{Number(transaction.penalty).toFixed(2)}
                            </div>
                          )}
                        </td>
                        
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <div className="space-y-1">
                            {transaction.condition_on_borrow && (
                              <div>
                                {transaction.condition_on_borrow}
                              </div>
                            )}
                            {transaction.notes && (
                              <div>
                                <span className="font-medium">Notes:</span> {transaction.notes}
                              </div>
                            )}
                          </div>
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
        {!isLoading && totalTransactions > 0 && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalTransactions)} of {totalTransactions} transactions
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>

              <div className="flex space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNumber;
                  if (totalPages <= 5) {
                    pageNumber = i + 1;
                  } else if (currentPage <= 3) {
                    pageNumber = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNumber = totalPages - 4 + i;
                  } else {
                    pageNumber = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageNumber}
                      variant={currentPage === pageNumber ? "default" : "outline"}
                      onClick={() => setCurrentPage(pageNumber)}
                      className="px-3 py-1"
                    >
                      {pageNumber}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
