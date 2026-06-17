'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { notify } from '@/lib/notification'

interface UserDetails {
  id: number
  username: string
  role: string
  is_active: boolean
  created_at: string
  last_login?: string
  user: {
    full_name: string
    user_type: string
    email?: string
    course?: string
    year_level?: string
    department?: string
  }
}

function UserDetailsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const userId = params.id as string
  
  const [user, setUser] = useState<UserDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') {
        return
      }

      if (status === 'authenticated' && session?.user) {
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
            setAuthReady(true)
          } else {
            router.push('/login')
            return
          }
        } catch (error) {
          router.push('/login')
          return
        }
      }
    }

    checkAuth()
  }, [session, status, router])

  useEffect(() => {
    if (authReady && userId) {
      fetchUserDetails()
    }
  }, [authReady, userId])

  const fetchUserDetails = async () => {
    try {
      setLoading(true)
      
      const response = await fetch(`/api/users/${userId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      } else if (response.status === 404) {
        await notify.error('Error', 'User not found')
        router.back()
      } else if (response.status === 403) {
        await notify.error('Error', 'You do not have permission to view this user')
        router.back()
      } else {
        await notify.error('Error', 'Failed to fetch user details')
      }
    } catch (error) {
      console.error('Error fetching user details:', error)
      await notify.error('Error', 'Network error occurred')
    } finally {
      setLoading(false)
    }
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

  if (loading) {
    return (
      <div className="px-6 py-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Loading user details...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="px-6 py-4">
        <div className="text-center">
          <div className="text-gray-500">User not found</div>
        </div>
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-red-100 text-red-800'
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800'
      case 'STAFF':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusBadgeColor = (is_active: boolean) => {
    return is_active
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800'
  }

  return (
    <>
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-900 transition-colors">
                <i className="fas fa-arrow-left text-lg"></i>
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-800">Account Details</h1>
                <nav className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                  <span>Account Details</span>
                  <i className="fas fa-chevron-right text-xs"></i>
                  <span className="text-gray-900 font-medium">{user.username}</span>
                </nav>
              </div>
            </div>
            
          </div>
        </div>
      </div>

      <div className="px-6 py-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          {/* Profile Header Card */}
          <div className="bg-white shadow-lg rounded-xl overflow-hidden mb-6">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 h-20 w-20">
                  <div className="h-20 w-20 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white/30 flex items-center justify-center shadow-xl">
                    <span className="text-3xl font-bold text-white">
                      {user.user.full_name ? user.user.full_name.charAt(0).toUpperCase() : 'U'}
                    </span>
                  </div>
                </div>
                <div className="ml-6 flex-1">
                  <h2 className="text-3xl font-bold text-white">{user.user.full_name || 'N/A'}</h2>
                  <p className="text-blue-100 text-sm mt-1">@{user.username}</p>
                  <div className="flex items-center space-x-3 mt-3">
                    <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full shadow-sm ${getRoleBadgeColor(user.role)} border-2 border-white/50`}>
                      <i className={`fas ${user.role === 'SUPER_ADMIN' ? 'fa-crown' : user.role === 'ADMIN' ? 'fa-shield-alt' : 'fa-user-tie'} mr-2`}></i>
                      {user.role}
                    </span>
                    <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full shadow-sm ${getStatusBadgeColor(user.is_active)} border-2 border-white/50`}>
                      <i className={`fas ${user.is_active ? 'fa-check-circle' : 'fa-times-circle'} mr-2`}></i>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Personal Information Card */}
            <div className="bg-white shadow-lg rounded-xl overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
                <h3 className="text-lg font-bold text-white flex items-center">
                  <i className="fas fa-user-circle mr-3"></i>
                  Personal Information
                </h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start border-b border-gray-100 pb-4">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-signature text-indigo-600"></i>
                    </div>
                    <div className="ml-4 flex-1">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Full Name</label>
                      <p className="mt-1 text-base font-medium text-gray-900">{user.user.full_name || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-start border-b border-gray-100 pb-4">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-at text-indigo-600"></i>
                    </div>
                    <div className="ml-4 flex-1">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Username</label>
                      <p className="mt-1 text-base font-medium text-gray-900">{user.username}</p>
                    </div>
                  </div>
                  <div className="flex items-start border-b border-gray-100 pb-4">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-envelope text-indigo-600"></i>
                    </div>
                    <div className="ml-4 flex-1">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</label>
                      <p className="mt-1 text-base font-medium text-gray-900">{user.user.email || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-users text-indigo-600"></i>
                    </div>
                    <div className="ml-4 flex-1">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">User Type</label>
                      <p className="mt-1 text-base font-medium text-gray-900">{user.user.user_type}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Information Card */}
            <div className="bg-white shadow-lg rounded-xl overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
                <h3 className="text-lg font-bold text-white flex items-center">
                  <i className="fas fa-cog mr-3"></i>
                  Account Information
                </h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start border-b border-gray-100 pb-4">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-shield-alt text-purple-600"></i>
                    </div>
                    <div className="ml-4 flex-1">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</label>
                      <p className="mt-1 text-base font-medium text-gray-900">
                        {user.role}
                        <span className="ml-2 text-sm text-gray-500">
                          {user.role === 'SUPER_ADMIN' ? '(Full System Access)' : 
                           user.role === 'ADMIN' ? '(Library Administrator)' : 
                           '(Library Staff)'}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start border-b border-gray-100 pb-4">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <i className={`fas ${user.is_active ? 'fa-toggle-on text-green-600' : 'fa-toggle-off text-red-600'}`}></i>
                    </div>
                    <div className="ml-4 flex-1">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Account Status</label>
                      <p className="mt-1 text-base font-medium text-gray-900">
                        {user.is_active ? 'Active' : 'Inactive'}
                        <span className="ml-2 text-sm text-gray-500">
                          {user.is_active ? '(Can access system)' : '(Access disabled)'}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start border-b border-gray-100 pb-4">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-calendar-plus text-purple-600"></i>
                    </div>
                    <div className="ml-4 flex-1">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Created At</label>
                      <p className="mt-1 text-base font-medium text-gray-900">{formatDate(user.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-sign-in-alt text-purple-600"></i>
                    </div>
                    <div className="ml-4 flex-1">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Login</label>
                      <p className="mt-1 text-base font-medium text-gray-900">{user.last_login ? formatDate(user.last_login) : 'Never logged in'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Details Card */}
          {(user.user.course || user.user.year_level || user.user.department) && (
            <div className="bg-white shadow-lg rounded-xl overflow-hidden mt-6">
              <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
                <h3 className="text-lg font-bold text-white flex items-center">
                  <i className="fas fa-graduation-cap mr-3"></i>
                  Academic/Department Information
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {user.user.course && (
                    <div className="flex items-start">
                      <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-book text-green-600"></i>
                      </div>
                      <div className="ml-4 flex-1">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Course</label>
                        <p className="mt-1 text-base font-medium text-gray-900">{user.user.course}</p>
                      </div>
                    </div>
                  )}
                  {user.user.year_level && (
                    <div className="flex items-start">
                      <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-layer-group text-green-600"></i>
                      </div>
                      <div className="ml-4 flex-1">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Year Level</label>
                        <p className="mt-1 text-base font-medium text-gray-900">{user.user.year_level}</p>
                      </div>
                    </div>
                  )}
                  {user.user.department && (
                    <div className="flex items-start">
                      <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-building text-green-600"></i>
                      </div>
                      <div className="ml-4 flex-1">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</label>
                        <p className="mt-1 text-base font-medium text-gray-900">{user.user.department}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default UserDetailsPage
