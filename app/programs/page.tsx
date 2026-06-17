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

interface Program {
  program_id: number
  name: string
  code: string
  description?: string
  department_id: number
  department?: {
    name: string
    code: string
  }
  is_active: boolean
  created_at: string
  updated_at: string
  user_count?: number
}

interface Department {
  department_id: number
  name: string
  code: string
  description?: string
  is_active: boolean
}

export default function ProgramsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Build API URL with filters
  const buildApiUrl = () => {
    const params = new URLSearchParams()
    if (searchQuery) params.append('query', searchQuery)
    if (departmentFilter) params.append('departmentId', departmentFilter)
    return `/api/programs?${params.toString()}`
  }

  // SWR for programs with real-time updates
  const { 
    data: programsResponse, 
    error: programsError, 
    isLoading: programsLoading,
    mutate: refreshPrograms 
  } = useApiSWR<any>(buildApiUrl(), {
    refreshInterval: 5000, // Real-time updates every 5 seconds
    revalidateOnFocus: true,
    revalidateOnReconnect: true
  })

  // SWR for departments
  const { 
    data: departmentsResponse, 
    error: departmentsError, 
    isLoading: departmentsLoading 
  } = useApiSWR<any>('/api/departments', {
    refreshInterval: 30000, // Refresh every 30 seconds
    revalidateOnFocus: true,
    revalidateOnReconnect: true
  })

  // Handle different response formats from the API
  const programs = React.useMemo(() => {
    if (!programsResponse) return []
    
    // Handle different API response formats
    if (Array.isArray(programsResponse)) {
      return programsResponse
    }
    
    // Check for nested data structures
    const programData = programsResponse.programs || 
                       programsResponse.data?.programs || 
                       programsResponse.data || 
                       []
    
    return Array.isArray(programData) ? programData : []
  }, [programsResponse])

  // Handle different response formats for departments
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

  // Refetch when filters change
  useEffect(() => {
    refreshPrograms()
  }, [searchQuery, departmentFilter, refreshPrograms])

  // Filter and paginate programs
  const filteredPrograms = programs.filter((program: any) => {
    const matchesSearch = program.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         program.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (program.department?.name.toLowerCase().includes(searchQuery.toLowerCase()) || false)
    
    const matchesDepartment = !departmentFilter || program.department_id.toString() === departmentFilter
    
    return matchesSearch && matchesDepartment
  })

  // Pagination calculations
  const totalPages = Math.ceil(filteredPrograms.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedPrograms = filteredPrograms.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1)
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
          <h1 className="text-3xl font-bold text-gray-900">Programs</h1>
          <p className="text-gray-600 mt-1">Manage academic programs</p>
        </div>
        <Button 
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => router.push('/programs/add')}
        >
          <i className="fas fa-plus mr-2" />
          Add Program
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Programs
              </label>
              <Input
                type="text"
                placeholder="Search by name, code, or department..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Department
              </label>
              <select
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Departments</option>
                {departments.map((dept: any) => (
                  <option key={dept.department_id} value={dept.department_id.toString()}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Items per page
              </label>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Programs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Programs ({filteredPrograms.length})</span>
            {programsLoading && (
              <div className="flex items-center text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Loading...
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {programsLoading ? (
            <div className="text-center py-8">
              <LoadingScreen message="Loading programs..." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Program</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPrograms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No programs found. Add your first program to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedPrograms.map((program: any) => (
                    <TableRow key={program.program_id}>
                      <TableCell className="font-medium">{program.name}</TableCell>
                      <TableCell>{program.code}</TableCell>
                      <TableCell>
                        {program.department ? (
                          <span className="text-sm text-gray-600">
                            {program.department.name} ({program.department.code})
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">No department</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {program.user_count || 0} users
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={program.is_active ? 'success' : 'default'}>
                          {program.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(program.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/programs/${program.program_id}`)}
                            title="See Details"
                          >
                            <i className="fas fa-eye mr-1" />
                            <span className="text-xs">Details</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/programs/${program.program_id}/edit`)}
                            title="Edit Program"
                          >
                            <i className="fas fa-edit" />
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
      {!programsLoading && filteredPrograms.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredPrograms.length}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          className="mt-4"
        />
      )}
    </div>
  )
}
