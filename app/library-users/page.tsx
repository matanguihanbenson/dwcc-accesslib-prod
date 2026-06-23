'use client'

import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingScreen } from '@/components/ui/loading-spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PaginationControls } from '@/components/ui/pagination'
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
  const [showArchivedUsersModal, setShowArchivedUsersModal] = useState(false)
  const [rfidBindUser, setRfidBindUser] = useState<{id: number, name: string, currentRfid: string | null} | null>(null)
  const [rfidInput, setRfidInput] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [refreshCounter, setRefreshCounter] = useState(0)

  // Comprehensive table filters. The URL-driven filters
  // (sectionIdFilter, etc.) are inherited from the parent
  // navigation and stay as-is. The new client-only filters
  // below add a per-table view that doesn't require a
  // round-trip to the server.
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [departmentFilter, setDepartmentFilter] = useState<string>('')
  const [programFilter, setProgramFilter] = useState<string>('')
  const [yearLevelFilter, setYearLevelFilter] = useState<string>('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

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

  // Load departments and programs for the advanced
  // filter dropdowns. These change rarely so a long
  // deduping window is fine.
  const { data: departmentsData } = useApiSWR<{ data: any[] }>(
    session ? '/api/departments' : null,
    { dedupingInterval: 60_000 }
  )
  const { data: programsData } = useApiSWR<{ data: any[] }>(
    session ? '/api/programs' : null,
    { dedupingInterval: 60_000 }
  )

  const departmentOptions: { code: string; name: string }[] = useMemo(() => {
    const list: any[] = (departmentsData as any)?.data ?? []
    return list
      .filter((d: any) => d?.code)
      .map((d: any) => ({ code: d.code, name: d.name }))
  }, [departmentsData])

  const programOptions: { code: string; name: string }[] = useMemo(() => {
    const list: any[] = (programsData as any)?.data ?? []
    return list
      .filter((p: any) => p?.code)
      .map((p: any) => ({ code: p.code, name: p.name }))
  }, [programsData])

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

      const q = searchQuery.toLowerCase()
      const matchesSearch = searchQuery === '' || (
        (user.full_name?.toLowerCase().includes(q) || false) ||
        user.account_id.toLowerCase().includes(q) ||
        (user.email?.toLowerCase().includes(q) || false) ||
        // `user.department` / `user.course` are the compact
        // codes (see UserService.getLibraryUsers).
        (user.department?.toLowerCase().includes(q) || false) ||
        (user.course?.toLowerCase().includes(q) || false) ||
        // Also match the long names on the relation so the
        // user can still search by "Computer Studies" or
        // "BSIT" — the column shows the code but search is
        // permissive.
        ((user as any).department_ref?.name?.toLowerCase().includes(q) || false) ||
        ((user as any).program?.name?.toLowerCase().includes(q) || false)
      )

      const matchesType = !userTypeFilter || user.user_type === userTypeFilter
      const matchesStatus = !statusFilter || user.status === statusFilter
      const matchesDepartment =
        !departmentFilter || user.department === departmentFilter
      const matchesProgram =
        !programFilter || user.course === programFilter
      const matchesYearLevel =
        !yearLevelFilter || user.year_level === yearLevelFilter

      return (
        matchesSearch &&
        matchesType &&
        matchesStatus &&
        matchesDepartment &&
        matchesProgram &&
        matchesYearLevel
      )
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
  // Count of client-side table filters that are non-empty
  // (used to badge the "Filters" toggle button and the
  // "Clear all" affordance).
  const activeFilterCount =
    (userTypeFilter ? 1 : 0) +
    (statusFilter ? 1 : 0) +
    (departmentFilter ? 1 : 0) +
    (programFilter ? 1 : 0) +
    (yearLevelFilter ? 1 : 0) +
    (searchQuery ? 1 : 0)

  if (status === 'loading') {
    return <LoadingScreen />
  }

  if (!session) {
    return null
  }

  const userRole = session.user.role as UserRole

  // SUPER_ADMIN, ADMIN, and STAFF can all access this
  // page. STAFF has the same library-user management
  // permissions as ADMIN: add, edit, archive, bind
  // RFID, view, activate/deactivate. SUPER_ADMIN-only
  // operations (delete, manage categories) remain
  // gated by their own checks.
  if (
    userRole !== UserRole.SUPER_ADMIN &&
    userRole !== UserRole.ADMIN &&
    userRole !== UserRole.STAFF
  ) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
        <p className="text-gray-600 mt-2">You don't have permission to view this page.</p>
      </div>
    )
  }

  const isStaff = userRole === UserRole.STAFF
  // STAFF now has the same library-user management
  // permissions as ADMIN: add, edit, archive, bind
  // RFID, view, activate/deactivate.
  const canManageUsers =
    userRole === UserRole.SUPER_ADMIN ||
    userRole === UserRole.ADMIN ||
    userRole === UserRole.STAFF

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
        <div className="flex items-center space-x-2">
          {userRole === UserRole.SUPER_ADMIN && (
            <Button
              variant="outline"
              className='bg-gray-100 h-[50px] px-4 hover:bg-gray-200'
              onClick={() => router.push('/library-users/categories')}
            >
              <i className="fas fa-th-large mr-2" />
              View Categories
            </Button>
          )}
          {canManageUsers && (
            <>
              <Button
                variant="outline"
                className='bg-gray-100 h-[50px] px-4 hover:bg-gray-200'
                onClick={() => setShowArchivedUsersModal(true)}
                title="View archived users"
              >
                <i className="fas fa-archive mr-2" />
                Archived Users
              </Button>
              <Button
                className='bg-primary-600 h-[50px] px-4 hover:bg-primary-800 text-white'
                onClick={() => router.push('/library-users/add')}
              >
                <i className="fas fa-plus mr-2" />
                Add User
              </Button>
            </>
          )}
        </div>
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
        <CardHeader className="pb-3 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-lg">Users</CardTitle>
            <div className="flex items-center space-x-3 flex-wrap">
              <Input
                placeholder="Search by name, ID, email, dept code…"
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
              <button
                type="button"
                onClick={() => setShowAdvancedFilters((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-md transition-colors ${
                  showAdvancedFilters
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                title="Toggle advanced filters"
                aria-expanded={showAdvancedFilters}
              >
                <i className="fas fa-sliders text-xs"></i>
                Filters
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-blue-600 text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </div>
          </div>

          {showAdvancedFilters && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                    Status
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value)
                      setCurrentPage(1)
                    }}
                  >
                    <option value="">All Statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="SUSPENDED">Suspended</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                    Department
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                    value={departmentFilter}
                    onChange={(e) => {
                      setDepartmentFilter(e.target.value)
                      setCurrentPage(1)
                    }}
                  >
                    <option value="">All Departments</option>
                    {departmentOptions.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                    Program
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                    value={programFilter}
                    onChange={(e) => {
                      setProgramFilter(e.target.value)
                      setCurrentPage(1)
                    }}
                  >
                    <option value="">All Programs</option>
                    {programOptions.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.code} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                    Year Level
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                    value={yearLevelFilter}
                    onChange={(e) => {
                      setYearLevelFilter(e.target.value)
                      setCurrentPage(1)
                    }}
                  >
                    <option value="">All Year Levels</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                    <option value="Graduate">Graduate</option>
                    <option value="N/A">N/A</option>
                  </select>
                </div>
              </div>

              {activeFilterCount > 0 && (
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-gray-600">
                    <i className="fas fa-circle-info text-blue-500 mr-1"></i>
                    {activeFilterCount} active filter
                    {activeFilterCount > 1 ? 's' : ''} applied
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('')
                      setDepartmentFilter('')
                      setProgramFilter('')
                      setYearLevelFilter('')
                      setUserTypeFilter('')
                      setCurrentPage(1)
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-red-700 hover:text-red-900 border border-red-200 hover:bg-red-50 rounded transition-colors"
                  >
                    <i className="fas fa-times"></i>
                    Clear all
                  </button>
                </div>
              )}
            </div>
          )}
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
                      <TableHead className="py-2">User</TableHead>
                      <TableHead className="py-2">Department</TableHead>
                      <TableHead className="py-2">Program</TableHead>
                      <TableHead className="py-2">Status</TableHead>
                      <TableHead className="py-2">Created</TableHead>
                      <TableHead className="py-2">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                  {!Array.isArray(paginatedUsers) || paginatedUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        {!Array.isArray(users) ? 'Loading users...' :
                         (searchQuery || userTypeFilter) ? 'No users found matching your filters.' :
                         'No users found. Add your first user to get started.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedUsers.map((user) => (
                      <TableRow key={user.user_id} className="hover:bg-gray-50">
                        <TableCell className="py-2 font-medium">
                          {/* Combined "User" column: type badge
                              on top, then full name (with RFID
                              indicator), then email, then
                              account ID. Stacked so the row
                              stays scannable. */}
                          <div className="min-w-[280px]">
                            <div className="mb-1">
                              {getUserTypeBadge(user.user_type)}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900 truncate">
                                {user.full_name || '—'}
                              </span>
                              {user.rfid_code ? (
                                <i
                                  className="fas fa-check-circle text-green-600 text-xs shrink-0"
                                  title={`RFID: ${user.rfid_code}`}
                                ></i>
                              ) : (
                                <i
                                  className="fas fa-id-card text-gray-400 text-xs shrink-0"
                                  title="No RFID"
                                ></i>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {user.email || '—'}
                            </div>
                            <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                              ID: {user.account_id}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 font-mono text-xs text-gray-700">
                          {user.department || '-'}
                        </TableCell>
                        <TableCell className="py-2 font-mono text-xs text-gray-700">
                          {user.course || '-'}
                        </TableCell>
                        <TableCell className="py-2">{getStatusBadge(user.status)}</TableCell>
                        <TableCell className="py-2 text-sm">{formatDate(user.created_at)}</TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center space-x-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.push(`/library-users/${user.user_id}`)}
                              className="py-4 px-2 bg-primary-600 text-white hover:bg-primary-700"
                              title="View User"
                            >
                              <i className="fas fa-eye text-xs" />
                            </Button>
                            {canManageUsers && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => router.push(`/library-users/${user.user_id}/edit`)}
                                  className="py-4 px-2 bg-orange-600 text-white hover:bg-orange-700"
                                  title="Edit User"
                                >
                                  <i className="fas fa-edit text-xs" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleToggleStatus(user.user_id, user.status)}
                                  className={`py-4 px-2 ${
                                    user.status === 'ACTIVE'
                                      ? 'text-orange-600 hover:text-orange-900 !border-orange-500 hover:bg-orange-50'
                                      : 'text-green-600 hover:text-green-900 !border-green-600 hover:bg-green-50'
                                  }`}
                                  title={user.status === 'ACTIVE' ? 'Deactivate User' : 'Activate User'}
                                  disabled={archiveLoading}
                                >
                                  <i className={`fas ${user.status === 'ACTIVE' ? 'fa-user-slash' : 'fa-user-check'} text-xs`}></i>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleArchiveUser(user.user_id, user.full_name || 'Unknown')}
                                  className="py-4 px-2 text-gray-600 hover:text-gray-900 !border-gray-600 hover:bg-gray-50"
                                  title="Archive User"
                                  disabled={archiveLoading}
                                >
                                  <i className="fas fa-archive text-xs" />
                                </Button>
                              </>
                            )}
                            {/*
                              RFID binding is intentionally
                              available to STAFF as well — they
                              are the front-line users who scan
                              cards at the desk.
                            */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenRfidBindModal(user.user_id, user.full_name || 'User', user.rfid_code || null)}
                              className="py-4 px-2 text-blue-600 hover:text-blue-900 !border-blue-600 hover:bg-blue-50"
                              title={user.rfid_code ? 'Update RFID' : 'Bind RFID'}
                            >
                              <i className="fas fa-id-card text-xs" />
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

        {/* Pagination — Google-style Prev / 1 2 3 … #last / Next */}
        {!isLoading && filteredUsers.length > 0 && (
          <div className="mt-4 px-4 py-3 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-gray-600">
              Showing{' '}
              <span className="font-semibold text-gray-900">
                {startIndex + 1}
              </span>
              –
              <span className="font-semibold text-gray-900">
                {Math.min(endIndex, filteredUsers.length)}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-gray-900">
                {filteredUsers.length}
              </span>{' '}
              users · Page{' '}
              <span className="font-semibold text-gray-900">{currentPage}</span>{' '}
              of{' '}
              <span className="font-semibold text-gray-900">{totalPages}</span>
            </p>
            {totalPages > 1 && (
              <nav
                className="flex items-center gap-1 flex-wrap"
                aria-label="Pagination"
              >
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="First page"
                >
                  <i className="fas fa-angles-left"></i>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((p) => Math.max(1, p - 1))
                  }
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                >
                  <i className="fas fa-chevron-left text-xs"></i>
                  Prev
                </button>
                {(() => {
                  // Build the page-number list with smart
                  // ellipsis: 1, 2, 3, …, 8, 9, 10.
                  const pages: (number | '…')[] = []
                  const window = 1
                  const first = 1
                  const last = totalPages
                  const left = Math.max(first + 1, currentPage - window)
                  const right = Math.min(last - 1, currentPage + window)
                  if (first < left - 1) {
                    pages.push(first, '…')
                  } else if (first === left - 1) {
                    pages.push(first)
                  } else {
                    pages.push(first)
                  }
                  for (let i = left; i <= right; i++) pages.push(i)
                  if (right < last - 1) {
                    pages.push('…', last)
                  } else if (right === last - 1) {
                    pages.push(last)
                  } else if (!pages.includes(last)) {
                    pages.push(last)
                  }
                  return pages.map((p, idx) =>
                    p === '…' ? (
                      <span
                        key={`gap-${idx}`}
                        className="px-2 text-gray-400 select-none"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        aria-current={p === currentPage ? 'page' : undefined}
                        className={`min-w-[36px] h-[34px] px-2 text-sm font-semibold rounded transition-colors ${
                          p === currentPage
                            ? 'bg-blue-600 text-white border border-blue-600 hover:bg-blue-700'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )
                })()}
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                >
                  Next
                  <i className="fas fa-chevron-right text-xs"></i>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Last page"
                >
                  <i className="fas fa-angles-right"></i>
                </button>
              </nav>
            )}
          </div>
        )}

      {/* User Details Modal */}
      {showUserModal && selectedUser && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[1000] w-screen h-screen m-0 p-0 bg-black/50"
          onClick={handleCloseUserModal}
        >
          <div
            className="flex items-center justify-center min-h-screen w-full p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="bg-white rounded-lg p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
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
        </div>,
        document.body
      )}

      {/* RFID Bind/Unbind Modal */}
      {showRfidBindModal && rfidBindUser && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[1000] w-screen h-screen m-0 p-0 bg-black/50"
          onClick={handleCloseRfidBindModal}
        >
          <div
            className="flex items-center justify-center min-h-screen w-full p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="bg-white rounded-lg shadow-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
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
        </div>,
        document.body
      )}

      {/* Archived Users Modal — opens from the "Archived
          Users" button in the page header. Lists every
          library user with status = ARCHIVED, supports
          realtime search across the visible list, and
          paginates 10 per page. */}
      {showArchivedUsersModal && (
        <ArchivedUsersModal
          onClose={() => setShowArchivedUsersModal(false)}
          onUnarchived={() => {
            // The main list is filtered to exclude
            // archived users, so re-fetch it after
            // restoring a row to keep counts current.
            setRefreshCounter((c) => c + 1)
          }}
        />
      )}



    </div>
  )
}

// ============================================================
// Archived Users Modal
// ------------------------------------------------------------
// Self-contained modal: fetches its own data, owns its own
// search/pagination state. Closes via the X / Cancel button
// or by pressing Escape.
// ============================================================
function ArchivedUsersModal({
  onClose,
  onUnarchived
}: {
  onClose: () => void
  onUnarchived?: () => void
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const itemsPerPage = 10
  // Bump this to force SWR to re-fetch (e.g. after a
  // successful unarchive). Using `Date.now()` directly in
  // the SWR key would produce a new key on every render
  // and trap the modal in an infinite loading loop.
  const [refreshCounter, setRefreshCounter] = useState(0)

  // SWR for real-time data fetching. The key is stable
  // across renders and only changes when `refreshCounter`
  // is bumped (or the search input is cleared).
  const { data, isLoading, mutate: refresh } = useApiSWR<any>(
    `${API_ENDPOINTS.LIBRARY_USERS}?status=ARCHIVED&_ts=${refreshCounter}`,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 1000
    }
  )

  const allArchived: LibraryUser[] = useMemo(() => {
    const d: any = data
    if (!d) return []
    if (Array.isArray(d)) return d
    if (Array.isArray(d.data)) return d.data
    if (Array.isArray(d.users)) return d.users
    return []
  }, [data])

  // Realtime search: filter as the user types. No debounce
  // because the dataset is small (one user per row) and
  // filtering is synchronous.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allArchived
    return allArchived.filter((u) => {
      return (
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.account_id || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.department || '').toLowerCase().includes(q) ||
        (u.course || '').toLowerCase().includes(q) ||
        (u.user_type || '').toLowerCase().includes(q)
      )
    })
  }, [allArchived, search])

  // Reset to page 1 whenever the search text changes so
  // the user isn't stranded on a now-empty page.
  useEffect(() => {
    setPage(1)
  }, [search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * itemsPerPage
  const pageRows = filtered.slice(startIndex, startIndex + itemsPerPage)

  const handleUnarchive = async (userId: number, fullName: string) => {
    const confirmed = await notify.confirm(
      'Restore user',
      `Restore ${fullName || 'this user'} to active status? They will be able to borrow books again.`
    )
    if (!confirmed) return
    try {
      const res = await fetch(`/api/library-users/${userId}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ archive: false })
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        await notify.error('Error', j.error || 'Failed to restore user')
        return
      }
      await notify.success('Restored', `${fullName || 'User'} is now active.`)
      // Bump the SWR key so the modal re-fetches the
      // archived list without a re-mount, and let the
      // parent refetch its active list.
      setRefreshCounter((c) => c + 1)
      refresh()
      onUnarchived?.()
    } catch {
      await notify.error('Error', 'Network error while restoring user')
    }
  }

  const getUserTypeBadge = (userType: UserType) => {
    const colors: Record<UserType, string> = {
      STUDENT: 'bg-blue-100 text-blue-800',
      EMPLOYEE: 'bg-green-100 text-green-800',
      ALUMNI: 'bg-purple-100 text-purple-800',
      GUEST: 'bg-gray-100 text-gray-800'
    }
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          colors[userType] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {userType}
      </span>
    )
  }

  // Render via portal at the document body level so the
  // overlay is never clipped or constrained by an ancestor
  // (transform / filter / overflow / perspective can all
  // turn `position: fixed` into a non-viewport-relative
  // box, which leaves a visible gap at the top).
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      className="fixed inset-0 z-[1000] w-screen h-screen m-0 p-0 bg-black/50"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-center min-h-screen w-full p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            <i className="fas fa-archive text-amber-600"></i>
            <h2 className="text-lg font-semibold text-gray-900">
              Archived Users
            </h2>
            <span className="ml-1 text-xs font-medium text-gray-500">
              ({filtered.length} total)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setRefreshCounter((c) => c + 1)
                refresh()
              }}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-700"
              title="Refresh"
            >
              <i className="fas fa-rotate-right"></i>
              Refresh
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
              aria-label="Close"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-5 py-3 border-b bg-gray-50">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, account ID, email, department…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                aria-label="Clear search"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            )}
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            {search
              ? `Showing ${filtered.length} match${
                  filtered.length === 1 ? '' : 'es'
                } for "${search}"`
              : 'Search filters the list as you type — no need to press Enter.'}
          </p>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-10 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
              <p className="text-sm text-gray-500">Loading archived users…</p>
            </div>
          ) : pageRows.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              <i className="fas fa-folder-open text-4xl text-gray-300 mb-3"></i>
              <p className="text-sm">
                {search
                  ? `No archived users match "${search}".`
                  : 'No archived users found.'}
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    Account ID
                  </th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pageRows.map((u) => (
                  <tr key={u.user_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">
                      {u.full_name || '—'}
                    </td>
                    <td className="px-4 py-2 text-sm font-mono text-gray-700">
                      {u.account_id}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {getUserTypeBadge(u.user_type)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {u.department || '—'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 truncate max-w-[200px]">
                      {u.email || '—'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          handleUnarchive(u.user_id, u.full_name || '')
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100"
                        title="Restore this user to active status"
                      >
                        <i className="fas fa-rotate-left"></i>
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination — 10 per page */}
        <div className="px-5 py-3 border-t bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs text-gray-600">
            {filtered.length === 0
              ? '0 results'
              : `Showing ${startIndex + 1}–${Math.min(
                  startIndex + itemsPerPage,
                  filtered.length
                )} of ${filtered.length} archived user${
                  filtered.length === 1 ? '' : 's'
                } · 10 per page`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="fas fa-chevron-left"></i>
                Prev
              </button>
              <span className="text-xs text-gray-700 px-2">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <i className="fas fa-chevron-right ml-1"></i>
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>,
    document.body
  )
}
