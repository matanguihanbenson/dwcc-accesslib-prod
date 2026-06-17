'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { notify } from '@/lib/notification'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pagination, PaginationControls } from '@/components/ui/pagination'

interface Category {
  category_id: number
  name: string
  description: string | null
  created_at: string
}

export default function CategoriesManagementPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') return

      if (status === 'authenticated' && session?.user) {
        if (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF') {
          router.push('/dashboard')
          return
        }
        loadCategories()
      } else {
        router.push('/login')
      }
    }
    checkAuth()
  }, [session, status, router])

  const loadCategories = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/book-categories', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setCategories(Array.isArray(data) ? data : (data.data || []))
      }
    } catch (error) {
      console.error('Failed to load categories:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (categoryId: number, categoryName: string) => {
    const ok = await notify.confirm('Delete this category?', `"${categoryName}" will be permanently removed.`)
    if (!ok) return
    
    try {
      const res = await fetch(`/api/book-categories/${categoryId}`, { 
        method: 'DELETE', 
        credentials: 'include' 
      })
      if (res.ok) {
        setCategories(prev => prev.filter(c => c.category_id !== categoryId))
        await notify.success('Category deleted')
      } else {
        await notify.error('Failed to delete category')
      }
    } catch (error) {
      console.error('Error deleting category:', error)
      await notify.error('Error occurred while deleting category')
    }
  }

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Pagination calculations
  const totalPages = Math.ceil(filteredCategories.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedCategories = filteredCategories.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1) // Reset to first page when changing items per page
  }

  if (status === 'loading' || loading) {
    return (
      <div className="px-6 py-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Loading categories...</div>
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
            <h1 className="text-xl font-semibold text-gray-800">
              Category Management System
            </h1>
            <Link 
              href="/books/categories/add"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center"
            >
              <i className="fas fa-plus mr-2"></i>
              Add New Category
            </Link>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Manage book categories and classifications
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        {/* Search and Controls */}
        <div className="mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1) // Reset to first page when searching
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          </div>
        </div>

        {/* Categories Table */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="text-gray-500">Loading categories...</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedCategories.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        {searchTerm ? 'No categories found matching your search.' : 'No categories found.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedCategories.map((category) => (
                      <tr key={category.category_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded bg-green-500 flex items-center justify-center">
                                <i className="fas fa-tags text-white text-sm"></i>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {category.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                ID: {category.category_id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {category.description || 'No description'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(category.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-1">
                            <Link
                              href={`/books/categories/${category.category_id}/edit`}
                              className="text-blue-600 hover:text-blue-900 px-2 py-1 text-sm border border-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit Category"
                            >
                              <i className="fas fa-edit"></i>
                            </Link>
                            
                            <Link
                              href={`/books/categories/${category.category_id}`}
                              className="text-gray-600 hover:text-gray-900 px-2 py-1 text-sm border border-gray-600 hover:bg-gray-50 rounded transition-colors"
                              title="View Details"
                            >
                              <i className="fas fa-eye"></i>
                            </Link>

                            <button
                              onClick={() => handleDelete(category.category_id, category.name)}
                              className="text-red-600 hover:text-red-900 px-2 py-1 text-sm border border-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete Category"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && filteredCategories.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredCategories.length}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            className="mt-4"
          />
        )}
      </div>
    </>
  )
}