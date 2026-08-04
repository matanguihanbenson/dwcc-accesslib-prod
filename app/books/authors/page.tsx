'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { PageLayout, PageHeader } from '@/components/layout/PageLayout'
import { Pagination } from '@/components/ui/pagination'
import { notify } from '@/lib/notification'

interface Person {
  name: string
  dates: string | null
  roles: string[]
  books: Array<{ book_id: number; title: string; role: string; category?: { name: string } }>
  cutter_numbers: string[]
  is_active: boolean
}

type SortOption = 'name-asc' | 'name-desc' | 'books-desc' | 'books-asc' | 'cutter-asc' | 'cutter-desc'

export default function AuthorsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('name-asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, roleFilter, categoryFilter, activeFilter, sortBy, itemsPerPage])

  const queryParams = new URLSearchParams()
  if (debouncedSearch) queryParams.set('search', debouncedSearch)
  if (roleFilter) queryParams.set('role', roleFilter)
  if (categoryFilter) queryParams.set('category', categoryFilter)
  if (sortBy) queryParams.set('sort', sortBy)
  if (activeFilter) queryParams.set('active', activeFilter)
  queryParams.set('page', String(currentPage))
  queryParams.set('limit', String(itemsPerPage))
  const queryString = queryParams.toString()

  const [people, setPeople] = useState<Person[]>([])
  const [serverTotal, setServerTotal] = useState(0)
  const [availableRoles, setAvailableRoles] = useState<string[]>([])
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  const fetchAuthors = useCallback(async () => {
    if (status !== 'authenticated') return
    setLoading(true)
    try {
      const res = await fetch(`/api/authors?${queryString}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const d = data.data || data
        setPeople(d.people || [])
        setServerTotal(d.total || 0)
        setAvailableRoles(d.roles || [])
        setAvailableCategories(d.categories || [])
      }
    } catch (err) {
      console.error('Failed to fetch authors:', err)
    } finally {
      setLoading(false)
    }
  }, [status, queryString])

  useEffect(() => {
    fetchAuthors()
  }, [fetchAuthors])

  const totalPages = Math.ceil(serverTotal / itemsPerPage)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (n: number) => {
    setItemsPerPage(n)
    setCurrentPage(1)
  }

  const handleToggleActive = async (person: Person) => {
    setToggling(person.name)
    try {
      const res = await fetch('/api/authors/toggle-active', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: person.name })
      })
      if (res.ok) {
        const data = await res.json()
        const d = data.data || data
        await notify.success('Success', d.message || `Author ${d.is_active ? 'activated' : 'deactivated'}`)
        fetchAuthors()
      } else {
        const err = await res.json()
        await notify.error('Error', err.error || 'Failed to update author')
      }
    } catch {
      await notify.error('Error', 'Network error occurred')
    } finally {
      setToggling(null)
    }
  }

  return (
    <PageLayout>
      <PageHeader
        title="Authors & Contributors"
        description={`${serverTotal} ${serverTotal === 1 ? 'person' : 'people'} in the catalog`}
      >
        <Link
          href="/books"
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors inline-flex items-center"
        >
          <i className="fas fa-arrow-left mr-2"></i>
          Back to Books
        </Link>
      </PageHeader>

      {/* Search & Filters */}
      <div className="bg-white shadow-sm border-b mb-6">
        <div className="px-6 py-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  type="text"
                  placeholder="Search by name or book title..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="w-full lg:w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Roles</option>
                {availableRoles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="w-full lg:w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="w-full lg:w-40">
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div className="w-full lg:w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="books-desc">Most Books</option>
                <option value="books-asc">Fewest Books</option>
                <option value="cutter-asc">Cutter (A-Z)</option>
                <option value="cutter-desc">Cutter (Z-A)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Pagination Top */}
      {!loading && serverTotal > 0 && (
        <div className="mb-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={serverTotal}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
            countLabel="authors"
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Loading authors...</div>
          </div>
        </div>
      ) : people.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <i className="fas fa-user-slash text-4xl mb-3 text-gray-300"></i>
          <p className="text-sm text-gray-600">
            {debouncedSearch || roleFilter || categoryFilter || activeFilter ? 'No authors match your filters.' : 'No authors or contributors found.'}
          </p>
          {(debouncedSearch || roleFilter || categoryFilter || activeFilter) && (
            <button
              onClick={() => { setSearch(''); setRoleFilter(''); setCategoryFilter(''); setActiveFilter('') }}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Role(s)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Books
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Cutter(s)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {people.map((person) => (
                  <tr key={person.name} className={`hover:bg-gray-50 transition-colors ${!person.is_active ? 'bg-gray-50 opacity-60' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <i className="fas fa-user text-blue-500 text-xs"></i>
                        </div>
                        <div>
                          <Link
                            href={`/books/authors/${encodeURIComponent(person.name)}`}
                            className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
                          >
                            {person.name}
                          </Link>
                          {!person.is_active && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {person.roles.map((role) => (
                          <span
                            key={role}
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              role === 'Author'
                                ? 'bg-blue-100 text-blue-800'
                                : role === 'Editor'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">{person.books.length}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {person.cutter_numbers.map((c) => (
                          <span key={c} className="text-xs font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                            {c}
                          </span>
                        ))}
                        {person.cutter_numbers.length === 0 && <span className="text-xs text-gray-400">—</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/books/authors/${encodeURIComponent(person.name)}`}
                          className="inline-flex items-center justify-center w-9 h-9 text-blue-600 bg-blue-100 hover:bg-blue-50 rounded-md transition-colors"
                          title="View Author"
                        >
                          <i className="fas fa-eye"></i>
                        </Link>
                        <button
                          onClick={() => handleToggleActive(person)}
                          disabled={toggling === person.name}
                          className={`inline-flex items-center justify-center w-9 h-9 rounded-md transition-colors disabled:opacity-50 ${
                            person.is_active
                              ? 'text-red-600 bg-red-100 hover:bg-red-50'
                              : 'text-green-600 bg-green-100 hover:bg-green-50'
                          }`}
                          title={person.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {toggling === person.name ? (
                            <i className="fas fa-spinner fa-spin"></i>
                          ) : person.is_active ? (
                            <i className="fas fa-ban"></i>
                          ) : (
                            <i className="fas fa-check"></i>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Bottom */}
      {!loading && serverTotal > 0 && (
        <div className="mt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={serverTotal}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
            countLabel="authors"
          />
        </div>
      )}
    </PageLayout>
  )
}
