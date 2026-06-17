'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingScreen } from '@/components/ui/loading-spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Pagination, PaginationControls } from '@/components/ui/pagination'
import { useApiSWR } from '@/lib/hooks/useApi'
import { UserRole } from '@/types'
import { formatDate } from '@/lib/utils'
import { notify } from '@/lib/notification'

interface Department {
  department_id: number
  name: string
  code: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
  archived_at?: string
  programs?: {
    program_id: number
    name: string
    code: string
  }[]
  user_count?: number
}

export default function DepartmentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Build API URL with filters
  const buildApiUrl = () => {
    const params = new URLSearchParams()
    if (searchQuery) params.append('query', searchQuery)
    return `/api/departments?${params.toString()}`
  }

  // SWR for departments with real-time updates
  const { 
    data: departmentsResponse, 
    error: departmentsError, 
    isLoading: departmentsLoading,
    mutate: refreshDepartments 
  } = useApiSWR<any>(buildApiUrl(), {
    refreshInterval: 5000, // Real-time updates every 5 seconds
    revalidateOnFocus: true,
    revalidateOnReconnect: true
  })

  // Handle different response formats from the API
  const departments = React.useMemo(() => {
    if (!departmentsResponse) return []
    
    // Handle different API response formats
    if (Array.isArray(departmentsResponse)) {
      return departmentsResponse
    }
    
    // Check for nested data structures
    const deptData = departmentsResponse.departments || 
                     departmentsResponse.data?.departments || 
                     departmentsResponse.data || 
                     []
    
    return Array.isArray(deptData) ? deptData : []
  }, [departmentsResponse])

  // Refetch when search changes
  useEffect(() => {
    refreshDepartments()
  }, [searchQuery, refreshDepartments])

  // Filter and paginate departments
  const filteredDepartments = departments.filter(department => {
    const matchesSearch = department.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         department.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (department.description?.toLowerCase().includes(searchQuery.toLowerCase()) || false)
    
    return matchesSearch
  })

  // Pagination calculations
  const totalPages = Math.ceil(filteredDepartments.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedDepartments = filteredDepartments.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1)
  }

  const handleToggleStatus = async (departmentId: number, currentStatus: boolean, departmentName: string) => {
    const action = currentStatus ? 'deactivate' : 'activate'
    const confirmed = window.confirm(`Are you sure you want to ${action} this department?`)
    
    if (!confirmed) return

    try {
      const response = await fetch(`/api/departments/${departmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          is_active: !currentStatus
        }),
      })

      if (response.ok) {
        await notify.success(
          'Success', 
          `Department "${departmentName}" has been ${currentStatus ? 'deactivated' : 'activated'} successfully`
        )
        refreshDepartments()
      } else {
        const errorData = await response.json()
        await notify.error('Error', errorData.error || `Failed to ${action} department`)
      }
    } catch (error) {
      console.error(`Error ${action}ing department:`, error)
      await notify.error('Error', `Network error occurred while ${action}ing department`)
    }
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Departments</h1>
          <p className="text-gray-600 mt-1">
            Manage academic departments and divisions
          </p>
        </div>
        <Button onClick={() => router.push('/departments/add')}>
          <i className="fas fa-plus mr-2" />
          Add Department
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Departments</CardTitle>
            <div className="flex items-center space-x-4">
              <Input
                placeholder="Search departments..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-64"
                icon={<i className="fas fa-search" />}
              />
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
        <CardContent>
          {departmentsLoading ? (
            <div className="text-center py-8">
              <LoadingScreen message="Loading departments..." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Programs</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDepartments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      {searchQuery ? 'No departments found matching your search.' : 'No departments found. Add your first department to get started.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedDepartments.map((department) => (
                    <TableRow key={department.department_id}>
                      <TableCell className="font-medium">{department.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{department.code}</Badge>
                      </TableCell>
                      <TableCell>
                        {department.programs?.length || 0} programs
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {department.user_count || 0} users
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={department.is_active ? 'success' : 'default'}>
                          {department.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(department.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/departments/${department.department_id}`)}
                            title="See Details"
                          >
                            <i className="fas fa-eye mr-1" />
                            <span className="text-xs">Details</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/departments/${department.department_id}/edit`)}
                            title="Edit Department"
                          >
                            <i className="fas fa-edit" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleStatus(department.department_id, department.is_active, department.name)}
                            title={department.is_active ? 'Deactivate Department' : 'Activate Department'}
                            className={department.is_active 
                              ? 'text-red-600 hover:text-red-700 hover:bg-red-50 border-red-600' 
                              : 'text-green-600 hover:text-green-700 hover:bg-green-50 border-green-600'}
                          >
                            <i className={`fas ${department.is_active ? 'fa-times-circle' : 'fa-check-circle'}`} />
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
      {!departmentsLoading && filteredDepartments.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredDepartments.length}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          className="mt-4"
        />
      )}

    </div>
  )
}
