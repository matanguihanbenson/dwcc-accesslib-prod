'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingScreen } from '@/components/ui/loading-spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PaginationControls } from '@/components/ui/pagination'
import { UserRole, Campus } from '@/types'
import { formatDate } from '@/lib/utils'
import { notify } from '@/lib/notification'
import { useApiSWR } from '@/lib/hooks/useApi'

interface Entrance {
  entrance_id: number
  name: string
  campus: Campus
  description?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  archived_at?: string | null
}

const CAMPUS_LABEL: Record<Campus, string> = {
  COLLEGE: 'College',
  BASIC_EDUCATION: 'Basic Education'
}

const CAMPUS_BADGE: Record<Campus, string> = {
  COLLEGE: 'bg-blue-100 text-blue-800',
  BASIC_EDUCATION: 'bg-amber-100 text-amber-800'
}

export default function EntrancesPage() {
  const { data: session, status } = useSession()
  const [searchQuery, setSearchQuery] = useState('')
  const [campusFilter, setCampusFilter] = useState<'' | Campus>('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // SWR is keyed off the filters so the table re-fetches
  // when the user narrows the list.
  const apiKey = useMemo(() => {
    const params = new URLSearchParams()
    if (searchQuery) params.append('query', searchQuery)
    if (campusFilter) params.append('campus', campusFilter)
    return `/api/entrances?${params.toString()}`
  }, [searchQuery, campusFilter])

  const {
    data: response,
    error,
    isLoading,
    mutate: refresh
  } = useApiSWR<any>(session ? apiKey : null, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 1000
  })

  const entrances: Entrance[] = useMemo(() => {
    if (!response) return []
    if (Array.isArray(response)) return response
    if (Array.isArray(response.data)) return response.data
    return []
  }, [response])

  const filteredEntrances = useMemo(() => {
    if (!searchQuery) return entrances
    const q = searchQuery.toLowerCase()
    return entrances.filter((e) =>
      e.name.toLowerCase().includes(q) ||
      (e.description || '').toLowerCase().includes(q)
    )
  }, [entrances, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredEntrances.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginated = filteredEntrances.slice(startIndex, startIndex + itemsPerPage)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, campusFilter])

  const handleArchive = async (e: Entrance) => {
    const confirmed = await notify.confirm(
      'Archive entrance',
      `Archive "${e.name}" on the ${CAMPUS_LABEL[e.campus]} campus? Historical entry logs that reference it will keep working.`
    )
    if (!confirmed) return
    try {
      const res = await fetch(`/api/entrances/${e.entrance_id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        await notify.error('Error', body.error || 'Failed to archive entrance')
        return
      }
      await notify.success('Archived', `"${e.name}" has been archived.`)
      refresh()
    } catch (err) {
      console.error('Archive entrance error:', err)
      await notify.error('Error', 'Network error while archiving entrance')
    }
  }

  const handleToggleActive = async (e: Entrance) => {
    try {
      const res = await fetch(`/api/entrances/${e.entrance_id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !e.is_active })
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        await notify.error('Error', body.error || 'Failed to update entrance')
        return
      }
      await notify.success(
        'Updated',
        `"${e.name}" is now ${!e.is_active ? 'active' : 'inactive'}.`
      )
      refresh()
    } catch (err) {
      console.error('Toggle entrance error:', err)
      await notify.error('Error', 'Network error while updating entrance')
    }
  }

  if (status === 'loading') return <LoadingScreen />
  if (!session) return null

  const userRole = session.user.role as UserRole
  if (userRole !== UserRole.SUPER_ADMIN) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
        <p className="text-gray-600 mt-2">
          You don&apos;t have permission to view this page.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Entrances</h1>
          <p className="text-gray-600 text-sm">
            Manage the per-campus entrances staff can pick from on the entry management page.
          </p>
        </div>
        <Button
          className="bg-primary-600 h-[50px] px-4 hover:bg-primary-800 text-white"
          onClick={() => setShowAddModal(true)}
        >
          <i className="fas fa-plus mr-2" />
          Add Entrance
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-lg">All Entrances</CardTitle>
            <div className="flex items-center space-x-3 flex-wrap">
              <Input
                placeholder="Search by name or description…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
                icon={<i className="fas fa-search" />}
              />
              <select
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={campusFilter}
                onChange={(e) =>
                  setCampusFilter(e.target.value as '' | Campus)
                }
              >
                <option value="">All Campuses</option>
                <option value={Campus.COLLEGE}>College</option>
                <option value={Campus.BASIC_EDUCATION}>Basic Education</option>
              </select>
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(n) => {
                  setItemsPerPage(n)
                  setCurrentPage(1)
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading && !entrances.length ? (
            <div className="text-center py-8">
              <LoadingScreen message="Loading entrances..." />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              Error loading entrances: {(error as any)?.message || 'Unknown error'}
              <div className="mt-3">
                <Button onClick={() => refresh()}>
                  <i className="fas fa-retry mr-2" /> Retry
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2">Name</TableHead>
                  <TableHead className="py-2">Campus</TableHead>
                  <TableHead className="py-2">Description</TableHead>
                  <TableHead className="py-2">Status</TableHead>
                  <TableHead className="py-2">Created</TableHead>
                  <TableHead className="py-2">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      {searchQuery || campusFilter
                        ? 'No entrances match your filters.'
                        : 'No entrances yet. Add the first one to get started.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((e) => (
                    <TableRow key={e.entrance_id} className="hover:bg-gray-50">
                      <TableCell className="py-2 font-medium text-gray-900">
                        {e.name}
                      </TableCell>
                      <TableCell className="py-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CAMPUS_BADGE[e.campus]}`}
                        >
                          {CAMPUS_LABEL[e.campus]}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 text-sm text-gray-600 max-w-md">
                        {e.description || (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        {e.archived_at ? (
                          <Badge variant="outline">Archived</Badge>
                        ) : e.is_active ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge>Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-sm">
                        {formatDate(e.created_at)}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center space-x-1">
                          {!e.archived_at && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleActive(e)}
                              className={`py-4 px-2 ${
                                e.is_active
                                  ? 'text-orange-600 hover:text-orange-900 !border-orange-500 hover:bg-orange-50'
                                  : 'text-green-600 hover:text-green-900 !border-green-600 hover:bg-green-50'
                              }`}
                              title={e.is_active ? 'Deactivate' : 'Activate'}
                            >
                              <i
                                className={`fas ${
                                  e.is_active ? 'fa-pause' : 'fa-play'
                                } text-xs`}
                              />
                            </Button>
                          )}
                          {!e.archived_at && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleArchive(e)}
                              className="py-4 px-2 text-gray-600 hover:text-gray-900 !border-gray-600 hover:bg-gray-50"
                              title="Archive"
                            >
                              <i className="fas fa-archive text-xs" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {showAddModal && (
        <AddEntranceModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function AddEntranceModal({
  onClose,
  onCreated
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [campus, setCampus] = useState<Campus>(Campus.COLLEGE)
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      await notify.warning('Missing name', 'Please enter a name for the entrance.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/entrances', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          campus,
          description: description.trim() || null,
          is_active: isActive
        })
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        await notify.error('Error', body.error || 'Failed to create entrance')
        return
      }
      await notify.success('Entrance created', `"${name.trim()}" was added to the ${CAMPUS_LABEL[campus]} campus.`)
      onCreated()
    } catch (err) {
      console.error('Create entrance error:', err)
      await notify.error('Error', 'Network error while creating entrance')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] w-screen h-screen m-0 p-0 bg-black/50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Add Entrance</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <i className="fas fa-times" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-600">*</span>
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main Library Entrance"
                maxLength={100}
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Campus <span className="text-red-600">*</span>
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                value={campus}
                onChange={(e) => setCampus(e.target.value as Campus)}
                required
              >
                <option value={Campus.COLLEGE}>College</option>
                <option value={Campus.BASIC_EDUCATION}>Basic Education</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Only staff assigned to this campus will see this entrance.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional — what is this entrance for?"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-gray-700">Active (visible to staff immediately)</span>
            </label>
          </div>
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <i className="fas fa-spinner fa-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <i className="fas fa-plus" />
                  Add Entrance
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
