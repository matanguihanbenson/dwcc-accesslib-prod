'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { notify } from '@/lib/notification'
import { EnhancedBookForm } from '@/components/forms/EnhancedBookForm'

export default function AddBookPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [authReady, setAuthReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<{ category_id: number; name: string }[]>([])
  const [sections, setSections] = useState<{ section_id: number; name: string }[]>([])
  
  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') {
        return
      }

      if (status === 'authenticated' && session?.user) {
        if (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF') {
          console.warn('Access denied: User does not have required privileges')
          router.push('/dashboard')
          return
        }
        console.log('NextAuth session ready for add book')
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
            const userData = await response.json()
            if (userData.role !== 'ADMIN' && userData.role !== 'STAFF') {
              console.warn('Access denied: User does not have required privileges')
              router.push('/dashboard')
              return
            }
            console.log('JWT token authentication ready for add book')
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
    if (!authReady) return
    
    const loadOptions = async () => {
      try {
        setLoading(true)
        const [catRes, secRes] = await Promise.all([
          fetch('/api/book-categories', { credentials: 'include' }),
          fetch('/api/sections', { credentials: 'include' })
        ])

        if (catRes.ok) {
          const catData = await catRes.json()
          const list = Array.isArray(catData) ? catData : (catData.data || [])
          setCategories(list)
        }

        if (secRes.ok) {
          const secData = await secRes.json()
          const list = Array.isArray(secData) ? secData : (secData.data || [])
          setSections(list)
        }
      } catch (err) {
        console.error('Failed to load categories/sections', err)
      } finally {
        setLoading(false)
      }
    }
    loadOptions()
  }, [authReady])
  
  const handleSubmit = async (data: any) => {
    try {
      notify.loading('Adding book...', 'Please wait while we save the record')
      const response = await fetch('/api/books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data)
      })

      if (response.ok) {
        notify.close()
        await notify.success('Success', 'Book added successfully')
        router.push('/books')
      } else {
        let message = 'Failed to add book'
        try {
          const errorData = await response.json()
          message = errorData.error || errorData.message || message
        } catch (_) {
          const text = await response.text()
          if (text) message = text
        }
        notify.close()
        await notify.error('Error', message)
      }
    } catch (error) {
      notify.close()
      await notify.error('Error', 'Network error occurred')
      console.error('Error adding book:', error)
    }
  }

  if (!authReady || loading) {
    return (
      <div className="px-6 py-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Loading...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header with Back Button and Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => router.push('/books')} className="text-gray-600 hover:text-gray-900 transition-colors">
            <i className="fas fa-arrow-left text-lg"></i>
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Add New Book</h1>
            <nav className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
              <button onClick={() => router.push('/books')} className="hover:text-gray-700">Books</button>
              <i className="fas fa-chevron-right text-xs"></i>
              <span className="text-gray-900 font-medium">Add New</span>
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <EnhancedBookForm
          categories={categories}
          sections={sections}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/books')}
          isEditing={false}
        />
      </div>
    </div>
  )
}
