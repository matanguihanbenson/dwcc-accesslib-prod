'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notification'


export default function AddSectionPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [authReady, setAuthReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true
  })

  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') return

      if (status === 'authenticated' && session?.user) {
        if (session.user.role !== 'ADMIN') {
          console.warn('Access denied: User does not have ADMIN privileges')
          router.push('/dashboard')
          return
        }
        setAuthReady(true)
      } else {
        router.push('/login')
      }
    }
    checkAuth()
  }, [session, status, router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (!formData.name.trim()) {
      await notify.error('Validation Error', 'Section name is required')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/sections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          is_active: formData.is_active
        })
      })

      if (response.ok) {
        await notify.success('Success', 'Section added successfully')
        router.push('/books/sections')
      } else {
        const errorData = await response.json()
        await notify.error('Error', errorData.error || 'Failed to add section')
      }
    } catch (error) {
      await notify.error('Error', 'Network error occurred')
      console.error('Error adding section:', error)
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

  return (
    <>
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-800">
                Add New Section
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Create a new book section for library organization
              </p>
            </div>
            <Link 
              href="/books/sections"
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              <i className="fas fa-arrow-left mr-2"></i>
              Back to Sections
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Section Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Section Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter section name (e.g., Ground Floor, Reference Area, Children's Section)"
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
                      placeholder="Brief description of this section or its location (optional)"
                    />
                  </div>

                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="is_active"
                        checked={formData.is_active}
                        onChange={handleInputChange}
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Active (section is available for use)
                      </span>
                    </label>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <div className="text-sm text-gray-500">
                    <span className="text-red-500">*</span> Required fields
                  </div>
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Adding Section...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-plus mr-2"></i>
                          Add Section
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
