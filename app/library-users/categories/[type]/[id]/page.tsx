'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import * as XLSX from 'xlsx'
import { notify } from '@/lib/notification'

interface User {
  user_id: number
  account_id: string
  full_name: string
  email: string | null
  contact_number: string | null
  user_type: string
  section?: { name: string } | null
  program?: { name: string; code: string } | null
  department_ref?: { name: string; code: string } | null
  grade_level?: { name: string; code: string } | null
  strand?: { name: string; abbreviation: string } | null
  office_ref?: { name: string; code: string } | null
  status: string
  created_at: string
}

interface CategoryInfo {
  name: string
  code?: string
  abbreviation?: string
}

export default function CategoryDetailsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const type = params?.type as string
  const id = params?.id as string

  const [users, setUsers] = useState<User[]>([])
  const [categoryInfo, setCategoryInfo] = useState<CategoryInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [exporting, setExporting] = useState(false)

  // Get category type labels
  const categoryTypeLabels: Record<string, { singular: string; plural: string; icon: string }> = {
    'section': { singular: 'Section', plural: 'Sections', icon: 'fa-users' },
    'program': { singular: 'Program', plural: 'Programs', icon: 'fa-graduation-cap' },
    'department': { singular: 'Department', plural: 'Departments', icon: 'fa-building' },
    'grade-level': { singular: 'Grade Level', plural: 'Grade Levels', icon: 'fa-layer-group' },
    'strand': { singular: 'Strand', plural: 'Strands', icon: 'fa-bookmark' }
  }

  const categoryLabel = categoryTypeLabels[type] || { singular: 'Category', plural: 'Categories', icon: 'fa-tag' }

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // Fetch users for this category
  useEffect(() => {
    if (!id || !type) return

    const fetchData = async () => {
      setLoading(true)
      try {
        // Map type to API endpoint
        const apiEndpointMap: Record<string, string> = {
          'section': `/api/student-sections/${id}/users`,
          'program': `/api/programs/${id}/users`,
          'department': `/api/departments/${id}/users`,
          'grade-level': `/api/grade-levels/${id}/users`,
          'strand': `/api/strands/${id}/users`
        }

        const apiEndpoint = apiEndpointMap[type]
        if (!apiEndpoint) {
          notify.error('Invalid category type')
          router.push('/library-users/categories')
          return
        }

        // Fetch users from dedicated endpoint
        const usersResponse = await fetch(apiEndpoint, {
          credentials: 'include'
        })

        if (!usersResponse.ok) {
          throw new Error('Failed to fetch users')
        }

        const usersList = await usersResponse.json()
        setUsers(Array.isArray(usersList) ? usersList : [])

        // Extract category info from first user
        if (usersList.length > 0) {
          const firstUser = usersList[0]
          switch (type) {
            case 'section':
              if (firstUser.section) {
                setCategoryInfo({
                  name: firstUser.section.name
                })
              }
              break
            case 'program':
              if (firstUser.program) {
                setCategoryInfo({
                  name: firstUser.program.name,
                  code: firstUser.program.code
                })
              }
              break
            case 'department':
              if (firstUser.department_ref) {
                setCategoryInfo({
                  name: firstUser.department_ref.name,
                  code: firstUser.department_ref.code
                })
              }
              break
            case 'grade-level':
              if (firstUser.grade_level) {
                setCategoryInfo({
                  name: firstUser.grade_level.name,
                  code: firstUser.grade_level.code
                })
              }
              break
            case 'strand':
              if (firstUser.strand) {
                setCategoryInfo({
                  name: firstUser.strand.name,
                  abbreviation: firstUser.strand.abbreviation
                })
              }
              break
          }
        }

      } catch (error) {
        console.error('Error fetching data:', error)
        notify.error('Failed to load category details')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id, type, router])

  // Real-time search filtering
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users

    const query = searchQuery.toLowerCase()
    return users.filter(user => 
      user.account_id?.toLowerCase().includes(query) ||
      user.full_name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.contact_number?.toLowerCase().includes(query) ||
      user.user_type?.toLowerCase().includes(query)
    )
  }, [users, searchQuery])

  // Export to Excel
  const handleExport = async () => {
    if (filteredUsers.length === 0) {
      notify.error('No data to export')
      return
    }

    setExporting(true)
    try {
      // Prepare data for export
      const exportData = filteredUsers.map((user, index) => ({
        'No.': index + 1,
        'ID Number': user.account_id || '',
        'Name': user.full_name || '',
        'Email': user.email || '',
        'Contact Number': user.contact_number || '',
        'User Type': user.user_type || '',
        'Section': user.section?.name || '',
        'Program': user.program?.name || '',
        'Department': user.department_ref?.name || '',
        'Grade Level': user.grade_level?.name || '',
        'Strand': user.strand?.name || '',
        'Office': user.office_ref?.name || '',
        'Status': user.status || '',
        'Created At': user.created_at ? new Date(user.created_at).toLocaleString() : ''
      }))

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Users')

      // Auto-size columns
      const maxWidth = 50
      const colWidths = Object.keys(exportData[0] || {}).map(key => {
        const maxLength = Math.max(
          key.length,
          ...exportData.map(row => String(row[key as keyof typeof row] || '').length)
        )
        return { wch: Math.min(maxLength + 2, maxWidth) }
      })
      ws['!cols'] = colWidths

      // Generate filename
      const categoryName = categoryInfo?.name || 'Category'
      const filename = `${categoryLabel.singular}_${categoryName.replace(/[^a-z0-9]/gi, '_')}_Users_${new Date().toISOString().split('T')[0]}.xlsx`

      // Download file
      XLSX.writeFile(wb, filename)
      notify.success('Users exported successfully')
    } catch (error) {
      console.error('Export error:', error)
      notify.error('Failed to export users')
    } finally {
      setExporting(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="px-6 py-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Loading...</div>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  const userRole = (session?.user as any)?.role
  if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
    return (
      <div className="px-6 py-4">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">You do not have permission to access this page.</p>
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
            <div>
              <h1 className="text-xl font-semibold text-gray-800 flex items-center">
                <i className={`fas ${categoryLabel.icon} text-blue-600 mr-3`}></i>
                {categoryInfo?.name || 'Category Details'}
                {categoryInfo?.code && (
                  <span className="ml-2 text-sm font-normal text-gray-500">({categoryInfo.code})</span>
                )}
                {categoryInfo?.abbreviation && (
                  <span className="ml-2 text-sm font-normal text-gray-500">({categoryInfo.abbreviation})</span>
                )}
              </h1>
              <nav className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                <button 
                  onClick={() => router.push('/library-users')}
                  className="hover:text-gray-700"
                >
                  Library Users
                </button>
                <i className="fas fa-chevron-right text-xs"></i>
                <button 
                  onClick={() => router.push('/library-users/categories')}
                  className="hover:text-gray-700"
                >
                  Categories
                </button>
                <i className="fas fa-chevron-right text-xs"></i>
                <span className="text-gray-900 font-medium">{categoryLabel.singular} Details</span>
              </nav>
            </div>
            <button
              onClick={() => router.push('/library-users/categories')}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <i className="fas fa-arrow-left mr-2"></i>
              Back to Categories
            </button>
          </div>
        </div>
      </div>

      {/* Stats and Actions Bar */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="bg-white rounded-lg px-4 py-3 shadow-sm border border-blue-200">
                <div className="text-sm text-gray-600">Total Users</div>
                <div className="text-2xl font-bold text-blue-600">{users.length}</div>
              </div>
              {searchQuery && (
                <div className="bg-white rounded-lg px-4 py-3 shadow-sm border border-green-200">
                  <div className="text-sm text-gray-600">Filtered Results</div>
                  <div className="text-2xl font-bold text-green-600">{filteredUsers.length}</div>
                </div>
              )}
            </div>
            <button
              onClick={handleExport}
              disabled={exporting || filteredUsers.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              {exporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Exporting...
                </>
              ) : (
                <>
                  <i className="fas fa-file-excel mr-2"></i>
                  Export to Excel
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-6 py-4 bg-white border-b">
        <div className="max-w-2xl">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-gray-400"></i>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID number, name, email, contact number, or user type..."
              className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="px-6 py-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              {searchQuery ? (
                <>
                  <i className="fas fa-search text-4xl text-gray-300 mb-3"></i>
                  <p className="text-gray-600">No users found matching "{searchQuery}"</p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-3 text-blue-600 hover:text-blue-700 text-sm"
                  >
                    Clear search
                  </button>
                </>
              ) : (
                <>
                  <i className="fas fa-users text-4xl text-gray-300 mb-3"></i>
                  <p className="text-gray-600">No users in this {categoryLabel.singular.toLowerCase()}</p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user, index) => (
                    <tr key={user.user_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.account_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.email || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.contact_number || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {user.user_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.status === 'ACTIVE' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => router.push(`/library-users/${user.user_id}`)}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm"
                        >
                          <i className="fas fa-eye mr-1.5"></i>
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
