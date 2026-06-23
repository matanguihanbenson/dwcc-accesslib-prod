'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Category {
  category_id: number
  name: string
  description: string | null
  created_at: string
}

interface BookLite {
  book_id: number
  title: string
  book_author: string
  status: string
  created_at: string
}

export default function CategoryViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [category, setCategory] = useState<Category | null>(null)
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
        loadCategory()
      } else {
        router.push('/login')
      }
    }
    checkAuth()
  }, [session, status, router])

  const loadCategory = async () => {
    try {
      setLoading(true)
      const resolvedParams = await params
      const res = await fetch(`/api/book-categories/${resolvedParams.id}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const payload = data.data || data
        setCategory(payload.category || payload)
        setRecentBooks(payload.recentBooks || [])
      } else {
        router.push('/books/categories')
      }
    } catch (error) {
      console.error('Failed to load category:', error)
      router.push('/books/categories')
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
            <div className="text-sm text-gray-600">Loading category...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!category) {
    return (
      <div className="px-6 py-4">
        <div className="text-center text-gray-500">Category not found</div>
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
                Category Details
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                View category information and details
              </p>
            </div>
            <div className="flex gap-2">
              <Link 
                href={`/books/categories/${category.category_id}/edit`}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center"
              >
                <i className="fas fa-edit mr-2"></i>
                Edit Category
              </Link>
              <Link 
                href="/books/categories"
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                <i className="fas fa-arrow-left mr-2"></i>
                Back to Categories
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="py-4">
        <div className="max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <div className="h-10 w-10 rounded bg-green-500 flex items-center justify-center mr-3">
                  <i className="fas fa-tags text-white text-sm"></i>
                </div>
                {category.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category ID
                  </label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                    {category.category_id}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category Name
                  </label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                    {category.name}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md min-h-[100px]">
                    {category.description || 'No description provided'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Created Date
                  </label>
                  <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                    {new Date(category.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Books */}
          <div className="mt-6 bg-white shadow-md rounded-lg overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b">
              <h3 className="text-lg font-medium text-gray-900">Recent Books in this Category</h3>
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
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No books found in this category.</td>
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
      </div>
    </>
  )
}
