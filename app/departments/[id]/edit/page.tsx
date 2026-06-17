'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserRole } from '@/types'

interface Department {
  department_id: number
  name: string
  code: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// Simple notification utilities
const showErrorAlert = (title: string, message: string) => {
  console.error(`ERROR: ${title} - ${message}`)
  alert(`${title}: ${message}`)
}

const showSuccessAlert = (title: string, message: string) => {
  console.log(`SUCCESS: ${title} - ${message}`)
  alert(`${title}: ${message}`)
}

const showLoadingAlert = (title: string) => {
  console.log(`LOADING: ${title}`)
}

export default function EditDepartmentPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const departmentId = params.id as string

  const [department, setDepartment] = useState<Department | null>(null)
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    is_active: true
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
      if (userRole !== UserRole.SUPER_ADMIN) {
        router.push('/dashboard')
        return
      }

      setAuthReady(true)
    }

    checkAuth()
  }, [session, status, router])

  useEffect(() => {
    if (authReady && departmentId) {
      fetchDepartment()
    }
  }, [authReady, departmentId])

  const fetchDepartment = async () => {
    try {
      setLoading(true)
      
      const response = await fetch(`/api/departments/${departmentId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        const dept = data.data
        setDepartment(dept)
        setFormData({
          name: dept.name,
          code: dept.code,
          description: dept.description || '',
          is_active: dept.is_active
        })
      } else if (response.status === 404) {
        router.push('/departments')
        return
      } else {
        console.error('Failed to fetch department:', response.status)
        showErrorAlert('Error', 'Failed to fetch department details')
      }
    } catch (error) {
      console.error('Error fetching department:', error)
      showErrorAlert('Error', 'Error fetching department details')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !formData.code.trim()) {
      showErrorAlert('Error', 'Name and code are required')
      return
    }

    try {
      setSubmitting(true)
      showLoadingAlert('Updating department...')
      
      const response = await fetch(`/api/departments/${departmentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        showSuccessAlert('Success', 'Department updated successfully')
        router.push(`/departments/${departmentId}`)
      } else {
        const errorData = await response.json()
        showErrorAlert('Error', errorData.error || 'Failed to update department')
      }
    } catch (error) {
      console.error('Error updating department:', error)
      showErrorAlert('Error', 'Network error occurred while updating department')
    } finally {
      setSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
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
            <div className="text-sm text-gray-600">Loading department details...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!department) {
    return (
      <div className="px-6 py-4">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900">Department Not Found</h1>
          <p className="text-gray-600 mt-2">The department you're trying to edit doesn't exist.</p>
          <Button onClick={() => router.push('/departments')} className="mt-4">
            Back to Departments
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
                  Edit Department
                </h1>
                {/* Breadcrumb */}
                <nav className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                  <span>Departments</span>
                  <i className="fas fa-chevron-right text-xs"></i>
                  <span>{department.name}</span>
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
            <CardTitle>Edit Department Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter department name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department Code *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => handleInputChange('code', e.target.value)}
                    placeholder="Enter department code"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Enter department description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="status"
                      checked={formData.is_active}
                      onChange={() => handleInputChange('is_active', true)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="status"
                      checked={!formData.is_active}
                      onChange={() => handleInputChange('is_active', false)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Inactive</span>
                  </label>
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
                  {submitting ? 'Updating...' : 'Update Department'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

