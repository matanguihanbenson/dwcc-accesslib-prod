"use client"
import React, { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { UserRole } from '@/types'
import { notify } from '@/lib/notification'
import { LoadingScreen } from '@/components/ui/loading-spinner'

export default function LockersArchivePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [lockers, setLockers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isRestoring, setIsRestoring] = useState(false)

  const userRole = session?.user?.role as UserRole

  // Fetch archived lockers
  const fetchArchivedLockers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/lockers?status=ARCHIVED', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })

      if (response.ok) {
        const data = await response.json()
        // Filter only archived lockers (in case API returns others)
        const archivedLockers = (data.data || []).filter((locker: any) => 
          locker.status === 'ARCHIVED' || locker.archived_at !== null
        )
        setLockers(archivedLockers)
      } else {
        notify.error('Error', 'Failed to load archived lockers')
      }
    } catch (error) {
      console.error('Error fetching archived lockers:', error)
      notify.error('Error', 'Failed to load archived lockers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetchArchivedLockers()
    }
  }, [status])

  const handleUnarchiveLocker = async (locker: any) => {
    const confirmed = await notify.confirm(
      'Restore Locker?',
      `Are you sure you want to restore locker ${locker.locker_number}? It will be set to AVAILABLE status.`
    )

    if (!confirmed) return

    try {
      setIsRestoring(true)
      const response = await fetch(`/api/lockers/${locker.locker_id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'AVAILABLE',
          unarchive: true
        })
      })

      if (response.ok) {
        notify.success('Success', 'Locker restored successfully')
        fetchArchivedLockers()
      } else {
        const error = await response.json()
        if (error?.error === 'RFID_CONFLICT') {
          const proceed = await notify.confirm(
            'RFID Conflict',
            `${error.message} Do you want to unbind the RFID from this archived locker and proceed?`
          )
          if (proceed) {
            const retry = await fetch(`/api/lockers/${locker.locker_id}`, {
              method: 'PATCH',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: 'AVAILABLE',
                unarchive: true,
                unbind_rfid: true
              })
            })
            const retryResult = await retry.json()
            if (retry.ok) {
              notify.success('Success', 'RFID unbound and locker restored')
              fetchArchivedLockers()
            } else {
              notify.error('Error', retryResult.error || 'Failed to restore locker')
            }
          }
        } else {
          notify.error('Error', error.error || 'Failed to restore locker')
        }
      }
    } catch (error) {
      notify.error('Error', 'Failed to restore locker')
    } finally {
      setIsRestoring(false)
    }
  }

  // Filter lockers
  const filteredLockers = useMemo(() => {
    return lockers.filter(locker => {
      const matchesSearch = locker.locker_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            locker.location.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesSearch
    })
  }, [lockers, searchTerm])

  if (status === 'loading' || loading) {
    return <LoadingScreen message="Loading archived lockers..." />
  }

  if (!session) {
    return <LoadingScreen message="Redirecting..." />
  }

  if (userRole !== UserRole.ADMIN && userRole !== UserRole.SUPER_ADMIN) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
        <p className="text-gray-600 mt-2">You don't have permission to view this page.</p>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      AVAILABLE: 'bg-green-100 text-green-800',
      OCCUPIED: 'bg-blue-100 text-blue-800',
      DAMAGED: 'bg-red-100 text-red-800',
      MAINTENANCE: 'bg-yellow-100 text-yellow-800',
      ARCHIVED: 'bg-gray-100 text-gray-800'
    }
    return colors[status] || colors.AVAILABLE
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white shadow-sm border-b">
        <div className="px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-800">
                Archived Lockers
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                View and restore archived lockers
              </p>
            </div>
            
            <button 
              onClick={() => router.push('/lockers')}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center"
            >
              <i className="fas fa-arrow-left mr-2"></i>
              Back to Lockers
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="space-y-4">
          {/* Search */}
          <div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by locker number or location..."
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Lockers Table */}
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Locker Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      RFID Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Archived Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredLockers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        {searchTerm ? 'No archived lockers found matching your search.' : 'No archived lockers found.'}
                      </td>
                    </tr>
                  ) : (
                    filteredLockers.map((locker) => (
                      <tr key={locker.locker_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {locker.locker_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {locker.location}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(locker.status)}`}>
                            {locker.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {locker.rfid_code ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs bg-blue-50 px-2 py-1 rounded border border-blue-200">
                                {locker.rfid_code}
                              </span>
                              <i className="fas fa-check-circle text-green-500 text-xs" title="RFID Bound"></i>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">Not bound</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {locker.archived_at ? new Date(locker.archived_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleUnarchiveLocker(locker)}
                            className="text-green-600 hover:text-green-900"
                            title="Restore Locker"
                            disabled={isRestoring}
                          >
                            <i className="fas fa-undo"></i>
                          </button>
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
    </div>
  )
}
