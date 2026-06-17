'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { PasswordResetModal } from '@/components/modals/PasswordResetModal'
import { notify } from '@/lib/notification'
import { useApiSWR, useApi, API_ENDPOINTS } from '@/lib/hooks/useApi'
import { useCacheManager, createMutationHandler } from '@/lib/hooks/useCacheManager'
import { useUserStatus } from '@/lib/hooks'

interface User {
  id: number
  username: string
  role: string
  is_active: boolean
  user: {
    user_id: number
    full_name: string
    user_type: string
    email?: string
    course?: string
    year_level?: string
    department?: string
    rfid_code?: string | null
  }
}

function StaffAccounts() {
  const [authReady, setAuthReady] = useState(false)
  const { userRole } = useUserStatus()
  const { invalidateUserData } = useCacheManager()

  // Use SWR for real-time staff data
  const { 
    data: usersResponse, 
    error, 
    isLoading,
    mutate: refreshStaffUsers 
  } = useApiSWR<any>(
    authReady ? `${API_ENDPOINTS.STAFF_ACCOUNTS}` : null,
    {
      refreshInterval: 5000, // Real-time updates every 5 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 1000,
    }
  )

  // Handle the response format - API returns array directly
  const users = React.useMemo(() => {
    if (!usersResponse) return []
    
    // Handle different API response formats
    if (Array.isArray(usersResponse)) {
      return usersResponse
    }
    
    // Check for nested data structures
    const staffUsers = usersResponse.users || 
                      usersResponse.data?.users || 
                      usersResponse.data || 
                      []
    
    return Array.isArray(staffUsers) ? staffUsers : []
  }, [usersResponse])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showUserModal, setShowUserModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false)
  const [passwordResetUser, setPasswordResetUser] = useState<{id: number, name: string} | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [showRfidBindModal, setShowRfidBindModal] = useState(false)
  const [rfidBindUser, setRfidBindUser] = useState<{id: number, name: string, currentRfid: string | null} | null>(null)
  const [rfidInput, setRfidInput] = useState('')

  // Mutation hooks for staff operations
  const { execute: toggleStatus, loading: toggleLoading } = useApi({
    onSuccess: (data) => {
      notify.success('Success', data.message || 'Staff status updated successfully')
      // Delay refresh to allow database to update
      setTimeout(() => {
        refreshStaffUsers()
        invalidateUserData()
      }, 500)
    },
    onError: (error) => {
      console.error('Toggle status error:', error)
      notify.error('Error', error || 'Failed to update staff status')
    }
  })

  const [resetPasswordLoading, setResetPasswordLoading] = useState(false)

  useEffect(() => {
    // Middleware guards this route; once mounted, enable data fetching
    setAuthReady(true)
  }, [])

  // Manual refresh function
  const handleRefresh = () => {
    refreshStaffUsers()
    notify.info('Refreshing', 'Updating staff list...')
  }

  const handleToggleStatus = async (userId: number, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate'
    const confirmed = await notify.confirm(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Staff`,
      `Are you sure you want to ${action} this staff account?`
    )

    if (confirmed) {
      await toggleStatus(`/api/users/${userId}/toggle-status`, {
        method: 'PATCH',
      })
    }
  }

    const handleResetPassword = async (userId: number, fullName: string, newPassword: string) => {
    try {
      setResetPasswordLoading(true)
      
      const response = await fetch(`/api/users/${userId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ newPassword })
      })

      if (response.ok) {
        const data = await response.json()
        
        await notify.success(
          'Password Reset', 
          `Password reset successfully for ${fullName}. New password: "${newPassword}"`
        )
        
        // Refresh the data
        setTimeout(() => {
          refreshStaffUsers()
          invalidateUserData()
        }, 500)
      } else {
        const errorData = await response.json()
        await notify.error('Error', errorData.error || 'Failed to reset password')
      }
    } catch (error) {
      console.error('Error resetting password:', error)
      await notify.error('Error', 'Network error occurred')
    } finally {
      setResetPasswordLoading(false)
    }
  }

  const handleOpenPasswordResetModal = (userId: number, fullName: string) => {
    setPasswordResetUser({ id: userId, name: fullName })
    setShowPasswordResetModal(true)
  }

  const handleClosePasswordResetModal = () => {
    setShowPasswordResetModal(false)
    setPasswordResetUser(null)
  }

  const handleOpenEditModal = (user: User) => {
    setEditUser(user)
    setShowEditModal(true)
  }

  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setEditUser(null)
  }

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
        setTimeout(() => {
          refreshStaffUsers()
          invalidateUserData()
        }, 300)
      } else if (response.status === 409) {
        await notify.error(
          'RFID Already Bound',
          data.message || data.error || `This RFID is already assigned to another user.`
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
      `Are you sure you want to remove RFID binding from ${fullName}?`
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
        await notify.success(
          'RFID Unbound',
          `RFID has been removed from ${fullName}`
        )
        handleCloseRfidBindModal()
        setTimeout(() => {
          refreshStaffUsers()
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

  const handleViewUser = (user: User) => {
    setSelectedUser(user)
    setShowUserModal(true)
  }

  const handleCloseUserModal = () => {
    setSelectedUser(null)
    setShowUserModal(false)
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.user?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = !statusFilter || 
      (statusFilter === 'ACTIVE' && user.is_active === true) ||
      (statusFilter === 'INACTIVE' && user.is_active === false)

    return matchesSearch && matchesStatus
  })

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentUsers = filteredUsers.slice(startIndex, endIndex)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter])

  const getStatusBadgeColor = (is_active: boolean) => {
    return is_active
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800'
  }


  if (!authReady) {
    return (
      <div className="px-6 py-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Checking authentication...</div>
          </div>
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
            <h1 className="text-xl font-semibold text-gray-800">
              Staff Accounts
            </h1>
            <Link 
              href="/users/register" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Add New Staff
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Per Page</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={5}>5 per page</option>
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
              </div>
            </div>

            <div className="lg:w-80">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search staff by name, id, or email..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Staff Users Table */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="text-gray-500">Loading staff accounts...</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Staff User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        {searchTerm || statusFilter ? 'No staff accounts found matching your filters.' : 'No staff accounts found.'}
                      </td>
                    </tr>
                  ) : (
                    currentUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
                                <span className="text-sm font-medium text-white">
                                  {user.user.full_name ? user.user.full_name.charAt(0).toUpperCase() : 'S'}
                                </span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm text-gray-500">
                                {user.username}
                              </div>
                              <div className="text-sm font-medium text-gray-900">
                                {user.user.full_name || 'N/A'}
                              </div>
                              {user.user.email && (
                                <div className="text-sm text-gray-500">
                                  {user.user.email}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.user.user_type}
                          {user.user.user_type === 'STUDENT' && user.user.course && (
                            <div className="text-xs text-gray-500">
                              {user.user.course}
                              {user.user.year_level && ` - ${user.user.year_level}`}
                            </div>
                          )}
                          {user.user.user_type === 'EMPLOYEE' && user.user.department && (
                            <div className="text-xs text-gray-500">
                              {user.user.department}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(user.is_active)}`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-1">
                            <Link
                              href={`/users/${user.id}`}
                              className="text-gray-600 hover:text-gray-900 px-2 py-1 text-sm border border-gray-600 hover:bg-gray-50 rounded transition-colors"
                              title="View Details"
                            >
                              <i className="fas fa-eye"></i>
                            </Link>
                            
                            <button
                              onClick={() => handleOpenEditModal(user)}
                              className="text-blue-600 hover:text-blue-900 px-2 py-1 text-sm border border-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit Staff"
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            
                            <button
                              onClick={() => handleOpenRfidBindModal(user.user.user_id, user.user.full_name || 'Staff', user.user.rfid_code || null)}
                              className="text-blue-600 hover:text-blue-900 px-2 py-1 text-sm border border-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Bind RFID Code"
                            >
                              <i className="fas fa-id-card"></i>
                            </button>
                            
                            <button
                              onClick={() => handleToggleStatus(user.id, user.is_active)}
                              className={`px-2 py-1 text-sm border rounded transition-colors ${
                                user.is_active
                                  ? 'text-orange-600 hover:text-orange-900 border-orange-600 hover:bg-orange-50' 
                                  : 'text-green-600 hover:text-green-900 border-green-600 hover:bg-green-50'
                              }`}
                              title={user.is_active ? 'Deactivate Staff' : 'Activate Staff'}
                            >
                              <i className={`fas ${user.is_active ? 'fa-user-slash' : 'fa-user-check'}`}></i>
                            </button>
                            
                            <button
                              onClick={() => handleOpenPasswordResetModal(user.id, user.user.full_name || 'Staff')}
                              className="text-purple-600 hover:text-purple-900 px-2 py-1 text-sm border border-purple-600 hover:bg-purple-50 rounded transition-colors"
                              title="Reset Password"
                            >
                              <i className="fas fa-key"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!isLoading && filteredUsers.length > 0 && totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length} staff accounts
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

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
                    <button
                      key={pageNumber}
                      onClick={() => setCurrentPage(pageNumber)}
                      className={`px-3 py-1 text-sm border rounded-md ${
                        currentPage === pageNumber
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {!isLoading && (
          <div className="mt-4 text-sm text-gray-600">
            {totalPages <= 1 && `Showing ${filteredUsers.length} staff accounts`}
          </div>
        )}

        {/* Password Reset Modal */}
        {passwordResetUser && (
          <PasswordResetModal
            isOpen={showPasswordResetModal}
            onClose={handleClosePasswordResetModal}
            onReset={handleResetPassword}
            userId={passwordResetUser.id}
            fullName={passwordResetUser.name}
          />
        )}

        {/* Edit Staff Modal */}
        {showEditModal && editUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Edit Staff</h3>
                  <button
                    onClick={handleCloseEditModal}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </div>
              <div className="px-6 py-4">
                <div className="text-center text-gray-600">
                  <p className="mb-4">Staff: <span className="font-semibold text-gray-900">{editUser.user.full_name}</span></p>
                  <p className="text-sm">To edit staff information, please visit the user details page.</p>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
                <button
                  onClick={handleCloseEditModal}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Close
                </button>
                <Link
                  href={`/users/${editUser.id}`}
                  onClick={handleCloseEditModal}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  View Details
                </Link>
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
                    Staff: <span className="font-semibold text-gray-900">{rfidBindUser.name}</span>
                  </p>
                  {rfidBindUser.currentRfid && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                      <p className="text-xs text-blue-600 font-medium mb-1">Current RFID Code:</p>
                      <p className="font-mono font-bold text-blue-900 text-lg">{rfidBindUser.currentRfid}</p>
                    </div>
                  )}
                </div>

                {rfidBindUser.currentRfid ? (
                  <div className="space-y-4">
                    <div className="border-t pt-4">
                      <p className="text-sm text-gray-600 mb-3">
                        This staff already has an RFID assigned. You can:
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
    </>
  )
}

export default StaffAccounts
