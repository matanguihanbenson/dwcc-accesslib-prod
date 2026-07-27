'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useApiSWR } from '@/lib/hooks/useApi'
import { PageLayout, PageHeader } from '@/components/layout/PageLayout'

interface Person {
  name: string
  dates: string | null
  roles: string[]
  books: Array<{ book_id: number; title: string; role: string; category?: { name: string } }>
  cutter_numbers: string[]
}

export default function AuthorsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'books'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const queryParams = new URLSearchParams()
  if (search) queryParams.set('search', search)
  if (roleFilter) queryParams.set('role', roleFilter)
  if (categoryFilter) queryParams.set('category', categoryFilter)
  const queryString = queryParams.toString()

  const { data, isLoading } = useApiSWR<{ data: { people: Person[]; total: number; categories: string[]; roles: string[] } }>(
    status === 'authenticated' ? `/api/authors${queryString ? `?${queryString}` : ''}` : null
  )

  const allPeople: Person[] = data?.data?.people || []
  const availableRoles: string[] = data?.data?.roles || []
  const availableCategories: string[] = data?.data?.categories || []

  const filteredPeople = useMemo(() => {
    let list = allPeople

    // Text search (client-side for book titles — name search is server-side)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.books.some((b) => b.title.toLowerCase().includes(q))
      )
    }

    // Sort
    list = [...list].sort((a, b) => {
      let cmp = 0
      if (sortBy === 'name') {
        cmp = a.name.localeCompare(b.name)
      } else {
        cmp = a.books.length - b.books.length
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

    return list
  }, [allPeople, search, sortBy, sortOrder])

  const toggleSort = (field: 'name' | 'books') => {
    if (sortBy === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  return (
    <PageLayout>
      <PageHeader
        title="Authors & Contributors"
        description={`${filteredPeople.length} of ${allPeople.length} ${allPeople.length === 1 ? 'person' : 'people'} in the catalog`}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-') as [typeof sortBy, typeof sortOrder]
                  setSortBy(field)
                  setSortOrder(order)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="books-desc">Most Books</option>
                <option value="books-asc">Fewest Books</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Loading authors...</div>
          </div>
        </div>
      ) : filteredPeople.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <i className="fas fa-user-slash text-4xl mb-3 text-gray-300"></i>
          <p className="text-sm text-gray-600">
            {search || roleFilter || categoryFilter ? 'No authors match your filters.' : 'No authors or contributors found.'}
          </p>
          {(search || roleFilter || categoryFilter) && (
            <button
              onClick={() => { setSearch(''); setRoleFilter(''); setCategoryFilter('') }}
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
                  <th
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => toggleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Name
                      {sortBy === 'name' && (
                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'} text-blue-600`}></i>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Role(s)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Dates
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => toggleSort('books')}
                  >
                    <div className="flex items-center gap-1">
                      Books
                      {sortBy === 'books' && (
                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'} text-blue-600`}></i>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Cutter(s)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPeople.map((person) => (
                  <tr key={person.name} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <Link
                        href={`/books/authors/${encodeURIComponent(person.name)}`}
                        className="flex items-center gap-3 group"
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                          <i className="fas fa-user text-blue-500 text-xs"></i>
                        </div>
                        <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                          {person.name}
                        </span>
                      </Link>
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
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {person.dates || '—'}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
