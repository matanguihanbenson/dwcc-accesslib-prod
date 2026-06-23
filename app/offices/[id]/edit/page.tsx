'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { UserRole } from '@/types'
import { notify } from '@/lib/notification'

interface Office {
  office_id: number
  name: string
  code: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function EditOfficePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const officeId = params.id as string

  const [office, setOffice] = useState<Office | null>(null)
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
    if (authReady && officeId) {
      fetchOffice()
    }
  }, [authReady, officeId])

  const fetchOffice = async () => {
    try {
      setLoading(true)
      
      const response = await fetch(`/api/offices/${officeId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        const officeData = data.data || data
        setOffice(officeData)
        setFormData({
          name: officeData.name,
          code: officeData.code,
          description: officeData.description || '',
          is_active: officeData.is_active
        })
      } else if (response.status === 404) {
        router.push('/offices')
        return
      } else {
        console.error('Failed to fetch office:', response.status)
        await notify.error('Error', 'Failed to fetch office details')
      }
    } catch (error) {
      console.error('Error fetching office:', error)
      await notify.error('Error', 'Error fetching office details')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !formData.code.trim()) {
      await notify.error('Error', 'Name and code are required')
      return
    }

    try {
      setSubmitting(true)
      notify.loading('Updating office...')
      
      const response = await fetch(`/api/offices/${officeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        notify.close()
        await notify.success('Success', 'Office updated successfully')
        router.push(`/offices/${officeId}`)
      } else {
        const errorData = await response.json()
        notify.close()
        await notify.error('Error', errorData.error || 'Failed to update office')
      }
    } catch (error) {
      console.error('Error updating office:', error)
      notify.close()
      await notify.error('Error', 'Network error occurred while updating office')
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
            <div className="text-sm text-gray-600">Loading office details...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!office) {
    return (
      <div className="px-6 py-4">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900">Office Not Found</h1>
          <p className="text-gray-600 mt-2">The office you're trying to edit doesn't exist.</p>
          <Button onClick={() => router.push('/offices')} className="mt-4">
            Back to Offices
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
                  Edit Office
                </h1>
                {/* Breadcrumb */}
                <nav className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                  <span>Offices</span>
                  <i className="fas fa-chevron-right text-xs"></i>
                  <span>{office.name}</span>
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
            <CardTitle>Edit Office Information</CardTitle>
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
                    disabled={submitting}
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
                    disabled={submitting}
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
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => handleInputChange('is_active', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={submitting}
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
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
                  {submitting ? 'Updating...' : 'Update Office'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

