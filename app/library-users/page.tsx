'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
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

export default function LibraryUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [userTypeFilter, setUserTypeFilter] = useState('')
  const [selectedUser, setSelectedUser] = useState<LibraryUser | null>(null)
  const [showUserModal, setShowUserModal] = useState(false)
  const [showRfidBindModal, setShowRfidBindModal] = useState(false)
  const [rfidBindUser, setRfidBindUser] = useState<{id: number, name: string, currentRfid: string | null} | null>(null)
  const [rfidInput, setRfidInput] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [refreshCounter, setRefreshCounter] = useState(0)

  // Parse URL filters
  const sectionIdFilter = searchParams.get('section_id')
  const programIdFilter = searchParams.get('program_id')
  const departmentIdFilter = searchParams.get('department_id')
  const officeIdFilter = searchParams.get('office_id')
  const strandIdFilter = searchParams.get('strand_id')
  const gradeLevelIdFilter = searchParams.get('grade_level_id')

  // Cache management
  const { invalidateUserData } = useCacheManager()

  // Build query parameters for SWR key
  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    if (searchQuery) params.append('query', searchQuery)
    if (userTypeFilter) params.append('userType', userTypeFilter)
    if (sectionIdFilter) params.append('section_id', sectionIdFilter)
    if (programIdFilter) params.append('program_id', programIdFilter)
    if (departmentIdFilter) params.append('department_id', departmentIdFilter)
    if (officeIdFilter) params.append('office_id', officeIdFilter)
    if (strandIdFilter) params.append('strand_id', strandIdFilter)
    if (gradeLevelIdFilter) params.append('grade_level_id', gradeLevelIdFilter)
    return params.toString()
  }, [searchQuery, userTypeFilter, sectionIdFilter, programIdFilter, departmentIdFilter, officeIdFilter, strandIdFilter, gradeLevelIdFilter])

  // Use SWR for real-time data fetching
  const { 
    data: usersResponse, 
    error, 
    isLoading,
    mutate: refreshUsers 
  } = useApiSWR<{ data: LibraryUser[] }>(
    session ? `${API_ENDPOINTS.LIBRARY_USERS}?${queryParams}&_ts=${refreshCounter}` : null,
    {
      revalidateOnFocus: true, // Refresh when window gains focus
      revalidateOnReconnect: true, // Refresh when reconnecting
      dedupingInterval: 1000, // Prevent duplicate requests within 1 second
    }
  )

  // Mutation hook for status changes
  const { execute: toggleUserStatus } = useApi({
    onSuccess: (data) => {
      notify.success('Success', data?.message || 'User status updated successfully')
      // Immediately refresh the data after successful mutation
      refreshUsers()
      // Also invalidate related cache patterns
      invalidateUserData()
    },
    onError: (error) => {
      notify.error('Error', error || 'Failed to update user status')
    }
  })

  // Mutation hook for archive
  const { execute: archiveUser, loading: archiveLoading } = useApi({
    onSuccess: () => {
      notify.success('Success', 'User archived successfully')
      refreshUsers()
      invalidateUserData()
    },
    onError: (error) => {
      notify.error('Error', error || 'Failed to archive user')
    }
  })

  const users = usersResponse?.data || []
  // Handle user status toggle with real-time updates
  const handleToggleStatus = async (userId: number, currentStatus: UserStatus) => {
    const action = currentStatus === 'ACTIVE' ? 'deactivate' : 'activate'
    const confirmed = await notify.confirm(
      `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
      `Are you sure you want to ${action} this user?`
    )

    if (confirmed) {
      await toggleUserStatus(`/api/library-users/${userId}/toggle-status`, {
        method: 'PATCH',
      })
    }
  }

  // Handle archive user
  const handleArchiveUser = async (userId: number, fullName: string) => {
    const confirmed = await notify.confirm(
      'Archive User',
      `Are you sure you want to archive ${fullName}? Archived users can be restored from the archive.`
    )

    if (confirmed) {
      await archiveUser(`/api/library-users/${userId}/archive`, {
        method: 'PATCH',
        body: JSON.stringify({ archive: true })
      })
    }
  }

  // RFID Handlers
  const handleOpenRfidBindModal = (userId: number, fullName: string, currentRfid: string | null) => {
    setRfidBindUser({ id: userId, name: fullName, currentRfid })
    setRfidInput('')
    setShowRfidBindModal(true)
  }

  const handleCloseRfidBindModal = () => {
    setShowRfidBindModal(false)
    setRfidBindUser(null)
    setRfidInput('')
  }

  const handleBindRfid = async (userId: number, fullName: string, newRfid: string) => {
    try {
      const response = await fetch(`/api/users/${userId}/bind-rfid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ rfidCode: newRfid.trim() })
      })

      const data = await response.json()

      if (response.ok) {
        await notify.success(
          'RFID Bound Successfully',
          `RFID code has been bound to ${fullName}`
        )
        handleCloseRfidBindModal()
        setTimeout(async () => {
          await refreshUsers()
          invalidateUserData()
        }, 300)
      } else if (response.status === 409) {
        await notify.error(
          'RFID Already Bound',
          data.message || data.error || `This RFID is already assigned to another user. Please use a different RFID.`
        )
      } else {
        await notify.error('Error', data.error || 'Failed to bind RFID')
      }
    } catch (error) {
      console.error('Error binding RFID:', error)
      await notify.error('Error', 'Network error occurred')
    }
  }

  const handleUnbindRfid = async (userId: number, fullName: string) => {
    const confirmed = await notify.confirm(
      'Unbind RFID?',
      `Are you sure you want to remove RFID binding from ${fullName}? This action cannot be undone.`
    )

    if (!confirmed) return

    try {
      const response = await fetch(`/api/users/${userId}/unbind-rfid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        await notify.success(
          'RFID Unbound',
          `RFID has been removed from ${fullName}`
        )
        handleCloseRfidBindModal()
        setTimeout(async () => {
          await refreshUsers()
          invalidateUserData()
        }, 300)
      } else {
        const errorData = await response.json()
        await notify.error('Error', errorData.error || 'Failed to unbind RFID')
      }
    } catch (error) {
      console.error('Error unbinding RFID:', error)
      await notify.error('Error', 'Network error occurred')
    }
  }

  // Client-side filtering and pagination (for better performance with real-time updates)
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Exclude archived users from main view
      if (user.status === 'ARCHIVED') return false
      
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
    notify.info('Refreshing', 'Updating user list...')
  }

  // Remove filter function
  const removeFilter = (filterKey: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(filterKey)
    router.push(`/library-users?${params.toString()}`)
  }

  // Clear all filters
  const clearAllFilters = () => {
    router.push('/library-users')
  }

  // Check if any filters are active
  const hasActiveFilters = sectionIdFilter || programIdFilter || departmentIdFilter || officeIdFilter || strandIdFilter || gradeLevelIdFilter

  if (status === 'loading') {
    return <LoadingScreen />
  }

  if (!session) {
    return null
  }

  const userRole = session.user.role as UserRole

  if (userRole !== UserRole.SUPER_ADMIN && userRole !== UserRole.ADMIN) {
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
          <h1 className="text-2xl font-bold text-gray-900">Library Users</h1>
          <p className="text-gray-600 text-sm">
            Manage students, employees, alumni, and guests
          </p>
        </div>
        {(userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN) && (
          <div className="flex items-center space-x-2">
            {userRole === UserRole.SUPER_ADMIN && (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/library-users/categories')}
                >
                  <i className="fas fa-th-large mr-2" />
                  View Categories
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/library-users/archive')}
                >
                  <i className="fas fa-archive mr-2" />
                  View Archive
                </Button>
              </>
            )}
            <Button onClick={() => router.push('/library-users/add')}>
              <i className="fas fa-plus mr-2" />
              Add User
            </Button>
          </div>
        )}
      </div>

      {/* Filter Chips */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-700">Active Filters:</span>
          {sectionIdFilter && (
            <Badge variant="outline" className="px-3 py-1">
              Section: {sectionIdFilter}
              <button 
                onClick={() => removeFilter('section_id')}
                className="ml-2 hover:text-red-600"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </Badge>
          )}
          {programIdFilter && (
            <Badge variant="outline" className="px-3 py-1">
              Program: {programIdFilter}
              <button 
                onClick={() => removeFilter('program_id')}
                className="ml-2 hover:text-red-600"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </Badge>
          )}
          {departmentIdFilter && (
            <Badge variant="outline" className="px-3 py-1">
              Department: {departmentIdFilter}
              <button 
                onClick={() => removeFilter('department_id')}
                className="ml-2 hover:text-red-600"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </Badge>
          )}
          {officeIdFilter && (
            <Badge variant="outline" className="px-3 py-1">
              Office: {officeIdFilter}
              <button 
                onClick={() => removeFilter('office_id')}
                className="ml-2 hover:text-red-600"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </Badge>
          )}
          {strandIdFilter && (
            <Badge variant="outline" className="px-3 py-1">
              Strand: {strandIdFilter}
              <button 
                onClick={() => removeFilter('strand_id')}
                className="ml-2 hover:text-red-600"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </Badge>
          )}
          {gradeLevelIdFilter && (
            <Badge variant="outline" className="px-3 py-1">
              Grade Level: {gradeLevelIdFilter}
              <button 
                onClick={() => removeFilter('grade_level_id')}
                className="ml-2 hover:text-red-600"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </Badge>
          )}
          <Button 
            variant="outline" 
            size="sm"
            onClick={clearAllFilters}
            className="h-7"
          >
            Clear All
          </Button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Users</CardTitle>
            <div className="flex items-center space-x-3">
              <Input
                placeholder="Search users..."
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
                <LoadingScreen message="Loading users..." />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600">Error loading users: {error?.message || 'Unknown error'}</p>
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
                        {!Array.isArray(users) ? 'Loading users...' : 
                         (searchQuery || userTypeFilter) ? 'No users found matching your filters.' : 
                         'No users found. Add your first user to get started.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedUsers.map((user) => (
                      <TableRow key={user.user_id} className="hover:bg-gray-50">
                        <TableCell className="py-2 font-medium">
                          <div className="flex items-center gap-2">
                            {user.full_name}
                            {user.rfid_code ? (
                              <i className="fas fa-check-circle text-green-600 text-xs" title={`RFID: ${user.rfid_code}`}></i>
                            ) : (
                              <i className="fas fa-id-card text-gray-400 text-xs" title="No RFID"></i>
                            )}
                          </div>
                        </TableCell>
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
                            {(userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN) && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => router.push(`/library-users/${user.user_id}/edit`)}
                                  className="h-7 w-7 p-0"
                                  title="Edit User"
                                >
                                  <i className="fas fa-edit text-xs" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleToggleStatus(user.user_id, user.status)}
                                  className={`h-7 w-7 p-0 ${
                                    user.status === 'ACTIVE'
                                      ? 'text-orange-600 hover:text-orange-900 border-orange-600 hover:bg-orange-50' 
                                      : 'text-green-600 hover:text-green-900 border-green-600 hover:bg-green-50'
                                  }`}
                                  title={user.status === 'ACTIVE' ? 'Deactivate User' : 'Activate User'}
                                  disabled={archiveLoading}
                                >
                                  <i className={`fas ${user.status === 'ACTIVE' ? 'fa-user-slash' : 'fa-user-check'} text-xs`}></i>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenRfidBindModal(user.user_id, user.full_name || 'User', user.rfid_code || null)}
                                  className="h-7 w-7 p-0 text-blue-600 hover:text-blue-900 border-blue-600 hover:bg-blue-50"
                                  title={user.rfid_code ? 'Update RFID' : 'Bind RFID'}
                                >
                                  <i className="fas fa-id-card text-xs"></i>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleArchiveUser(user.user_id, user.full_name || 'Unknown')}
                                  className="h-7 w-7 p-0 text-gray-600 hover:text-gray-900 border-gray-600 hover:bg-gray-50"
                                  title="Archive User"
                                  disabled={archiveLoading}
                                >
                                  <i className="fas fa-archive text-xs" />
                                </Button>
                              </>
                            )}
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

      {/* RFID Bind/Unbind Modal */}
      {showRfidBindModal && rfidBindUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {rfidBindUser.currentRfid ? 'Update RFID' : 'Bind RFID'}
                </h3>
                <button
                  onClick={handleCloseRfidBindModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  User: <span className="font-semibold text-gray-900">{rfidBindUser.name}</span>
                </p>
                {rfidBindUser.currentRfid && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                    <p className="text-xs text-blue-600 font-medium mb-1">Current RFID Code:</p>
                    <p className="font-mono font-bold text-blue-900 text-lg">{rfidBindUser.currentRfid}</p>
                  </div>
                )}
              </div>

              {rfidBindUser.currentRfid ? (
                // User already has RFID - show unbind option
                <div className="space-y-4">
                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-600 mb-3">
                      This user already has an RFID assigned. You can:
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleUnbindRfid(rfidBindUser.id, rfidBindUser.name)}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      <i className="fas fa-unlink mr-2"></i>
                      Unbind RFID
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseRfidBindModal}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Close
                    </button>
                  </div>
                  <div className="border-t pt-4">
                    <details className="text-sm">
                      <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium">
                        Or update to a different RFID code
                      </summary>
                      <form onSubmit={(e) => {
                        e.preventDefault()
                        if (rfidInput.trim()) {
                          handleBindRfid(rfidBindUser.id, rfidBindUser.name, rfidInput)
                        }
                      }} className="mt-3">
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            New RFID Code <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            value={rfidInput}
                            onChange={(e) => setRfidInput(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Scan new RFID card..."
                            maxLength={50}
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={!rfidInput.trim()}
                          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed"
                        >
                          Update RFID
                        </button>
                      </form>
                    </details>
                  </div>
                </div>
              ) : (
                // User doesn't have RFID - show bind form
                <form onSubmit={(e) => {
                  e.preventDefault()
                  if (rfidInput.trim()) {
                    handleBindRfid(rfidBindUser.id, rfidBindUser.name, rfidInput)
                  }
                }}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      RFID Code <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={rfidInput}
                      onChange={(e) => setRfidInput(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Scan RFID card..."
                      autoFocus
                      maxLength={50}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Scan the RFID card or manually enter the code
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={!rfidInput.trim()}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed"
                    >
                      Bind RFID
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseRfidBindModal}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      

    </div>
  )
}
