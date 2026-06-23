'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { UserRole } from '@/types'
import { notify } from '@/lib/notification'

const showErrorAlert = (title: string, message: string) => notify.error(title, message)
const showSuccessAlert = (title: string, message: string) => notify.success(title, message)
const showLoadingAlert = (title: string) => notify.loading(title)

export default function AddOfficePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [authReady, setAuthReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: ''
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !formData.code.trim()) {
      showErrorAlert('Error', 'Name and code are required')
      return
    }

    try {
      setSubmitting(true)
      showLoadingAlert('Creating office...')
      
      const response = await fetch('/api/offices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const result = await response.json()
        notify.close()
        await showSuccessAlert('Success', 'Office created successfully')
        router.push('/offices')
      } else {
        const errorData = await response.json()
        notify.close()
        await showErrorAlert('Error', errorData.error || 'Failed to create office')
      }
    } catch (error) {
      console.error('Error creating office:', error)
      notify.close()
      await showErrorAlert('Error', 'Network error occurred while creating office')
    } finally {
      setSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
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
                  Add Office
                </h1>
                {/* Breadcrumb */}
                <nav className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                  <span>Offices</span>
                  <i className="fas fa-chevron-right text-xs"></i>
                  <span className="text-gray-900 font-medium">Add Office</span>
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
            <CardTitle>Create New Office</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Office Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter office name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Office Code *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => handleInputChange('code', e.target.value)}
                    placeholder="Enter office code"
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
                  placeholder="Enter office description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Submit Button */}
              <div className="flex justify-end space-x-3 pt-4">
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => router.back()}
                  disabled={submitting}
                  className='bg-gray-200 hover:bg-gray-300 px-4 py-5'
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className='bg-primary-600 hover:bg-primary-700 text-white px-4 py-5'>
                  {submitting ? 'Creating...' : 'Create Office'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

