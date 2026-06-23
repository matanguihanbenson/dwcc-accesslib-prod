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
  year_level?: string | null
  rfid_code?: string | null
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

  // Comprehensive filters — work the same way as on
  // `/library-users` so the user can drill into a
  // category and further narrow by status / user type /
  // year level without losing the category context.
  const [userTypeFilter, setUserTypeFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [yearLevelFilter, setYearLevelFilter] = useState<string>('')

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

  // Real-time search filtering + comprehensive filter set.
  // The dependency array MUST include every filter state
  // value — otherwise the memo would be stale when the user
  // picks a new dropdown value (we hit this bug on
  // `/library-users` and applied the same fix here).
  const filteredUsers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    return users.filter(user => {
      const matchesSearch = !query || (
        user.account_id?.toLowerCase().includes(query) ||
        user.full_name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.contact_number?.toLowerCase().includes(query) ||
        user.user_type?.toLowerCase().includes(query)
      )
      const matchesType = !userTypeFilter || user.user_type === userTypeFilter
      const matchesStatus = !statusFilter || user.status === statusFilter
      const matchesYearLevel =
        !yearLevelFilter || user.year_level === yearLevelFilter
      return matchesSearch && matchesType && matchesStatus && matchesYearLevel
    })
  }, [users, searchQuery, userTypeFilter, statusFilter, yearLevelFilter])

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
  // Category details follow the same access rule as the
  // main Categories index — SUPER_ADMIN, ADMIN, and STAFF.
  if (
    userRole !== 'SUPER_ADMIN' &&
    userRole !== 'ADMIN' &&
    userRole !== 'STAFF'
  ) {
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
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {(() => {
              // Derive summary metrics from the unfiltered
              // user list so the cards stay stable as the
              // user types in the search box.
              const students = users.filter((u) => u.user_type === 'STUDENT').length
              const employees = users.filter((u) => u.user_type === 'EMPLOYEE').length
              const alumni = users.filter((u) => u.user_type === 'ALUMNI').length
              const guests = users.filter((u) => u.user_type === 'GUEST').length
              const active = users.filter((u) => u.status === 'ACTIVE').length
              const inactive = users.filter(
                (u) => u.status === 'INACTIVE' || u.status === 'SUSPENDED'
              ).length
              const withRfid = users.filter(
                (u) => (u as any).rfid_code
              ).length

              const cards: Array<{
                label: string
                value: number | string
                color: string
                icon: string
                ring: string
              }> = [
                {
                  label: 'Total Users',
                  value: users.length,
                  color: 'text-blue-700',
                  icon: 'fa-users',
                  ring: 'border-blue-200'
                },
                {
                  label: 'Students',
                  value: students,
                  color: 'text-blue-700',
                  icon: 'fa-user-graduate',
                  ring: 'border-blue-200'
                },
                {
                  label: 'Employees',
                  value: employees,
                  color: 'text-emerald-700',
                  icon: 'fa-user-tie',
                  ring: 'border-emerald-200'
                },
                {
                  label: 'Alumni',
                  value: alumni,
                  color: 'text-purple-700',
                  icon: 'fa-user-graduate',
                  ring: 'border-purple-200'
                },
                {
                  label: 'Guests',
                  value: guests,
                  color: 'text-gray-700',
                  icon: 'fa-user-clock',
                  ring: 'border-gray-200'
                },
                {
                  label: 'Active',
                  value: active,
                  color: 'text-green-700',
                  icon: 'fa-circle-check',
                  ring: 'border-green-200'
                },
                {
                  label: 'Inactive / Suspended',
                  value: inactive,
                  color: 'text-amber-700',
                  icon: 'fa-circle-pause',
                  ring: 'border-amber-200'
                },
                {
                  label: 'RFID Bound',
                  value: `${withRfid} / ${users.length}`,
                  color: 'text-sky-700',
                  icon: 'fa-id-card',
                  ring: 'border-sky-200'
                }
              ]

              return (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-3 flex-1">
                  {cards.map((c) => (
                    <div
                      key={c.label}
                      className={`bg-white rounded-lg px-4 py-3 shadow-sm border ${c.ring} flex items-center gap-3`}
                    >
                      <div className={`w-9 h-9 rounded-md bg-gray-50 flex items-center justify-center ${c.color}`}>
                        <i className={`fas ${c.icon} text-sm`}></i>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider truncate">
                          {c.label}
                        </div>
                        <div className={`text-xl font-bold ${c.color} leading-tight`}>
                          {c.value}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}

            <button
              onClick={handleExport}
              disabled={exporting || filteredUsers.length === 0}
              className="self-start lg:self-auto px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center shrink-0"
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

      {/* Search Bar + Comprehensive Filters */}
      <div className="px-6 py-4 bg-white border-b">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative w-full lg:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-gray-400"></i>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID number, name, email, contact, or user type…"
              className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>

          {/* Comprehensive filter dropdowns sit next to the
              search input so the user can layer filters in
              one place. The dependency array on the
              `filteredUsers` memo above includes every
              state value here, so picking a new dropdown
              value re-runs the filter immediately. */}
          <select
            value={userTypeFilter}
            onChange={(e) => setUserTypeFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">All Types</option>
            <option value="STUDENT">Students</option>
            <option value="EMPLOYEE">Employees</option>
            <option value="ALUMNI">Alumni</option>
            <option value="GUEST">Guests</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          <select
            value={yearLevelFilter}
            onChange={(e) => setYearLevelFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">All Year Levels</option>
            <option value="1st Year">1st Year</option>
            <option value="2nd Year">2nd Year</option>
            <option value="3rd Year">3rd Year</option>
            <option value="4th Year">4th Year</option>
            <option value="Graduate">Graduate</option>
            <option value="N/A">N/A</option>
          </select>

          {(userTypeFilter || statusFilter || yearLevelFilter || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setUserTypeFilter('')
                setStatusFilter('')
                setYearLevelFilter('')
                setSearchQuery('')
              }}
              className="inline-flex items-center gap-1 px-3 py-2.5 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors"
            >
              <i className="fas fa-times"></i>
              Clear filters
            </button>
          )}
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
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        {/* Combined "User" column: user type
                            badge + full name (with RFID
                            indicator) + email + account ID.
                            Stacked so the row stays
                            scannable. */}
                        <div className="min-w-[280px]">
                          <div className="mb-1">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {user.user_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 truncate">
                              {user.full_name}
                            </span>
                            {(user as any).rfid_code ? (
                              <i
                                className="fas fa-check-circle text-green-600 text-xs shrink-0"
                                title={`RFID: ${(user as any).rfid_code}`}
                              ></i>
                            ) : null}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {user.email || '—'}
                          </div>
                          <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                            ID: {user.account_id}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.contact_number || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : user.status === 'SUSPENDED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
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
