'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { UserRole, UserType, UserStatus } from '@/types'
import { notify } from '@/lib/notification'

interface LibraryUser {
  user_id: number
  account_id: string
  first_name: string
  last_name: string
  middle_name?: string
  suffix?: string
  full_name: string
  user_type: UserType
  department_id?: number
  program_id?: number
  office_id?: number
  year_level?: string
  email?: string
  contact_number?: string
  purpose?: string
  status: UserStatus
  created_at: string
  updated_at: string
}

interface Department {
  department_id: number
  name: string
  code: string
  is_active: boolean
}

interface Program {
  program_id: number
  name: string
  code: string
  is_active: boolean
}

interface Office {
  office_id: number
  name: string
  code: string
  is_active: boolean
}

// SweetAlert2 wrappers
const showErrorAlert = (title: string, message: string) => notify.error(title, message)
const showSuccessAlert = (title: string, message: string) => notify.success(title, message)
const showLoadingAlert = (title: string) => notify.loading(title)

export default function EditLibraryUserPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const userId = params.id as string

  const [user, setUser] = useState<LibraryUser | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [offices, setOffices] = useState<Office[]>([])
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    suffix: '',
    account_id: '',
    user_type: 'STUDENT' as UserType,
    department_id: '',
    program_id: '',
    office_id: '',
    year_level: '',
    email: '',
    contact_number: '',
    purpose: '',
    status: 'ACTIVE' as UserStatus
  })

  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') {
        return
      }

      if (!session) {
        router.push('/login')
        return
      }

      const userRole = session.user.role as UserRole
      if (userRole !== UserRole.SUPER_ADMIN && userRole !== UserRole.ADMIN) {
        router.push('/dashboard')
        return
      }

      setAuthReady(true)
    }

    checkAuth()
  }, [session, status, router])

  useEffect(() => {
    if (authReady && userId) {
      fetchUser()
      fetchDepartments()
      fetchOffices()
    }
  }, [authReady, userId])

  const fetchUser = async () => {
    try {
      setLoading(true)
      
      const response = await fetch(`/api/library-users/${userId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        const userData = data.data
        setUser(userData)
        setFormData({
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          middle_name: userData.middle_name || '',
          suffix: userData.suffix || '',
          account_id: userData.account_id,
          user_type: userData.user_type,
          department_id: userData.department_id?.toString() || '',
          program_id: userData.program_id?.toString() || '',
          office_id: (userData as any).office_id?.toString() || '',
          year_level: userData.year_level || '',
          email: userData.email || '',
          contact_number: userData.contact_number || '',
          purpose: userData.purpose || '',
          status: userData.status
        })
      } else if (response.status === 404) {
        router.push('/library-users')
        return
      } else {
        console.error('Failed to fetch user:', response.status)
        showErrorAlert('Error', 'Failed to fetch user details')
      }
    } catch (error) {
      console.error('Error fetching user:', error)
      showErrorAlert('Error', 'Error fetching user details')
    } finally {
      setLoading(false)
    }
  }

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setDepartments(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
  }

  const fetchPrograms = async (departmentId: string) => {
    try {
      const response = await fetch(`/api/programs?departmentId=${departmentId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setPrograms(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching programs:', error)
    }
  }

  const fetchOffices = async () => {
    try {
      const response = await fetch('/api/offices', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        const data = await response.json()
        setOffices(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching offices:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.first_name.trim() || !formData.last_name.trim() || !formData.account_id.trim()) {
      showErrorAlert('Error', 'First name, last name, and ID number are required')
      return
    }

    try {
      setSubmitting(true)
      showLoadingAlert('Updating user...')
      
      const response = await fetch(`/api/library-users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          department_id: formData.department_id ? parseInt(formData.department_id) : null,
          program_id: formData.program_id ? parseInt(formData.program_id) : null,
          office_id: formData.office_id ? parseInt(formData.office_id) : null
        }),
      })

      if (response.ok) {
        notify.close()
        showSuccessAlert('Success', 'User updated successfully')
        router.push(`/library-users/${userId}`)
      } else {
        const errorData = await response.json()
        notify.close()
        showErrorAlert('Error', errorData.error || 'Failed to update user')
      }
    } catch (error) {
      console.error('Error updating user:', error)
      notify.close()
      showErrorAlert('Error', 'Network error occurred while updating user')
    } finally {
      setSubmitting(false)
    }
  }

  // Helper function to capitalize first letter of each word
  const capitalizeWords = (str: string): string => {
    if (!str) return ''
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => {
      // Capitalize name fields
      let processedValue = value
      if (field === 'first_name' || field === 'middle_name' || field === 'last_name' || field === 'suffix') {
        processedValue = capitalizeWords(value)
      }

      const next = { ...prev, [field]: processedValue }
      // Reset dependent fields based on user type
      if (field === 'user_type') {
        next.department_id = ''
        next.program_id = ''
        next.year_level = ''
      }
      // When department changes, refetch programs and reset program selection
      if (field === 'department_id') {
        if (value) {
          fetchPrograms(value)
        } else {
          setPrograms([])
        }
        next.program_id = ''
      }
      return next
    })
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
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900">User Not Found</h1>
          <p className="text-gray-600 mt-2">The user you're trying to edit doesn't exist.</p>
          <Button onClick={() => router.push('/library-users')} className="mt-4">
            Back to Library Users
          </Button>
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
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <i className="fas fa-arrow-left text-lg"></i>
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-800">
                  Edit User
                </h1>
                {/* Breadcrumb */}
                <nav className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                  <span>Library Users</span>
                  <i className="fas fa-chevron-right text-xs"></i>
                  <span>{user.full_name}</span>
                  <i className="fas fa-chevron-right text-xs"></i>
                  <span className="text-gray-900 font-medium">Edit</span>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        <Card>
          <CardHeader>
            <CardTitle>Edit User Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    placeholder="Enter first name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                    placeholder="Enter last name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Middle Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.middle_name}
                    onChange={(e) => handleInputChange('middle_name', e.target.value)}
                    placeholder="Enter middle name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Suffix (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.suffix}
                    onChange={(e) => handleInputChange('suffix', e.target.value)}
                    placeholder="Jr., Sr., III, etc."
                    maxLength={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ID Number *
                  </label>
                  <input
                    type="text"
                    value={formData.account_id}
                    readOnly
                    placeholder="ID number (read-only)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700 cursor-not-allowed"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    User Type *
                  </label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-100"
                    value={formData.user_type}
                    onChange={(e) => handleInputChange('user_type', e.target.value)}
                    disabled
                    required
                  >
                    <option value="STUDENT">Student</option>
                    <option value="EMPLOYEE">Employee</option>
                    <option value="ALUMNI">Alumni</option>
                    <option value="GUEST">Guest</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
              </div>

              {(formData.user_type === 'STUDENT' || formData.user_type === 'EMPLOYEE' || formData.user_type === 'ALUMNI') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Department
                    </label>
                    <select 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.department_id}
                      onChange={(e) => handleInputChange('department_id', e.target.value)}
                    >
                      <option value="">Select Department</option>
                      {departments.map((dept) => (
                        <option key={dept.department_id} value={dept.department_id}>
                          {dept.name} ({dept.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {(formData.user_type === 'STUDENT' || formData.user_type === 'ALUMNI') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Program
                      </label>
                      <select 
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={formData.program_id}
                        onChange={(e) => handleInputChange('program_id', e.target.value)}
                        disabled={!formData.department_id}
                      >
                        <option value="">Select Program</option>
                        {programs.map((prog) => (
                          <option key={prog.program_id} value={prog.program_id}>
                            {prog.name} ({prog.code})
                          </option>
                        ))}
                      </select>
                    </div>
              )}
            </div>
          )}

          {formData.user_type === 'EMPLOYEE' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Office
                </label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={formData.office_id}
                  onChange={(e) => handleInputChange('office_id', e.target.value)}
                >
                  <option value="">Select Office</option>
                  {offices.map((office) => (
                    <option key={office.office_id} value={office.office_id}>
                      {office.name} ({office.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
              {(formData.user_type === 'STUDENT') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Year Level
                    </label>
                    <select
                      value={formData.year_level}
                      onChange={(e) => handleInputChange('year_level', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select Year Level</option>
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                      <option value="5th Year">5th Year</option>
                      <option value="Graduate">Graduate School</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md-grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="Enter email address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Number
                  </label>
                  <input
                    type="tel"
                    value={formData.contact_number}
                    onChange={(e) => {
                      const value = e.target.value
                      // Allow only numbers
                      if (value === '' || /^[0-9]+$/.test(value)) {
                        handleInputChange('contact_number', value)
                      }
                    }}
                    placeholder="Enter contact number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Purpose
                  </label>
                  <input
                    type="text"
                    value={formData.purpose}
                    onChange={(e) => handleInputChange('purpose', e.target.value)}
                    placeholder="Enter purpose"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end space-x-3 pt-4">
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => router.back()}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Updating...' : 'Update User'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
