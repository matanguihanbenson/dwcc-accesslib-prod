'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PasswordResetModal } from '@/components/modals/PasswordResetModal'
import { useApiSWR, useApi } from '@/lib/hooks/useApi'
import { useCacheManager } from '@/lib/hooks/useCacheManager'
import { notify } from '@/lib/notification'

interface User {
  id: number
  account_id: string
  role: string
  status: 'ACTIVE' | 'INACTIVE'
  rfid_code?: string | null
  user: {
    user_id?: number
    full_name: string
    user_type: string
    email?: string
    year_level?: string
    department_ref?: {
      name: string
      code: string
    }
    program?: {
      name: string
      code: string
    }
  }
}

function AdminAccounts() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [authReady, setAuthReady] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showUserModal, setShowUserModal] = useState(false)
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false)
  const [passwordResetUser, setPasswordResetUser] = useState<{id: number, name: string} | null>(null)
  const [showRfidBindModal, setShowRfidBindModal] = useState(false)
  const [rfidBindUser, setRfidBindUser] = useState<{id: number, name: string, currentRfid: string | null} | null>(null)
  const [rfidInput, setRfidInput] = useState('')

  // Cache management
  const { invalidateUserData } = useCacheManager()

  // SWR for admin accounts data
  const { 
    data: users = [], 
    error, 
    isLoading, 
    mutate: refreshAdminUsers 
  } = useApiSWR<User[]>(authReady ? '/api/admin-accounts' : null)

  // Mutation hooks
  const { execute: toggleStatus, loading: toggleLoading } = useApi({
    onSuccess: (data) => {
      notify.success('Success', data.message || 'Admin status updated successfully')
      setTimeout(() => {
        refreshAdminUsers()
        invalidateUserData()
      }, 500)
    },
    onError: (error) => {
      notify.error('Error', error || 'Failed to update admin status')
    }
  })

  const { execute: resetPassword, loading: resetLoading } = useApi({
    onSuccess: (data) => {
      notify.success('Password Reset', data.message || 'Password reset successfully')
      refreshAdminUsers()
      invalidateUserData()
    },
    onError: (error) => {
      notify.error('Error', error || 'Failed to reset password')
    }
  })

  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') {
        return
      }

      if (status === 'authenticated' && session?.user) {
        console.log('NextAuth session ready for admin accounts')
        setAuthReady(true)
      } else {
        try {
          const response = await fetch('/api/users/profile', {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          })
          
          if (response.ok) {
            console.log('JWT token authentication ready for admin accounts')
            setAuthReady(true)
          } else {
            console.warn('No valid authentication found, redirecting to login')
            router.push('/login')
            return
          }
        } catch (error) {
          console.warn('Auth check failed, redirecting to login:', error)
          router.push('/login')
          return
        }
      }
    }

    checkAuth()
  }, [session, status, router])

  useEffect(() => {
    if (authReady) {
      refreshAdminUsers()
    }
  }, [authReady])

  const handleRefresh = () => {
    refreshAdminUsers()
  }

  useEffect(() => {
    window.refreshAdminAccounts = handleRefresh
    return () => {
      delete window.refreshAdminAccounts
    }
  }, [])

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.account_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.user?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = !statusFilter || 
      (statusFilter === 'ACTIVE' && user.status === 'ACTIVE') ||
      (statusFilter === 'INACTIVE' && user.status === 'INACTIVE')

    return matchesSearch && matchesStatus
  })

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentUsers = filteredUsers.slice(startIndex, endIndex)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter])

  const getStatusBadgeColor = (status: 'ACTIVE' | 'INACTIVE') => {
    return status === 'ACTIVE'
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800'
  }

    const handleToggleStatus = async (userId: number, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate'
    const confirmed = await notify.confirm(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Admin`,
      `Are you sure you want to ${action} this admin account?`
    )

    if (confirmed) {
      await toggleStatus(`/api/users/${userId}/toggle-status`, {
        method: 'PATCH',
      })
    }
  }

  const handleResetPassword = async (userId: number, fullName: string, newPassword: string) => {
    try {
      console.log('Initiating password reset for user ID:', userId, 'with password length:', newPassword.length)
      
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
        console.log('Password reset response:', data)
        
        await notify.success(
          'Password Reset', 
          `Password reset successfully for ${fullName}. New password: "${newPassword}"`
        )
        
        // Wait a moment for the database to be updated, then refresh
        setTimeout(async () => {
          await refreshAdminUsers()
          
          if (window.refreshStaffAccounts) {
            window.refreshStaffAccounts()
          }
          
          if (window.refreshDashboard) {
            window.refreshDashboard()
          }
        }, 500)
      } else {
        const errorData = await response.json()
        console.error('Password reset failed:', errorData)
        await notify.error('Error', errorData.error || 'Failed to reset password')
      }
    } catch (error) {
      console.error('Error resetting password:', error)
      await notify.error('Error', 'Network error occurred')
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
          await refreshAdminUsers()
          invalidateUserData()
        }, 500)
      } else if (response.status === 409) {
        // RFID already exists
        await notify.error(
          'RFID Already Bound',
          data.error || `This RFID is already assigned to another user. Please use a different RFID.`
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
          await refreshAdminUsers()
          invalidateUserData()
        }, 500)
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
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-800">
                Library Admin
              </h1>
              {(() => {
                const adminCount = users.filter(u => u.role === 'ADMIN' && u.status === 'ACTIVE').length
                return (
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    adminCount >= 1 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {adminCount}/1 Library Admin{adminCount >= 1 ? ' - Max number of admin accounts reached' : ''}
                  </span>
                )
              })()}
            </div>
            {(() => {
              const adminCount = users.filter(u => u.role === 'ADMIN' && u.status === 'ACTIVE').length
              const isAtLimit = adminCount >= 1
              
              if (isAtLimit) {
                return (
                  <button
                    onClick={async () => {
                      await notify.error(
                        'Maximum Limit Reached',
                        'Only 1 Library Admin account is allowed. Please deactivate the existing admin before creating a new one.'
                      )
                    }}
                    title="Maximum 1 Library Admin account allowed"
                    className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-md text-sm font-medium cursor-pointer"
                  >
                    Add New Admin
                  </button>
                )
              }
              
              return (
                <Link
                  href="/users/register-admin"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Add New Admin
                </Link>
              )
            })()}
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
                placeholder="Search admins by name, id, or email..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Admin Users Table */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="text-gray-500">Loading admin accounts...</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Admin User
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
                        {searchTerm || statusFilter ? 'No admin accounts found matching your filters.' : 'No admin accounts found.'}
                      </td>
                    </tr>
                  ) : (
                    currentUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                                <span className="text-sm font-medium text-white">
                                  {user.user.full_name ? user.user.full_name.charAt(0).toUpperCase() : 'A'}
                                </span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm text-gray-500">
                                {user.account_id}
                              </div>
                              <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                {user.user.full_name || 'N/A'}
                                {user.rfid_code ? (
                                  <i className="fas fa-check-circle text-green-600 text-xs" title={`RFID: ${user.rfid_code}`}></i>
                                ) : (
                                  <i className="fas fa-id-card text-gray-400 text-xs" title="No RFID"></i>
                                )}
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
                          {user.user.user_type === 'STUDENT' && user.user.program && (
                            <div className="text-xs text-gray-500">
                              {user.user.program.name} ({user.user.program.code})
                              {user.user.year_level && ` - ${user.user.year_level}`}
                            </div>
                          )}
                          {user.user.user_type === 'EMPLOYEE' && user.user.department_ref && (
                            <div className="text-xs text-gray-500">
                              {user.user.department_ref.name} ({user.user.department_ref.code})
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(user.status)}`}>
                            {user.status === 'ACTIVE' ? 'Active' : 'Inactive'}
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
                              onClick={() => handleToggleStatus(user.id, user.status === 'ACTIVE')}
                              className={`px-2 py-1 text-sm border rounded transition-colors ${
                                user.status === 'ACTIVE'
                                  ? 'text-orange-600 hover:text-orange-900 border-orange-600 hover:bg-orange-50' 
                                  : 'text-green-600 hover:text-green-900 border-green-600 hover:bg-green-50'
                              }`}
                              title={user.status === 'ACTIVE' ? 'Deactivate Admin' : 'Activate Admin'}
                            >
                              <i className={`fas ${user.status === 'ACTIVE' ? 'fa-user-slash' : 'fa-user-check'}`}></i>
                            </button>
                            <button
                              onClick={() => handleOpenPasswordResetModal(user.id, user.user.full_name || 'Admin')}
                              className="text-purple-600 hover:text-purple-900 px-2 py-1 text-sm border border-purple-600 hover:bg-purple-50 rounded transition-colors"
                              title="Reset Password"
                            >
                              <i className="fas fa-key"></i>
                            </button>
                            <button
                              onClick={() => {
                                const targetUserId = user.user?.user_id
                                if (!targetUserId) {
                                  notify.error('Error', 'This admin record is missing a user id.')
                                  return
                                }
                                if (user.status !== 'ACTIVE') {
                                  notify.error('Unavailable', 'Activate this account before binding/unbinding RFID.')
                                  return
                                }
                                handleOpenRfidBindModal(targetUserId, user.user.full_name || 'Admin', user.rfid_code || null)
                              }}
                              className="text-blue-600 hover:text-blue-900 px-2 py-1 text-sm border border-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title={user.rfid_code ? 'Update RFID' : 'Bind RFID'}
                            >
                              <i className="fas fa-id-card"></i>
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
              Showing {startIndex + 1} to {Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length} admin accounts
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
            {totalPages <= 1 && `Showing ${filteredUsers.length} admin accounts`}
          </div>
        )}
      </div>

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
                <p className="text-sm text-gray-900">{selectedUser.user.full_name}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Username / ID Number</label>
                <p className="text-sm text-gray-900">{selectedUser.account_id}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="text-sm text-gray-900">{selectedUser.user.email || 'N/A'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">User Type</label>
                <p className="text-sm text-gray-900">{selectedUser.user.user_type}</p>
              </div>
              
              {selectedUser.user.program && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Program</label>
                  <p className="text-sm text-gray-900">
                    {selectedUser.user.program.name} ({selectedUser.user.program.code})
                  </p>
                </div>
              )}
              
              {selectedUser.user.department_ref && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Department</label>
                  <p className="text-sm text-gray-900">
                    {selectedUser.user.department_ref.name} ({selectedUser.user.department_ref.code})
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                  {selectedUser.role}
                </span>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  selectedUser.status === 'ACTIVE' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {selectedUser.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                </span>
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
    </>
  )
}

export default AdminAccounts
