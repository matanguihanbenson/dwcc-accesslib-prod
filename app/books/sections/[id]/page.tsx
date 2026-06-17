'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Section {
  section_id: number
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

interface BookLite {
  book_id: number
  title: string
  book_author: string
  status: string
  created_at: string
}

export default function SectionViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [section, setSection] = useState<Section | null>(null)
  const [recentBooks, setRecentBooks] = useState<BookLite[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') return

      if (status === 'authenticated' && session?.user) {
        if (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF') {
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
        setSection(payload.section || payload)
        setRecentBooks(payload.recentBooks || [])
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
                Section Details
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                View section information and details
              </p>
            </div>
            <div className="flex gap-2">
              <Link 
                href={`/books/sections/${section.section_id}/edit`}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center"
              >
                <i className="fas fa-edit mr-2"></i>
                Edit Section
              </Link>
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
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <div className="h-10 w-10 rounded bg-purple-500 flex items-center justify-center mr-3">
                  <i className="fas fa-layer-group text-white text-sm"></i>
                </div>
                {section.name}
                <span className={`ml-3 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  section.is_active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {section.is_active ? 'Active' : 'Inactive'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Section ID
                  </label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                    {section.section_id}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Section Name
                  </label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                    {section.name}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      section.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {section.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Created Date
                  </label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                    {new Date(section.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md min-h-[100px]">
                    {section.description || 'No description provided'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Books */}
        <div className="max-w-5xl mx-auto mt-6 bg-white shadow-md rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h3 className="text-lg font-medium text-gray-900">Recent Books in this Section</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Author</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Added</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentBooks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No books found in this section.</td>
                  </tr>
                ) : (
                  recentBooks.map(b => (
                    <tr key={b.book_id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm text-gray-900">{b.title}</td>
                      <td className="px-6 py-3 text-sm text-gray-900">{b.book_author}</td>
                      <td className="px-6 py-3">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{b.status}</span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-900">{new Date(b.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-3 text-right">
                        <Link href={`/books/${b.book_id}/view`} className="text-gray-600 hover:text-gray-900 px-2 py-1 text-sm border border-gray-600 hover:bg-gray-50 rounded transition-colors">
                          <i className="fas fa-eye"></i>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
