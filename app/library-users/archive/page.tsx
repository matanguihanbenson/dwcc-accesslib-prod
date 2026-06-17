'use client'

import { useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingScreen } from '@/components/ui/loading-spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Pagination, PaginationControls } from '@/components/ui/pagination'
import { UserRole, LibraryUser, UserType, UserStatus } from '@/types'
import { formatDate } from '@/lib/utils'
import { notify } from '@/lib/notification'
import { useApiSWR, useApi, API_ENDPOINTS } from '@/lib/hooks/useApi'
import { useCacheManager } from '@/lib/hooks/useCacheManager'

export default function LibraryUsersArchivePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [userTypeFilter, setUserTypeFilter] = useState('')
  const [selectedUser, setSelectedUser] = useState<LibraryUser | null>(null)
  const [showUserModal, setShowUserModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [refreshCounter, setRefreshCounter] = useState(0)

  // Cache management
  const { invalidateUserData } = useCacheManager()

  // Build query parameters for SWR key
  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    if (searchQuery) params.append('query', searchQuery)
    if (userTypeFilter) params.append('userType', userTypeFilter)
    return params.toString()
  }, [searchQuery, userTypeFilter])

  // Use SWR for real-time data fetching
  const { 
    data: usersResponse, 
    error, 
    isLoading,
    mutate: refreshUsers 
  } = useApiSWR<{ data: LibraryUser[] }>(
    session ? `${API_ENDPOINTS.LIBRARY_USERS}?${queryParams}&_ts=${refreshCounter}` : null,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 1000,
    }
  )

  // Mutation hook for unarchive
  const { execute: unarchiveUser, loading: unarchiveLoading } = useApi({
    onSuccess: () => {
      notify.success('Success', 'User restored successfully')
      refreshUsers()
      invalidateUserData()
    },
    onError: (error) => {
      notify.error('Error', error || 'Failed to restore user')
    }
  })

  const users = usersResponse?.data || []

  // Handle unarchive user
  const handleUnarchiveUser = async (userId: number, fullName: string) => {
    const confirmed = await notify.confirm(
      'Unarchive User',
      `Are you sure you want to restore ${fullName}? This will make them active again.`
    )

    if (confirmed) {
      await unarchiveUser(`/api/library-users/${userId}/archive`, {
        method: 'PATCH',
        body: JSON.stringify({ archive: false })
      })
    }
  }

  // Client-side filtering - only show archived users
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Only show archived users
      if (user.status !== 'ARCHIVED') return false
      
      const matchesSearch = searchQuery === '' || (
        (user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
        user.account_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.email?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
        (user.department?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
        (user.course?.toLowerCase().includes(searchQuery.toLowerCase()) || false)
      )
      
      const matchesType = !userTypeFilter || user.user_type === userTypeFilter
      
      return matchesSearch && matchesType
    })
  }, [users, searchQuery, userTypeFilter])

  // Pagination calculations
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1)
  }

  const handleCloseUserModal = () => {
    setSelectedUser(null)
    setShowUserModal(false)
  }

  // Manual refresh function
  const handleRefresh = () => {
    refreshUsers()
    setRefreshCounter(c => c + 1)
    notify.info('Refreshing', 'Updating archived users list...')
  }

  if (status === 'loading') {
    return <LoadingScreen />
  }

  if (!session) {
    return null
  }

  const userRole = session.user.role as UserRole

  if (userRole !== UserRole.SUPER_ADMIN) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
        <p className="text-gray-600 mt-2">You don't have permission to view this page.</p>
      </div>
    )
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Archived Library Users</h1>
          <p className="text-gray-600 text-sm">
            View and restore archived users
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            onClick={() => router.push('/library-users')}
          >
            <i className="fas fa-arrow-left mr-2" />
            Back to Users
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Archived Users</CardTitle>
            <div className="flex items-center space-x-3">
              <Input
                placeholder="Search archived users..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-64"
                icon={<i className="fas fa-search" />}
              />
              <select 
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={userTypeFilter}
                onChange={(e) => {
                  setUserTypeFilter(e.target.value)
                  setCurrentPage(1)
                }}
              >
                <option value="">All Types</option>
                <option value="STUDENT">Students</option>
                <option value="EMPLOYEE">Employees</option>
                <option value="ALUMNI">Alumni</option>
                <option value="GUEST">Guests</option>
              </select>
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading && !users.length ? (
            <div className="text-center py-8">
              <LoadingScreen message="Loading archived users..." />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600">Error loading archived users: {error.message}</p>
              <Button onClick={handleRefresh} className="mt-2">
                <i className="fas fa-retry mr-2" />
                Retry
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2">Name</TableHead>
                  <TableHead className="py-2">ID Number</TableHead>
                  <TableHead className="py-2">Type</TableHead>
                  <TableHead className="py-2">Department</TableHead>
                  <TableHead className="py-2">Program</TableHead>
                  <TableHead className="py-2">Email</TableHead>
                  <TableHead className="py-2">Status</TableHead>
                  <TableHead className="py-2">Created</TableHead>
                  <TableHead className="py-2">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!Array.isArray(paginatedUsers) || paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      {!Array.isArray(users) ? 'Loading archived users...' : 
                       (searchQuery || userTypeFilter) ? 'No archived users found matching your filters.' : 
                       'No archived users found.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map((user) => (
                    <TableRow key={user.user_id} className="hover:bg-gray-50">
                      <TableCell className="py-2 font-medium">{user.full_name}</TableCell>
                      <TableCell className="py-2">{user.account_id}</TableCell>
                      <TableCell className="py-2">{getUserTypeBadge(user.user_type)}</TableCell>
                      <TableCell className="py-2">{user.department || '-'}</TableCell>
                      <TableCell className="py-2">{user.course || '-'}</TableCell>
                      <TableCell className="py-2">{user.email || '-'}</TableCell>
                      <TableCell className="py-2">{getStatusBadge(user.status)}</TableCell>
                      <TableCell className="py-2 text-sm">{formatDate(user.created_at)}</TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center space-x-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/library-users/${user.user_id}`)}
                            className="h-7 w-7 p-0"
                            title="View User"
                          >
                            <i className="fas fa-eye text-xs" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnarchiveUser(user.user_id, user.full_name || 'Unknown')}
                            className="h-7 w-7 p-0 text-green-600 hover:text-green-900 border-green-600 hover:bg-green-50"
                            title="Restore User"
                            disabled={unarchiveLoading}
                          >
                            <i className="fas fa-undo text-xs"></i>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!isLoading && filteredUsers.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredUsers.length}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          className="mt-4"
        />
      )}

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">User Details</h3>
              <button
                onClick={handleCloseUserModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <p className="text-sm text-gray-900">{selectedUser.full_name}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">ID Number</label>
                <p className="text-sm text-gray-900">{selectedUser.account_id}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="text-sm text-gray-900">{selectedUser.email || 'N/A'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">User Type</label>
                <p className="text-sm text-gray-900">{selectedUser.user_type}</p>
              </div>
              
              {selectedUser.department && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Department</label>
                  <p className="text-sm text-gray-900">
                    {selectedUser.department}
                  </p>
                </div>
              )}
              
              {selectedUser.course && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Course</label>
                  <p className="text-sm text-gray-900">
                    {selectedUser.course}
                  </p>
                </div>
              )}
              
              {selectedUser.year_level && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Year Level</label>
                  <p className="text-sm text-gray-900">{selectedUser.year_level}</p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <div className="mt-1">
                  {getStatusBadge(selectedUser.status)}
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleCloseUserModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
