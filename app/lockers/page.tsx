"use client";
import React, { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { UserRole } from '@/types'
import AdminView from './AdminView'
import StaffView from './StaffView'
import { notify } from '@/lib/notification'
import { LoadingScreen } from '@/components/ui/loading-spinner'

export default function LockersPage() {
  const { data: session, status } = useSession()
  const [lockers, setLockers] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  // Get user role
  const userRole = session?.user?.role as UserRole

  // Fetch lockers and transactions
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch lockers with transaction info
      const lockersResponse = await fetch('/api/lockers?include_transactions=true', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })

      if (lockersResponse.ok) {
        const lockersData = await lockersResponse.json()
        setLockers(lockersData.data || [])
      } else {
        console.error('Failed to fetch lockers')
        notify.error('Error', 'Failed to load lockers')
      }

      // Fetch transactions for admin view
      if (userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN) {
        const transactionsResponse = await fetch('/api/locker-transactions?status=all&limit=200', {
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache'
          }
        })

        console.log('Transactions Response Status:', transactionsResponse.status)

        if (transactionsResponse.ok) {
          const transactionsData = await transactionsResponse.json()
          console.log('Transactions Data:', transactionsData)
          console.log('Transactions Array:', transactionsData.data)
          console.log('Transactions Count:', transactionsData.data?.length || 0)
          setTransactions(transactionsData.data || [])
        } else {
          console.error('Failed to fetch transactions:', await transactionsResponse.text())
        }
      }
    } catch (error) {
      console.error('Error fetching locker data:', error)
      notify.error('Error', 'Failed to load locker data')
    } finally {
      setLoading(false)
    }
  }, [userRole])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData()
    }
  }, [status, fetchData, refreshKey])

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  if (status === 'loading' || loading) {
    return <LoadingScreen message="Loading lockers..." />
  }

  if (!session) {
    return <LoadingScreen message="Redirecting..." />
  }

  return (
    <div className="bg-gray-50 min-h-screen">
        <div className="bg-white shadow-sm border-b">
          <div className="px-8 py-4">
            <div className="flex items-center justify-between">
            <div>
                <h1 className="text-xl font-semibold text-gray-800">
                {userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN
                  ? 'Locker Management'
                  : 'Locker Status'}
                </h1>
              <p className="text-sm text-gray-600 mt-1">
                {userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN
                  ? 'Manage lockers and view usage records'
                  : 'Monitor and manage locker assignments'}
              </p>
              </div>
              
              {(userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN) && (
                <a 
                  href="/lockers/archive"
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center"
                >
                  <i className="fas fa-archive mr-2"></i>
                  View Archive
                </a>
              )}
          </div>
        </div>
                  </div>
                  
      {userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN ? (
        <AdminView
          lockers={lockers}
          transactions={transactions}
          onRefresh={handleRefresh}
        />
      ) : (
        <StaffView
          lockers={lockers}
          onRefresh={handleRefresh}
        />
        )}
      </div>
  )
}
