'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserRole } from '@/types'
import { formatDate } from '@/lib/utils'

interface Office {
  office_id: number
  name: string
  code: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
  archived_at?: string
}

export default function OfficeViewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const officeId = params.id as string

  const [office, setOffice] = useState<Office | null>(null)
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)

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
        setOffice(data.data || data)
      } else if (response.status === 404) {
        router.push('/offices')
        return
      } else {
        console.error('Failed to fetch office:', response.status)
        alert('Failed to fetch office details')
      }
    } catch (error) {
      console.error('Error fetching office:', error)
      alert('Error fetching office details')
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
          <p className="text-gray-600 mt-2">The office you're looking for doesn't exist.</p>
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
                  {office.name}
                </h1>
                {/* Breadcrumb */}
                <nav className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                  <span>Offices</span>
                  <i className="fas fa-chevron-right text-xs"></i>
                  <span className="text-gray-900 font-medium">{office.name}</span>
                </nav>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={() => router.push(`/offices/${officeId}/edit`)}
              >
                <i className="fas fa-edit mr-2" />
                Edit Office
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4 space-y-6">
        {/* Office Details */}
        <Card>
          <CardHeader>
            <CardTitle>Office Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Office Name
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                  <span className="text-gray-900 font-medium">{office.name}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Office Code
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                  <Badge variant="outline">{office.code}</Badge>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                  <span className="text-gray-700">{office.description || 'No description provided'}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <div>
                  <Badge variant={office.is_active ? 'success' : 'default'}>
                    {office.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Created Date
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                  <span className="text-gray-700">{formatDate(office.created_at)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

