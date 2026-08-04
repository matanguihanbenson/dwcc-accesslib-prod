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
import { Pagination } from '@/components/ui/pagination'
import { UserRole, LibraryUser, UserType, UserStatus } from '@/types'
import { formatDate, formatCurrency } from '@/lib/utils'
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
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyUser, setHistoryUser] = useState<{
    user_id: number
    full_name: string
    account_id: string
  } | null>(null)
  const [showFinesModal, setShowFinesModal] = useState(false)
  const [finesUser, setFinesUser] = useState<{
    user_id: number
    full_name: string
    account_id: string
  } | null>(null)
  const [rfidBindUser, setRfidBindUser] = useState<{id: number, name: string, currentRfid: string | null} | null>(null)
  const [rfidInput, setRfidInput] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [refreshCounter, setRefreshCounter] = useState(0)

  const [statusFilter, setStatusFilter] = useState<string>('')
  const [departmentFilter, setDepartmentFilter] = useState<string>('')
  const [programFilter, setProgramFilter] = useState<string>('')
  const [officeFilter, setOfficeFilter] = useState<string>('')
  const [hasRfidFilter, setHasRfidFilter] = useState<string>('')
  const [registeredFrom, setRegisteredFrom] = useState<string>('')
  const [registeredTo, setRegisteredTo] = useState<string>('')
  const [educationLevelFilter, setEducationLevelFilter] = useState<string>('')
  const [sectionFilter, setSectionFilter] = useState<string>('')
  const [gradeLevelFilter, setGradeLevelFilter] = useState<string>('')
  const [strandFilter, setStrandFilter] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
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

  // Build query parameters for SWR key. The endpoint is
  // server-paginated (see `paginate` in
  // `lib/services/user.service.ts`), so the page-level
  // `page` / `limit` controls get forwarded here along
  // with every filter (including the table-level ones
  // that used to be applied client-side). This is the
  // fix for "selecting 50/100 per page only shows 25":
  // without forwarding `limit` the server caps the
  // response at 25 (its own default) and the client
  // can't show more.
  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    params.append('page', String(currentPage))
    params.append('limit', String(itemsPerPage))
    if (searchQuery) params.append('query', searchQuery)
    if (userTypeFilter) params.append('userType', userTypeFilter)
    if (statusFilter) params.append('status', statusFilter)
    if (departmentFilter) params.append('department_code', departmentFilter)
    if (programFilter) params.append('program_code', programFilter)
    if (officeFilter) params.append('office_code', officeFilter)
    if (educationLevelFilter) params.append('education_level', educationLevelFilter)
    if (sectionFilter) params.append('section_id', sectionFilter)
    if (gradeLevelFilter) params.append('grade_level_id', gradeLevelFilter)
    if (strandFilter) params.append('strand_id', strandFilter)
    if (hasRfidFilter) params.append('has_rfid', hasRfidFilter)
    if (registeredFrom) params.append('dateFrom', registeredFrom)
    if (registeredTo) params.append('dateTo', registeredTo)
    if (sortBy) params.append('sortBy', sortBy)
    if (sortOrder) params.append('sortOrder', sortOrder)
    if (sectionIdFilter) params.append('section_id', sectionIdFilter)
    if (programIdFilter) params.append('program_id', programIdFilter)
    if (departmentIdFilter) params.append('department_id', departmentIdFilter)
    if (officeIdFilter) params.append('office_id', officeIdFilter)
    if (strandIdFilter) params.append('strand_id', strandIdFilter)
    if (gradeLevelIdFilter) params.append('grade_level_id', gradeLevelIdFilter)
    return params.toString()
  }, [
    currentPage,
    itemsPerPage,
    searchQuery,
    userTypeFilter,
    statusFilter,
    departmentFilter,
    programFilter,
    officeFilter,
    educationLevelFilter,
    sectionFilter,
    gradeLevelFilter,
    strandFilter,
    hasRfidFilter,
    registeredFrom,
    registeredTo,
    sortBy,
    sortOrder,
    sectionIdFilter,
    programIdFilter,
    departmentIdFilter,
    officeIdFilter,
    strandIdFilter,
    gradeLevelIdFilter
  ])

  // Use SWR for real-time data fetching. The endpoint
  // returns the canonical paginated shape
  // `{ data: LibraryUser[], pagination: { page, limit,
  // total, totalPages } }` (see `createPaginationResponse`
  // in `lib/utils.ts`); we read both so the UI's
  // page-number buttons and per-page selector stay in
  // lockstep with the server's count.
  const { 
    data: usersResponse, 
    error, 
    isLoading,
    mutate: refreshUsers 
  } = useApiSWR<{
    data: LibraryUser[]
    pagination?: { page: number; limit: number; total: number; totalPages: number }
  }>(
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

  const departmentOptions: { id: number; code: string; name: string }[] = useMemo(() => {
    const list: any[] = (departmentsData as any)?.data ?? []
    return list
      .filter((d: any) => d?.code)
      .map((d: any) => ({ id: d.department_id, code: d.code, name: d.name }))
  }, [departmentsData])

  // Derive the selected department's numeric ID from the
  // code stored in `departmentFilter` so we can fetch
  // only that department's programs.
  const selectedDepartmentId = useMemo(() => {
    if (!departmentFilter) return null
    const match = departmentOptions.find((d) => d.code === departmentFilter)
    return match?.id ?? null
  }, [departmentFilter, departmentOptions])

  // When a department is selected, only fetch programs
  // belonging to that department. SWR re-fetches
  // automatically when the URL key changes.
  const { data: programsData } = useApiSWR<any[]>(
    session
      ? selectedDepartmentId
        ? `/api/programs?departmentId=${selectedDepartmentId}`
        : '/api/programs'
      : null,
    { dedupingInterval: 60_000 }
  )
  // Offices, sections, grade-levels and strands feed the
  // filter dropdowns. These APIs return raw arrays (not
  // wrapped in { data: [...] }), so SWR stores the array
  // directly — we use it as-is in the option builders.
  const { data: officesData } = useApiSWR<any[]>(
    session ? '/api/offices?include_archived=false' : null,
    { dedupingInterval: 60_000 }
  )
  const { data: sectionsData } = useApiSWR<any[]>(
    session ? '/api/student-sections' : null,
    { dedupingInterval: 60_000 }
  )
  const { data: gradeLevelsData } = useApiSWR<any[]>(
    session ? '/api/grade-levels' : null,
    { dedupingInterval: 60_000 }
  )
  const { data: strandsData } = useApiSWR<any[]>(
    session ? '/api/strands' : null,
    { dedupingInterval: 60_000 }
  )

  // Programs API returns raw arrays — same as sections/grade-levels.
  const programOptions: { code: string; name: string }[] = useMemo(() => {
    const list: any[] = Array.isArray(programsData) ? programsData : (programsData as any)?.data ?? []
    return list
      .filter((p: any) => p?.code)
      .map((p: any) => ({ code: p.code, name: p.name }))
  }, [programsData])

  const officeOptions: { code: string; name: string }[] = useMemo(() => {
    const list: any[] = Array.isArray(officesData) ? officesData : (officesData as any)?.data ?? []
    return list
      .filter((o: any) => o?.code)
      .map((o: any) => ({ code: o.code, name: o.name }))
  }, [officesData])

  // Sections, grade-levels, and strands APIs return raw
  // arrays — no `{ data: [...] }` wrapper.
  const sectionOptions: { id: number; name: string; grade_level_id: number; strand_id: number | null }[] = useMemo(() => {
    const list: any[] = Array.isArray(sectionsData) ? sectionsData : []
    return list
      .filter((s: any) => s?.section_id != null)
      .map((s: any) => ({
        id: s.section_id,
        name: s.name || `Section #${s.section_id}`,
        grade_level_id: s.grade_level_id,
        strand_id: s.strand_id ?? null
      }))
  }, [sectionsData])

  const gradeLevelOptions: { id: number; name: string; education_level: string; level_number: number }[] = useMemo(() => {
    const list: any[] = Array.isArray(gradeLevelsData) ? gradeLevelsData : []
    return list
      .filter((g: any) => g?.grade_level_id != null)
      .map((g: any) => ({
        id: g.grade_level_id,
        name: g.name || `Grade #${g.grade_level_id}`,
        education_level: g.education_level,
        level_number: g.level_number
      }))
  }, [gradeLevelsData])

  const strandOptions: { id: number; name: string }[] = useMemo(() => {
    const list: any[] = Array.isArray(strandsData) ? strandsData : []
    return list
      .filter((s: any) => s?.strand_id != null)
      .map((s: any) => ({ id: s.strand_id, name: s.name || `Strand #${s.strand_id}` }))
  }, [strandsData])

  // College year levels (grade levels where education_level = COLLEGE)
  const collegeYearLevelOptions = useMemo(() => {
    return gradeLevelOptions
      .filter((g) => g.education_level === 'COLLEGE')
      .sort((a, b) => a.level_number - b.level_number)
  }, [gradeLevelOptions])

  // Basic Education grade levels (KINDERGARTEN, ELEMENTARY, JUNIOR_HIGH, SENIOR_HIGH)
  const basicEdGradeLevelOptions = useMemo(() => {
    return gradeLevelOptions
      .filter((g) => g.education_level !== 'COLLEGE' && g.education_level !== 'GRADUATE_SCHOOL')
      .sort((a, b) => a.level_number - b.level_number)
  }, [gradeLevelOptions])

  // Sections filtered by the selected basic-ed grade level
  const filteredSectionOptions = useMemo(() => {
    if (educationLevelFilter === 'BASIC_EDUCATION' && gradeLevelFilter) {
      return sectionOptions.filter((s) => s.grade_level_id === parseInt(gradeLevelFilter))
    }
    if (educationLevelFilter === 'COLLEGE') {
      // College sections are not grade-level-specific in this schema
      return []
    }
    return sectionOptions
  }, [sectionOptions, gradeLevelFilter, educationLevelFilter])

  // Strands filtered by the selected basic-ed grade level
  const filteredStrandOptions = useMemo(() => {
    if (educationLevelFilter === 'BASIC_EDUCATION' && gradeLevelFilter) {
      const selectedGrade = basicEdGradeLevelOptions.find(
        (g) => g.id === parseInt(gradeLevelFilter)
      )
      // Only show strands for Senior High (level_number 11-12 range)
      if (selectedGrade && selectedGrade.education_level === 'SENIOR_HIGH') {
        return strandOptions
      }
      return []
    }
    return []
  }, [strandOptions, gradeLevelFilter, educationLevelFilter, basicEdGradeLevelOptions])

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
  // Server-side pagination metadata. The endpoint wraps
  // the array in `{ data, pagination: { page, limit,
  // total, totalPages } }`; fall back to client-computed
  // defaults so older callers (or a missing metadata
  // block) don't crash the page.
  const serverPagination = (usersResponse as any)?.pagination as
    | { page: number; limit: number; total: number; totalPages: number }
    | undefined
  const serverTotal: number = serverPagination?.total ?? users.length
  // When the response is fully populated, `total` is the
  // server's filtered count (post-filters), which is what
  // the page count should be derived from. When the
  // metadata is missing we fall back to the count of the
  // items we actually have so the UI is still usable.
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

  // Borrowing-history handler — opens the modal pre-loaded
  // with the selected user. The modal does its own SWR
  // fetch on `/api/borrowing-transactions?user_id=…`, so
  // we only need to stash the user identity here.
  const handleOpenHistoryModal = (userId: number, fullName: string, accountId: string) => {
    setHistoryUser({ user_id: userId, full_name: fullName, account_id: accountId })
    setShowHistoryModal(true)
  }

  const handleCloseHistoryModal = () => {
    setShowHistoryModal(false)
    setHistoryUser(null)
  }

  // Fines quick-view handler — opens a modal pre-loaded
  // with the selected user. The modal does its own SWR
  // fetch on `/api/overdue/user-summary/[user_id]`, so
  // we only need to stash the user identity here.
  const handleOpenFinesModal = (userId: number, fullName: string, accountId: string) => {
    setFinesUser({ user_id: userId, full_name: fullName, account_id: accountId })
    setShowFinesModal(true)
  }

  const handleCloseFinesModal = () => {
    setShowFinesModal(false)
    setFinesUser(null)
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

  // Pagination is fully server-side now. `users` is
  // already the (filtered + paginated) page slice returned
  // by `/api/library-users`, and `serverTotal` is the
  // total count after filters so the page-number buttons
  // match the real number of pages.
  const totalPages = Math.max(1, Math.ceil(serverTotal / itemsPerPage))
  // Expose the same `paginatedUsers` name downstream so the
  // table render code below doesn't need to change. It's
  // just an alias for the (already paginated) `users`
  // array now.
  const paginatedUsers = users

  const handlePageChange = (page: number) => {
    // Clamp to a valid page so a stale state (e.g. the
    // user shrunk `itemsPerPage` and the old page number
    // is now beyond the last page) never strands the UI on
    // a blank screen.
    const safePage = Math.min(Math.max(1, page), totalPages)
    setCurrentPage(safePage)
  }

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    // Always reset to the first page when the page size
    // changes — otherwise the user could end up on page 4
    // of an 8-page list and then pick 100 per page, which
    // would leave them on a now-empty page.
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
  // "Clear all" affordance). Sort is intentionally not
  // counted — it's a different shape of control, not a
  // filter.
  const activeFilterCount =
    (userTypeFilter ? 1 : 0) +
    (statusFilter ? 1 : 0) +
    (departmentFilter ? 1 : 0) +
    (programFilter ? 1 : 0) +
    (officeFilter ? 1 : 0) +
    (educationLevelFilter ? 1 : 0) +
    (sectionFilter ? 1 : 0) +
    (gradeLevelFilter ? 1 : 0) +
    (strandFilter ? 1 : 0) +
    (hasRfidFilter ? 1 : 0) +
    (registeredFrom ? 1 : 0) +
    (registeredTo ? 1 : 0) +
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
          {canManageUsers && (
            <Button
              variant="outline"
              className='bg-gray-100 h-[50px] px-4 hover:bg-gray-200'
              onClick={() => router.push('/library-users/categories')}
              title="Browse users by section, program, department, grade level, or strand"
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
          {/* Title on its own row, then the filter row, then
              the pagination row — so the filters sit on top
              of the pagination per the latest UX request. */}
          <CardTitle className="text-lg">Users</CardTitle>
          <div className="flex items-center flex-wrap gap-3">
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
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600">Sort by:</label>
              <select
                className="px-2.5 py-2 border border-gray-300 rounded-md text-sm bg-white"
                value={`${sortBy}:${sortOrder}`}
                onChange={(e) => {
                  const [nextSortBy, nextSortOrder] = e.target.value.split(':')
                  setSortBy(nextSortBy)
                  setSortOrder((nextSortOrder as 'asc' | 'desc') || 'asc')
                  setCurrentPage(1)
                }}
              >
                <option value="created_at:desc">Newest registered</option>
                <option value="created_at:asc">Oldest registered</option>
                <option value="updated_at:desc">Recently updated</option>
                <option value="updated_at:asc">Least recently updated</option>
                <option value="full_name:asc">Name (A → Z)</option>
                <option value="full_name:desc">Name (Z → A)</option>
                <option value="account_id:asc">Account ID (A → Z)</option>
                <option value="account_id:desc">Account ID (Z → A)</option>
              </select>
            </div>
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
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={serverTotal}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
            countLabel="users"
          />

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
                    Education Level
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                    value={educationLevelFilter}
                    onChange={(e) => {
                      setEducationLevelFilter(e.target.value)
                      // Reset dependent filters when education level changes
                      setGradeLevelFilter('')
                      setStrandFilter('')
                      setSectionFilter('')
                      setDepartmentFilter('')
                      setProgramFilter('')
                      setCurrentPage(1)
                    }}
                  >
                    <option value="">All Education Levels</option>
                    <option value="COLLEGE">College</option>
                    <option value="BASIC_EDUCATION">Basic Education</option>
                  </select>
                </div>

                {/* COLLEGE filters: Department → Program → Year Level */}
                {educationLevelFilter === 'COLLEGE' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                        Department
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                        value={departmentFilter}
                        onChange={(e) => {
                          setDepartmentFilter(e.target.value)
                          setProgramFilter('')
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
                        value={gradeLevelFilter}
                        onChange={(e) => {
                          setGradeLevelFilter(e.target.value)
                          setCurrentPage(1)
                        }}
                      >
                        <option value="">All Year Levels</option>
                        {collegeYearLevelOptions.map((g) => (
                          <option key={g.id} value={String(g.id)}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* BASIC_EDUCATION filters: Grade Level → Strand (SH only) → Section */}
                {educationLevelFilter === 'BASIC_EDUCATION' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                        Grade Level
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                        value={gradeLevelFilter}
                        onChange={(e) => {
                          setGradeLevelFilter(e.target.value)
                          setStrandFilter('')
                          setSectionFilter('')
                          setCurrentPage(1)
                        }}
                      >
                        <option value="">All Grade Levels</option>
                        {basicEdGradeLevelOptions.map((g) => (
                          <option key={g.id} value={String(g.id)}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Strand — only for Senior High */}
                    {filteredStrandOptions.length > 0 && (
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                          Strand
                        </label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                          value={strandFilter}
                          onChange={(e) => {
                            setStrandFilter(e.target.value)
                            setSectionFilter('')
                            setCurrentPage(1)
                          }}
                        >
                          <option value="">All Strands</option>
                          {filteredStrandOptions.map((s) => (
                            <option key={s.id} value={String(s.id)}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Section — filtered by selected grade level */}
                    {filteredSectionOptions.length > 0 && (
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                          Section
                        </label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                          value={sectionFilter}
                          onChange={(e) => {
                            setSectionFilter(e.target.value)
                            setCurrentPage(1)
                          }}
                        >
                          <option value="">All Sections</option>
                          {filteredSectionOptions.map((s) => (
                            <option key={s.id} value={String(s.id)}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}

                {/* No education level selected — show Office as the remaining always-visible filter */}
                {!educationLevelFilter && (
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                      Office
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                      value={officeFilter}
                      onChange={(e) => {
                        setOfficeFilter(e.target.value)
                        setCurrentPage(1)
                      }}
                    >
                      <option value="">All Offices</option>
                      {officeOptions.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.code} — {o.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                    RFID
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                    value={hasRfidFilter}
                    onChange={(e) => {
                      setHasRfidFilter(e.target.value)
                      setCurrentPage(1)
                    }}
                  >
                    <option value="">Any</option>
                    <option value="yes">Has RFID</option>
                    <option value="no">No RFID</option>
                  </select>
                </div>
              </div>

              {/* Registered between */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                    Registered from
                  </label>
                  <Input
                    type="date"
                    value={registeredFrom}
                    onChange={(e) => {
                      setRegisteredFrom(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                    Registered to
                  </label>
                  <Input
                    type="date"
                    value={registeredTo}
                    onChange={(e) => {
                      setRegisteredTo(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="w-full"
                    min={registeredFrom || undefined}
                  />
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
                      setOfficeFilter('')
                      setEducationLevelFilter('')
                      setSectionFilter('')
                      setGradeLevelFilter('')
                      setStrandFilter('')
                      setHasRfidFilter('')
                      setRegisteredFrom('')
                      setRegisteredTo('')
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
                          {user.user_type === 'STUDENT' &&
                          user.education_level &&
                          user.education_level !== 'COLLEGE' &&
                          user.education_level !== 'GRADUATE_SCHOOL' ? (
                            // Basic-Ed student: show the
                            // grade (e.g. "Grade 5") the same
                            // way a College user sees the
                            // department code ("CS"). Falls
                            // back to the FK if the joined
                            // name didn't come back.
                            user.grade_level_name ||
                              (user.grade_level_id
                                ? `Grade #${user.grade_level_id}`
                                : '-')
                          ) : (
                            // College / Graduate /
                            // non-student: existing
                            // department-code display.
                            user.department || '-'
                          )}
                        </TableCell>
                        <TableCell className="py-2 font-mono text-xs text-gray-700">
                          {user.user_type === 'STUDENT' &&
                          user.education_level &&
                          user.education_level !== 'COLLEGE' &&
                          user.education_level !== 'GRADUATE_SCHOOL' ? (
                            // Basic-Ed student: show the
                            // section (e.g. "Section
                            // Rizal"). College students
                            // still see the program code
                            // here.
                            user.section_name ||
                              (user.section_id
                                ? `Section #${user.section_id}`
                                : '-')
                          ) : (
                            // College / non-student:
                            // existing program-code display.
                            user.course || '-'
                          )}
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
                            {/*
                              Borrowing history — opens a modal
                              listing every book this user has
                              borrowed/returned (10 per page,
                              most recent first). Visible to all
                              roles that can view the list.
                            */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenHistoryModal(user.user_id, user.full_name || 'User', user.account_id)}
                              className="py-4 px-2 text-indigo-600 hover:text-indigo-900 !border-indigo-600 hover:bg-indigo-50"
                              title="View Borrowing History"
                            >
                              <i className="fas fa-history text-xs" />
                            </Button>
                            {/*
                              Fines quick-view — opens a modal with
                              two tabs: a Summary tab that aggregates
                              outstanding book and locker fines, and
                              a History tab that lists every
                              settlement row, most recent first.
                            */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenFinesModal(user.user_id, user.full_name || 'User', user.account_id)}
                              className="py-4 px-2 text-rose-600 hover:text-rose-900 !border-rose-600 hover:bg-rose-50"
                              title="View Fines"
                            >
                              <i className="fas fa-receipt text-xs" />
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

        {/* Pagination — same full control (per-page + count + nav)
            rendered at the bottom as well, so the user can paginate
            from either end of the table without scrolling back up. */}
        {!isLoading && serverTotal > 0 && (
          <div className="mt-4 px-4 py-3 bg-white border border-gray-200 rounded-lg shadow-sm">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={serverTotal}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
              countLabel="users"
            />
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

      {/* Borrowing History Modal — opens from the per-row
          "history" action button. Server-side pagination
          (10 per page, most recent first) so the modal
          stays cheap regardless of how long a user's
          borrowing history is. */}
      {showHistoryModal && historyUser && (
        <BorrowingHistoryModal
          user={historyUser}
          onClose={handleCloseHistoryModal}
        />
      )}

      {/* Fines Quick-View Modal — opens from the per-row
          "fines" action button. Two tabs: Summary (book +
          locker aggregates) and History (per-transaction
          settlement list, most recent first). */}
      {showFinesModal && finesUser && (
        <FinesQuickViewModal
          user={finesUser}
          onClose={handleCloseFinesModal}
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

// ============================================================
// Borrowing History Modal
// ------------------------------------------------------------
// Self-contained modal: fetches its own data, owns its
// pagination state. Renders a 4-column table (Accession #,
// Borrowed, Returned, Status) with 10 rows per page, most
// recent first. Closes via the X / Close button.
// ============================================================
function BorrowingHistoryModal({
  user,
  onClose
}: {
  user: { user_id: number; full_name: string; account_id: string }
  onClose: () => void
}) {
  // Server-side pagination: 10 per page, sorted by
  // created_at DESC (the API default — see
  // `getUserBookTransactions` and `buildOrderBy`). Bumping
  // `refreshCounter` forces SWR to re-fetch on demand
  // without producing a new key on every render.
  const [page, setPage] = useState(1)
  const itemsPerPage = 10
  const [refreshCounter, setRefreshCounter] = useState(0)

  // API key is stable per page; the cache-buster only
  // changes when the user explicitly refreshes.
  const apiKey = useMemo(
    () =>
      `${API_ENDPOINTS.BORROWING_TRANSACTIONS}?user_id=${user.user_id}` +
      `&page=${page}&limit=${itemsPerPage}&_ts=${refreshCounter}`,
    [user.user_id, page, refreshCounter]
  )

  const { data, isLoading, error, mutate: refresh } = useApiSWR<any>(apiKey, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 1000
  })

  // Normalise the response shape. The service layer wraps
  // rows in `data` and adds a sibling `pagination` object,
  // but older callers have been seen returning a bare
  // array, so we accept both.
  const rows: any[] = useMemo(() => {
    if (!data) return []
    if (Array.isArray(data)) return data
    if (Array.isArray(data.data)) return data.data
    if (Array.isArray(data.transactions)) return data.transactions
    return []
  }, [data])

  const pagination = data?.pagination
  const totalRows: number =
    typeof pagination?.total === 'number' ? pagination.total : rows.length
  const totalServerPages: number =
    typeof pagination?.totalPages === 'number'
      ? pagination.totalPages
      : Math.max(1, Math.ceil(totalRows / itemsPerPage))

  // Status pill — same colour mapping used by the
  // `borrowing-transactions` page so the modal feels
  // consistent with the rest of the app.
  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      ACTIVE: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      OVERDUE: 'bg-red-100 text-red-800',
      PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
      REJECTED: 'bg-gray-100 text-gray-800',
      CANCELLED: 'bg-gray-100 text-gray-800'
    }
    const label = (status || '').replace(/_/g, ' ')
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          map[status] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {label}
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
          className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh] min-h-[600px]"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <i className="fas fa-history text-indigo-600"></i>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 truncate">
                Borrowing History
              </h2>
              <p className="text-xs text-gray-500 truncate">
                {user.full_name} ·{' '}
                <span className="font-mono">{user.account_id}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Close"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-10 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
              <p className="text-sm text-gray-500">Loading borrowing history…</p>
            </div>
          ) : error ? (
            <div className="p-10 text-center text-gray-500">
              <i className="fas fa-triangle-exclamation text-3xl text-red-400 mb-2"></i>
              <p className="text-sm text-red-600">
                Failed to load borrowing history.
              </p>
              <button
                type="button"
                onClick={() => {
                  setRefreshCounter((c) => c + 1)
                  refresh()
                }}
                className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
              >
                <i className="fas fa-rotate-right"></i>
                Retry
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              <i className="fas fa-book-open text-4xl text-gray-300 mb-3"></i>
              <p className="text-sm font-medium text-gray-700">
                No borrowing history yet
              </p>
              <p className="text-xs text-gray-500 mt-1">
                This user has not borrowed any books.
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    Accession #
                  </th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    Borrowed
                  </th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    Returned
                  </th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((t) => {
                  const accession =
                    t?.copy?.accession_number ||
                    t?.accession_number ||
                    '—'
                  // The service includes `book.title` on every
                  // row. Show it under the accession number so
                  // staff can scan the table without cross-
                  // referencing another screen.
                  const bookTitle = t?.book?.title || null
                  const borrowed = t?.borrow_date || t?.created_at
                  const returned = t?.return_date
                  return (
                    <tr key={t.transaction_id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">
                        <div className="font-mono text-gray-800">
                          {accession}
                        </div>
                        {bookTitle && (
                          <div
                            className="text-xs text-gray-500 mt-0.5 truncate max-w-[280px]"
                            title={bookTitle}
                          >
                            {bookTitle}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {borrowed ? formatDate(borrowed) : '—'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {returned ? formatDate(returned) : '—'}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {getStatusBadge(t.status)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination — 10 per page */}
        <div className="px-5 py-3 border-t bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs text-gray-600">
            {totalRows === 0
              ? '0 results'
              : `Showing ${(page - 1) * itemsPerPage + 1}–${Math.min(
                  page * itemsPerPage,
                  totalRows
                )} of ${totalRows} record${totalRows === 1 ? '' : 's'} · 10 per page`}
          </p>
          {totalServerPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="fas fa-chevron-left"></i>
                Prev
              </button>
              <span className="text-xs text-gray-700 px-2">
                Page {page} of {totalServerPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPage((p) => Math.min(totalServerPages, p + 1))
                }
                disabled={page === totalServerPages}
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

// ============================================================
// Fines Quick-View Modal
// ------------------------------------------------------------
// Self-contained modal with two tabs:
//   - Summary  : outstanding book + locker fines, counts,
//                and the per-row breakdown. Sourced from
//                /api/overdue/user-summary/[user_id].
//   - History  : every settlement row, most recent first,
//                10 per page. Sourced from the dedicated
//                /api/overdue/user-history/[user_id] endpoint.
// ============================================================
type FinesTab = 'summary' | 'history'

function FinesQuickViewModal({
  user,
  onClose
}: {
  user: { user_id: number; full_name: string; account_id: string }
  onClose: () => void
}) {
  const [tab, setTab] = useState<FinesTab>('summary')

  // Summary tab — full snapshot, fetched once.
  const summaryKey = `/api/overdue/user-summary/${user.user_id}`
  const {
    data: summaryResponse,
    isLoading: summaryLoading,
    error: summaryError
  } = useApiSWR<any>(summaryKey, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 1000
  })

  // History tab — server-side paginated, 10 per page,
  // ordered by created_at DESC.
  const [historyPage, setHistoryPage] = useState(1)
  const historyLimit = 10
  const historyKey = useMemo(
    () =>
      `/api/overdue/user-history/${user.user_id}` +
      `?page=${historyPage}&limit=${historyLimit}`,
    [user.user_id, historyPage]
  )
  const {
    data: historyResponse,
    isLoading: historyLoading,
    error: historyError
  } = useApiSWR<any>(historyKey, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 1000
  })

  // The /api/overdue/user-summary endpoint wraps its
  // payload in `data`, so we read through that layer.
  const summary = (summaryResponse as any)?.data
  const summaryTotals = summary?.summary || {
    total_book_penalties: 0,
    total_locker_penalties: 0,
    total_penalties: 0,
    book_count: 0,
    locker_count: 0,
    total_count: 0
  }
  const bookPenalties: any[] = summary?.book_penalties || []
  const lockerPenalties: any[] = summary?.locker_penalties || []

  const historyRows: any[] = useMemo(() => {
    if (!historyResponse) return []
    const d: any = historyResponse
    if (Array.isArray(d)) return d
    if (Array.isArray(d.data)) return d.data
    if (Array.isArray(d.settlements)) return d.settlements
    return []
  }, [historyResponse])

  const historyPagination = (historyResponse as any)?.pagination
  const historyTotal: number =
    typeof historyPagination?.total === 'number'
      ? historyPagination.total
      : historyRows.length
  const historyTotalPages: number =
    typeof historyPagination?.totalPages === 'number'
      ? historyPagination.totalPages
      : Math.max(1, Math.ceil(historyTotal / historyLimit))
  const safeHistoryPage = Math.min(historyPage, historyTotalPages || 1)

  // Status pill (reused by the History tab).
  const getSettlementStatusBadge = (status: string, voided: boolean) => {
    if (voided) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
          VOIDED
        </span>
      )
    }
    const map: Record<string, string> = {
      SETTLED: 'bg-green-100 text-green-800',
      PENDING: 'bg-red-100 text-red-800',
      PARTIAL: 'bg-yellow-100 text-yellow-800'
    }
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          map[status] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {status}
      </span>
    )
  }

  // Render via portal at the document body level so the
  // overlay is never clipped or constrained by an ancestor.
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
          className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh] min-h-[600px]"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <i className="fas fa-receipt text-rose-600"></i>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 truncate">
                Fines Quick View
              </h2>
              <p className="text-xs text-gray-500 truncate">
                {user.full_name} ·{' '}
                <span className="font-mono">{user.account_id}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Close"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 border-b bg-gray-50">
          <div className="flex items-center gap-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'summary'}
              onClick={() => setTab('summary')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === 'summary'
                  ? 'border-rose-600 text-rose-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className="fas fa-chart-pie text-xs"></i>
              Summary
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'history'}
              onClick={() => setTab('history')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === 'history'
                  ? 'border-rose-600 text-rose-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className="fas fa-clock-rotate-left text-xs"></i>
              History
              {historyTotal > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-gray-200 text-gray-700">
                  {historyTotal}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'summary' ? (
            <FinesSummaryTab
              loading={summaryLoading}
              error={summaryError}
              totals={summaryTotals}
              bookPenalties={bookPenalties}
              lockerPenalties={lockerPenalties}
            />
          ) : (
            <FinesHistoryTab
              loading={historyLoading}
              error={historyError}
              rows={historyRows}
              page={safeHistoryPage}
              total={historyTotal}
              totalPages={historyTotalPages}
              onPageChange={setHistoryPage}
              getSettlementStatusBadge={getSettlementStatusBadge}
            />
          )}
        </div>
      </div>
      </div>
    </div>,
    document.body
  )
}

// ----- Fines Summary tab -----
function FinesSummaryTab({
  loading,
  error,
  totals,
  bookPenalties,
  lockerPenalties
}: {
  loading: boolean
  error: any
  totals: {
    total_book_penalties: number
    total_locker_penalties: number
    total_penalties: number
    book_count: number
    locker_count: number
    total_count: number
  }
  bookPenalties: any[]
  lockerPenalties: any[]
}) {
  if (loading) {
    return (
      <div className="p-10 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
        <p className="text-sm text-gray-500">Loading fines summary…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-10 text-center text-gray-500">
        <i className="fas fa-triangle-exclamation text-3xl text-red-400 mb-2"></i>
        <p className="text-sm text-red-600">Failed to load fines summary.</p>
      </div>
    )
  }

  const hasAny = totals.total_count > 0

  if (!hasAny) {
    return (
      <div className="p-10 text-center text-gray-500">
        <i className="fas fa-circle-check text-4xl text-green-400 mb-3"></i>
        <p className="text-sm font-medium text-gray-700">No outstanding fines</p>
        <p className="text-xs text-gray-500 mt-1">
          This user has no book or locker fines on record.
        </p>
      </div>
    )
  }

  return (
    <div className="p-5 space-y-5">
      {/* Aggregate cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard
          label="Book fines"
          icon="fa-book"
          iconColor="text-amber-600"
          amount={totals.total_book_penalties}
          count={totals.book_count}
        />
        <SummaryCard
          label="Locker fines"
          icon="fa-key"
          iconColor="text-blue-600"
          amount={totals.total_locker_penalties}
          count={totals.locker_count}
        />
        <SummaryCard
          label="Total outstanding"
          icon="fa-coins"
          iconColor="text-rose-600"
          amount={totals.total_penalties}
          count={totals.total_count}
          highlight
        />
      </div>

      {/* Per-item breakdown */}
      {(bookPenalties.length > 0 || lockerPenalties.length > 0) && (
        <div className="space-y-4">
          {bookPenalties.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Book fines ({bookPenalties.length})
              </h3>
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md">
                {bookPenalties.map((p) => (
                  <li
                    key={`book-${p.transaction_id}`}
                    className="flex items-start justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {p.item_name || 'Unknown book'}
                      </div>
                      {p.item_author && (
                        <div className="text-xs text-gray-500 truncate">
                          {p.item_author}
                        </div>
                      )}
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {p.due_date
                          ? `Due ${formatDate(p.due_date)}`
                          : ''}
                        {p.return_date
                          ? ` · Returned ${formatDate(p.return_date)}`
                          : p.is_returned
                            ? ''
                            : ' · Not yet returned'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-gray-900">
                        {formatCurrency(p.remaining_balance || 0)}
                      </div>
                      {Number(p.penalty_amount) > Number(p.amount_paid) && (
                        <div className="text-[11px] text-gray-500">
                          of {formatCurrency(p.penalty_amount)}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {lockerPenalties.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Locker fines ({lockerPenalties.length})
              </h3>
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md">
                {lockerPenalties.map((p) => (
                  <li
                    key={`locker-${p.transaction_id}`}
                    className="flex items-start justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        Locker {p.item_name || '—'}
                      </div>
                      {p.item_location && (
                        <div className="text-xs text-gray-500 truncate">
                          {p.item_location}
                        </div>
                      )}
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {p.borrow_time
                          ? `Borrowed ${formatDate(p.borrow_time)}`
                          : ''}
                        {p.return_time
                          ? ` · Returned ${formatDate(p.return_time)}`
                          : p.is_returned
                            ? ''
                            : ' · Not yet returned'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-gray-900">
                        {formatCurrency(p.remaining_balance || 0)}
                      </div>
                      {Number(p.penalty_amount) > Number(p.amount_paid) && (
                        <div className="text-[11px] text-gray-500">
                          of {formatCurrency(p.penalty_amount)}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  icon,
  iconColor,
  amount,
  count,
  highlight
}: {
  label: string
  icon: string
  iconColor: string
  amount: number
  count: number
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight
          ? 'border-rose-200 bg-rose-50'
          : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-2">
        <i className={`fas ${icon} ${iconColor}`}></i>
        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div
        className={`mt-1 text-2xl font-bold ${
          highlight ? 'text-rose-700' : 'text-gray-900'
        }`}
      >
        {formatCurrency(amount || 0)}
      </div>
      <div className="text-[11px] text-gray-500 mt-0.5">
        {count} {count === 1 ? 'item' : 'items'}
      </div>
    </div>
  )
}

// ----- Fines History tab -----
function FinesHistoryTab({
  loading,
  error,
  rows,
  page,
  total,
  totalPages,
  onPageChange,
  getSettlementStatusBadge
}: {
  loading: boolean
  error: any
  rows: any[]
  page: number
  total: number
  totalPages: number
  onPageChange: (p: number) => void
  getSettlementStatusBadge: (status: string, voided: boolean) => React.ReactElement
}) {
  if (loading) {
    return (
      <div className="p-10 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
        <p className="text-sm text-gray-500">Loading settlement history…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-10 text-center text-gray-500">
        <i className="fas fa-triangle-exclamation text-3xl text-red-400 mb-2"></i>
        <p className="text-sm text-red-600">Failed to load settlement history.</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="p-10 text-center text-gray-500">
        <i className="fas fa-folder-open text-4xl text-gray-300 mb-3"></i>
        <p className="text-sm font-medium text-gray-700">No settlement history</p>
        <p className="text-xs text-gray-500 mt-1">
          This user has no fine transactions on record.
        </p>
      </div>
    )
  }

  return (
    <>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Item
            </th>
            <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Penalty
            </th>
            <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Paid
            </th>
            <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Balance
            </th>
            <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rows.map((r) => {
            const t = r.transaction_details || {}
            const itemName =
              t.type === 'LOCKER'
                ? `Locker ${t.locker_number || '—'}`
                : t.book_title || '—'
            const itemSub =
              t.type === 'LOCKER'
                ? t.locker_location || ''
                : t.book_author || t.accession_number
                  ? [
                      t.book_author || null,
                      t.accession_number ? `Acc. ${t.accession_number}` : null
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : ''
            return (
              <tr key={r.settlement_id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                  {r.created_at ? formatDate(r.created_at) : '—'}
                </td>
                <td className="px-4 py-2 text-sm">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      t.type === 'LOCKER'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {t.type === 'LOCKER' ? 'Locker' : 'Book'}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm">
                  <div
                    className="font-medium text-gray-900 truncate max-w-[260px]"
                    title={itemName}
                  >
                    {itemName}
                  </div>
                  {itemSub && (
                    <div
                      className="text-xs text-gray-500 truncate max-w-[260px]"
                      title={itemSub}
                    >
                      {itemSub}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-sm text-right text-gray-900 whitespace-nowrap">
                  {formatCurrency(r.penalty_amount || 0)}
                </td>
                <td className="px-4 py-2 text-sm text-right text-green-700 whitespace-nowrap">
                  {formatCurrency(r.amount_paid || 0)}
                </td>
                <td className="px-4 py-2 text-sm text-right font-semibold whitespace-nowrap">
                  <span
                    className={
                      Number(r.remaining_balance) > 0
                        ? 'text-rose-700'
                        : 'text-gray-500'
                    }
                  >
                    {formatCurrency(r.remaining_balance || 0)}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm">
                  {getSettlementStatusBadge(r.status, !!r.voided)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Pagination — 10 per page, mirrors the borrowing-
          history footer for consistency. */}
      <div className="px-5 py-3 border-t bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-xs text-gray-600">
          {total === 0
            ? '0 results'
            : `Showing ${(page - 1) * 10 + 1}–${Math.min(
                page * 10,
                total
              )} of ${total} record${total === 1 ? '' : 's'} · 10 per page`}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="fas fa-chevron-left"></i>
              Prev
            </button>
            <span className="text-xs text-gray-700 px-2">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <i className="fas fa-chevron-right ml-1"></i>
            </button>
          </div>
        )}
      </div>
    </>
  )
}
