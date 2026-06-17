'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notification'

interface Department {
  department_id: number
  name: string
  code: string
}

interface Program {
  program_id: number
  name: string
  code: string
}

function AddStaffPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [loading, setLoading] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  // Helper function to capitalize first letter of each word
  const capitalizeWords = (str: string): string => {
    if (!str) return ''
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [suffix, setSuffix] = useState('')
  const [email, setEmail] = useState('')
  const [userType, setUserType] = useState('EMPLOYEE')
  const [departmentId, setDepartmentId] = useState('')
  const [programId, setProgramId] = useState('')
  const [officeId, setOfficeId] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [rfidCode, setRfidCode] = useState('')
  const [purpose, setPurpose] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [offices, setOffices] = useState<any[]>([])

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
    if (authReady) {
      fetchDepartments()
      fetchOffices()
    }
  }, [authReady])

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        const departmentsList = Array.isArray(data) ? data : (data.departments || [])
        setDepartments(departmentsList)
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
      setDepartments([])
    }
  }

  const fetchOffices = async () => {
    try {
      const response = await fetch('/api/offices', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        const officesList = Array.isArray(data) ? data : (data.data || [])
        setOffices(officesList)
      }
    } catch (error) {
      console.error('Error fetching offices:', error)
      setOffices([])
    }
  }

  const fetchPrograms = async (deptId: string) => {
    if (!deptId) {
      setPrograms([])
      return
    }
    try {
      const response = await fetch(`/api/departments/${deptId}`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        // Handle different response structures
        const programsList = data.programs || data.data?.programs || []
        setPrograms(Array.isArray(programsList) ? programsList : [])
      }
    } catch (error) {
      console.error('Error fetching programs:', error)
      setPrograms([]) // Set empty array on error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!firstName.trim() || !lastName.trim()) {
      await notify.error('Error', 'First name and last name are required')
      return
    }

    if (!password || password.length < 4) {
      await notify.error('Error', 'Password must be at least 4 characters long')
      return
    }

    if (password !== confirmPassword) {
      await notify.error('Error', 'Passwords do not match')
      return
    }

    setSubmitting(true)
    notify.loading('Creating staff account...')

    try {
      // Construct full_name from name parts
      const nameParts = [firstName, middleName, lastName]
        .filter(part => part.trim())
        .join(' ')
      const full_name = suffix.trim() ? `${nameParts}, ${suffix.trim()}` : nameParts
      
      const response = await fetch('/api/staff-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          full_name,
          email: email || null,
          user_type: userType,
          password: password,
          department_id: departmentId ? parseInt(departmentId) : null,
          program_id: programId ? parseInt(programId) : null,
          office_id: officeId ? parseInt(officeId) : null,
          contact_number: contactNumber || null,
          rfid_code: rfidCode || null,
          purpose: purpose || null
        })
      })

      if (response.ok) {
        await notify.success('Success', 'Staff account created successfully')
        // Invalidate related caches to update staff accounts list
        if (typeof window !== 'undefined') {
          // Import dynamically to avoid SSR issues
          const { mutate } = await import('swr')
          await mutate('/api/users/by-role/STAFF')
          await mutate('/api/staff-accounts')
          await mutate('/api/staff/users')
          await mutate('/api/users')
        }
        router.push('/staff-accounts')
      } else {
        const errorData = await response.json()
        await notify.error('Error', errorData.error || 'Failed to create staff account')
      }
    } catch (error) {
      console.error('Error creating staff account:', error)
      await notify.error('Error', 'Network error occurred')
    } finally {
      setSubmitting(false)
      notify.close()
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
                  Register Library Staff
                </h1>
                {/* Breadcrumb */}
                <nav className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                  <span>Staff Accounts</span>
                  <i className="fas fa-chevron-right text-xs"></i>
                  <span className="text-gray-900 font-medium">Register Staff</span>
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
            <CardTitle>Create Library Staff Account</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name Fields */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(capitalizeWords(e.target.value))}
                    placeholder="Enter first name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(capitalizeWords(e.target.value))}
                    placeholder="Enter last name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Middle Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={middleName}
                    onChange={(e) => setMiddleName(capitalizeWords(e.target.value))}
                    placeholder="Enter middle name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Suffix (Optional)
                  </label>
                  <input
                    type="text"
                    value={suffix}
                    onChange={(e) => setSuffix(capitalizeWords(e.target.value))}
                    placeholder="Jr., Sr., III, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={submitting}
                />
              </div>

              {/* User Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User Type
                </label>
                <select
                  value={userType}
                  onChange={(e) => setUserType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={submitting}
                >
                  <option value="EMPLOYEE">Employee</option>
                  <option value="STUDENT">Student</option>
                  <option value="ALUMNI">Alumni</option>
                  <option value="GUEST">Guest</option>
                </select>
              </div>

              {/* Department and Office */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department (Optional)
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => {
                      setDepartmentId(e.target.value)
                      setProgramId('')
                      fetchPrograms(e.target.value)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={submitting}
                  >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                      <option key={dept.department_id} value={dept.department_id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Office - Only show for EMPLOYEE */}
                {userType === 'EMPLOYEE' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Office (Optional)
                    </label>
                    <select
                      value={officeId}
                      onChange={(e) => setOfficeId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={submitting}
                    >
                      <option value="">Select Office</option>
                      {offices.map((office) => (
                        <option key={office.office_id} value={office.office_id}>
                          {office.name} ({office.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Program (Optional) */}
              {departmentId && programs.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Program (Optional)
                  </label>
                  <select
                    value={programId}
                    onChange={(e) => setProgramId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={submitting}
                  >
                    <option value="">Select Program</option>
                    {programs.map((prog) => (
                      <option key={prog.program_id} value={prog.program_id}>
                        {prog.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Contact Number, RFID, Purpose */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={contactNumber}
                    onChange={(e) => {
                      const value = e.target.value
                      // Allow only numbers
                      if (value === '' || /^[0-9]+$/.test(value)) {
                        setContactNumber(value)
                      }
                    }}
                    placeholder="Enter contact number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    RFID Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={rfidCode}
                    onChange={(e) => setRfidCode(e.target.value)}
                    placeholder="Enter RFID code"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Purpose (Optional)
                  </label>
                  <input
                    type="text"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Enter purpose"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Role Display */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md">
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    STAFF
                  </span>
                  <span className="ml-2 text-sm text-gray-600">
                    Library Staff
                  </span>
                </div>
              </div>

              {/* Password Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (confirmPassword && e.target.value !== confirmPassword) {
                          setPasswordError('Passwords do not match')
                        } else {
                          setPasswordError('')
                        }
                      }}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter password (min 4 characters)"
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-gray-400 hover:text-gray-600`}></i>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value)
                        if (password && e.target.value !== password) {
                          setPasswordError('Passwords do not match')
                        } else {
                          setPasswordError('')
                        }
                      }}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Confirm password"
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'} text-gray-400 hover:text-gray-600`}></i>
                    </button>
                  </div>
                  {passwordError && (
                    <p className="text-xs text-red-600 font-medium mt-1">
                      {passwordError}
                    </p>
                  )}
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
                <Button type="submit" disabled={submitting || !!passwordError}>
                  {submitting ? 'Creating...' : 'Create Staff Account'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export default AddStaffPage
