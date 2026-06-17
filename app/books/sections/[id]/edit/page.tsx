'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Section {
  section_id: number
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

const showSuccessAlert = (title: string, message: string) => {
  console.log(`SUCCESS: ${title} - ${message}`)
  alert(`${title}: ${message}`)
}

const showErrorAlert = (title: string, message: string) => {
  console.error(`ERROR: ${title} - ${message}`)
  alert(`${title}: ${message}`)
}

export default function EditSectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [section, setSection] = useState<Section | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
          router.push('/dashboard')
          return
        }
        loadSection()
      } else {
        router.push('/login')
      }
    }
    checkAuth()
  }, [session, status, router])

  const loadSection = async () => {
    try {
      setLoading(true)
      const resolvedParams = await params
      const res = await fetch(`/api/sections/${resolvedParams.id}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const payload = data.data || data
        const s = payload.section || payload
        setSection(s)
        setFormData({
          name: s.name,
          description: s.description || '',
          is_active: s.is_active
        })
      } else {
        router.push('/books/sections')
      }
    } catch (error) {
      console.error('Failed to load section:', error)
      router.push('/books/sections')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    if (!formData.name.trim()) {
      showErrorAlert('Validation Error', 'Section name is required')
      setSaving(false)
      return
    }

    try {
      const resolvedParams = await params
      const response = await fetch(`/api/sections/${resolvedParams.id}`, {
        method: 'PUT',
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
        showSuccessAlert('Success', 'Section updated successfully')
        router.push('/books/sections')
      } else {
        const errorData = await response.json()
        showErrorAlert('Error', errorData.error || 'Failed to update section')
      }
    } catch (error) {
      showErrorAlert('Error', 'Network error occurred')
      console.error('Error updating section:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="px-6 py-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Loading section...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!section) {
    return (
      <div className="px-6 py-4">
        <div className="text-center text-gray-500">Section not found</div>
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
                Edit Section
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Update section information and details
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
              <CardTitle>Edit Section Information</CardTitle>
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
                      placeholder="Enter section name"
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
                      placeholder="Brief description of this section (optional)"
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
                    <Button type="button" variant="outline" onClick={() => router.back()} disabled={saving}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Updating Section...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-save mr-2"></i>
                          Update Section
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
