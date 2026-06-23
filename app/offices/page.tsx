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

interface Office {
  office_id: number
  name: string
  code: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
  archived_at?: string
}

export default function OfficesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Build API URL with filters
  const buildApiUrl = () => {
    const params = new URLSearchParams()
    if (searchQuery) params.append('query', searchQuery)
    return `/api/offices?${params.toString()}`
  }

  // SWR for offices with real-time updates
  const { 
    data: officesResponse, 
    error: officesError, 
    isLoading: officesLoading,
    mutate: refreshOffices 
  } = useApiSWR<any>(buildApiUrl(), {
    refreshInterval: 5000, // Real-time updates every 5 seconds
    revalidateOnFocus: true,
    revalidateOnReconnect: true
  })

  // Handle different response formats from the API
  const offices = React.useMemo(() => {
    if (!officesResponse) return []
    
    // Handle different API response formats
    if (Array.isArray(officesResponse)) {
      return officesResponse
    }
    
    // Check for nested data structures
    const officeData = officesResponse.offices || 
                     officesResponse.data?.offices || 
                     officesResponse.data || 
                     []
    
    return Array.isArray(officeData) ? officeData : []
  }, [officesResponse])

  // Refetch when search changes
  useEffect(() => {
    refreshOffices()
  }, [searchQuery, refreshOffices])

  // Filter and paginate offices
  const filteredOffices = offices.filter(office => {
    const matchesSearch = office.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         office.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (office.description?.toLowerCase().includes(searchQuery.toLowerCase()) || false)
    
    return matchesSearch
  })

  // Pagination calculations
  const totalPages = Math.ceil(filteredOffices.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedOffices = filteredOffices.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1)
  }

  const handleToggleStatus = async (officeId: number, currentStatus: boolean, officeName: string) => {
    const action = currentStatus ? 'deactivate' : 'activate'
    const confirmed = window.confirm(`Are you sure you want to ${action} this office?`)
    
    if (!confirmed) return

    try {
      const response = await fetch(`/api/offices/${officeId}`, {
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
          `Office "${officeName}" has been ${currentStatus ? 'deactivated' : 'activated'} successfully`
        )
        refreshOffices()
      } else {
        const errorData = await response.json()
        await notify.error('Error', errorData.error || `Failed to ${action} office`)
      }
    } catch (error) {
      console.error(`Error ${action}ing office:`, error)
      await notify.error('Error', `Network error occurred while ${action}ing office`)
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
          <h1 className="text-3xl font-bold text-gray-900">Offices</h1>
          <p className="text-gray-600 mt-1">
            Manage administrative offices
          </p>
        </div>
        <Button onClick={() => router.push('/offices/add')} className=' bg-primary-600 px-4 py-5 text-white hover:bg-primary-700'>
          <i className="fas fa-plus mr-2" />
          Add Office
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Offices</CardTitle>
            <div className="flex items-center space-x-4">
              <Input
                placeholder="Search offices..."
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
          {officesLoading ? (
            <div className="text-center py-8">
              <LoadingScreen message="Loading offices..." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOffices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      {searchQuery ? 'No offices found matching your search.' : 'No offices found. Add your first office to get started.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedOffices.map((office) => (
                    <TableRow key={office.office_id}>
                      <TableCell className="font-medium">{office.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{office.code}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {office.description || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={office.is_active ? 'success' : 'default'}>
                          {office.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(office.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className='bg-orange-500 hover:bg-orange-600 text-white px-2 py-4'
                            onClick={() => router.push(`/offices/${office.office_id}/edit`)}
                            title="Edit Office"
                          >
                            <i className="fas fa-edit" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className='bg-primary-600 hover:bg-primary-700 text-white px-2 py-4'
                            onClick={() => router.push(`/offices/${office.office_id}`)}
                            title="View Office"
                          >
                            <i className="fas fa-eye" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleStatus(office.office_id, office.is_active, office.name)}
                            title={office.is_active ? 'Deactivate Office' : 'Activate Office'}
                            className={office.is_active 
                              ? 'text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-4 !border-red-600' 
                              : 'text-green-600 hover:text-green-700 hover:bg-green-50 px-2 py-4 !border-green-600'}
                          >
                            <i className={`fas ${office.is_active ? 'fa-times-circle' : 'fa-check-circle'}`} />
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
      {!officesLoading && filteredOffices.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredOffices.length}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          className="mt-4"
        />
      )}

    </div>
  )
}

