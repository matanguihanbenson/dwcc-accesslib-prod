'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { notify } from '@/lib/notification'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pagination, PaginationControls } from '@/components/ui/pagination'

interface Section {
  section_id: number
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

export default function SectionsManagementPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') return

      if (status === 'authenticated' && session?.user) {
        if (session.user.role !== 'ADMIN') {
          router.push('/dashboard')
          return
        }
        loadSections()
      } else {
        router.push('/login')
      }
    }
    checkAuth()
  }, [session, status, router])

  const loadSections = async () => {
    try {
      setLoading(true)
      // Load all sections (not just active ones for management)
      const res = await fetch('/api/sections?all=true', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setSections(Array.isArray(data) ? data : (data.data || []))
      }
    } catch (error) {
      console.error('Failed to load sections:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusToggle = async (sectionId: number, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/sections/${sectionId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
      })
      if (res.ok) {
        setSections(prev => prev.map(s => 
          s.section_id === sectionId ? { ...s, is_active: !currentStatus } : s
        ))
        await notify.success(`Section ${!currentStatus ? 'activated' : 'deactivated'}`)
      } else {
        await notify.error('Failed to update section status')
      }
    } catch (error) {
      console.error('Error updating section status:', error)
      await notify.error('Error occurred while updating section status')
    }
  }

  const handleDelete = async (sectionId: number, sectionName: string) => {
    const ok = await notify.confirm('Delete this section?', `"${sectionName}" will be permanently removed.`)
    if (!ok) return
    
    try {
      const res = await fetch(`/api/sections/${sectionId}`, { 
        method: 'DELETE', 
        credentials: 'include' 
      })
      if (res.ok) {
        setSections(prev => prev.filter(s => s.section_id !== sectionId))
        await notify.success('Section deleted')
      } else {
        await notify.error('Failed to delete section')
      }
    } catch (error) {
      console.error('Error deleting section:', error)
      await notify.error('Error occurred while deleting section')
    }
  }

  const filteredSections = sections.filter(section =>
    section.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (section.description && section.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Pagination calculations
  const totalPages = Math.ceil(filteredSections.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedSections = filteredSections.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1)
  }

  if (status === 'loading' || loading) {
    return (
      <div className="px-6 py-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Loading sections...</div>
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
              Section Management System
            </h1>
            <Link 
              href="/books/sections/add"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center"
            >
              <i className="fas fa-plus mr-2"></i>
              Add New Section
            </Link>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Manage book sections and library areas
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
                placeholder="Search sections..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
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

        {/* Sections Table */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="text-gray-500">Loading sections...</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Section Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
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
                  {paginatedSections.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        {searchTerm ? 'No sections found matching your search.' : 'No sections found.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedSections.map((section) => (
                      <tr key={section.section_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded bg-purple-500 flex items-center justify-center">
                                <i className="fas fa-layer-group text-white text-sm"></i>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {section.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                ID: {section.section_id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {section.description || 'No description'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            section.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {section.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(section.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-1">
                            <Link
                              href={`/books/sections/${section.section_id}/edit`}
                              className="text-blue-600 hover:text-blue-900 px-2 py-1 text-sm border border-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit Section"
                            >
                              <i className="fas fa-edit"></i>
                            </Link>
                            
                            <button
                              onClick={() => handleStatusToggle(section.section_id, section.is_active)}
                              className={`px-2 py-1 text-sm border rounded transition-colors ${
                                section.is_active
                                  ? 'text-orange-600 hover:text-orange-900 border-orange-600 hover:bg-orange-50'
                                  : 'text-green-600 hover:text-green-900 border-green-600 hover:bg-green-50'
                              }`}
                              title={section.is_active ? 'Deactivate Section' : 'Activate Section'}
                            >
                              <i className={`fas ${section.is_active ? 'fa-toggle-off' : 'fa-toggle-on'}`}></i>
                            </button>
                            
                            <Link
                              href={`/books/sections/${section.section_id}`}
                              className="text-gray-600 hover:text-gray-900 px-2 py-1 text-sm border border-gray-600 hover:bg-gray-50 rounded transition-colors"
                              title="View Details"
                            >
                              <i className="fas fa-eye"></i>
                            </Link>

                            <button
                              onClick={() => handleDelete(section.section_id, section.name)}
                              className="text-red-600 hover:text-red-900 px-2 py-1 text-sm border border-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete Section"
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
        {!loading && filteredSections.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredSections.length}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            className="mt-4"
          />
        )}
      </div>
    </>
  )
}