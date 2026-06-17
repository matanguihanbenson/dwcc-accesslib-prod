'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import UserEntryTab from './components/UserEntryTab'
import LockerUsageTab from './components/LockerUsageTab'
import BookBorrowedTab from './components/BookBorrowedTab'
import OverduesTab from './components/OverduesTab'

interface AdminViewProps {
  className?: string
  userEmail?: string | null
}

type UserEntryData = {
  totalToday: number
  totalThisWeek: number
  totalThisMonth: number
  uniqueUsersToday: number
  uniqueUsersWeek: number
  uniqueUsersMonth: number
  peakHour: string
  trend: 'up' | 'down' | 'stable'
}

type LockerUsageData = {
  totalLockers: number
  occupiedLockers: number
  availableLockers: number
  averageUsageTime: string
  mostUsedLocker: string
  utilizationRate: number
}

type BookBorrowedData = {
  borrowedToday: number
  borrowedThisWeek: number
  borrowedThisMonth: number
  popularBook: string
  averageBorrowDuration: string
  returnRate: number
}

type OverdueData = {
  totalOverdue: number
  overdueBooks: number
  overdueLockers: number
  totalFines: number
  oldestOverdue: string
  averageOverdueDays: number
}

type ChartData = {
  day: Array<{ name: string; entries: number; unique: number }>
  week: Array<{ name: string; entries: number; unique: number }>
  month: Array<{ name: string; entries: number; unique: number }>
  year: Array<{ name: string; entries: number; unique: number }>
}

function AdminView({ className, userEmail }: AdminViewProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'userEntry' | 'lockerUsage' | 'bookBorrowed' | 'overdues'>('userEntry')
  const [loading, setLoading] = useState(false) // Changed to false for immediate display
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [userEntryData, setUserEntryData] = useState<UserEntryData>({
    totalToday: 0,
    totalThisWeek: 0,
    totalThisMonth: 0,
    uniqueUsersToday: 0,
    uniqueUsersWeek: 0,
    uniqueUsersMonth: 0,
    peakHour: 'Loading...',
    trend: 'stable'
  })

  const [lockerUsageData, setLockerUsageData] = useState<LockerUsageData>({
    totalLockers: 0,
    occupiedLockers: 0,
    availableLockers: 0,
    averageUsageTime: 'Loading...',
    mostUsedLocker: 'Loading...',
    utilizationRate: 0
  })

  const [bookBorrowedData, setBookBorrowedData] = useState<BookBorrowedData>({
    borrowedToday: 0,
    borrowedThisWeek: 0,
    borrowedThisMonth: 0,
    popularBook: 'Loading...',
    averageBorrowDuration: 'Loading...',
    returnRate: 0
  })

  const [overdueData, setOverdueData] = useState<OverdueData>({
    totalOverdue: 0,
    overdueBooks: 0,
    overdueLockers: 0,
    totalFines: 0,
    oldestOverdue: 'Loading...',
    averageOverdueDays: 0
  })

  const [chartData, setChartData] = useState<ChartData>({
    day: [],
    week: [],
    month: [],
    year: []
  })

  useEffect(() => {
    fetchAnalytics()
    
    // Auto-refresh every 5 minutes for real-time updates
    const refreshInterval = setInterval(fetchAnalytics, 5 * 60 * 1000)
    
    return () => clearInterval(refreshInterval)
  }, [])

  const fetchAnalytics = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) setIsRefreshing(true)
      else setLoading(true)
      
      // Fetch comprehensive analytics from the admin analytics endpoint
      const response = await fetch('/api/dashboard/admin-analytics', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      
      if (response.ok) {
        const analytics = await response.json()
        console.log('Admin Analytics:', analytics) // Debug log
        
        // Map the comprehensive analytics data to component state
        setUserEntryData({
          totalToday: analytics.userEntry?.totalToday || 0,
          totalThisWeek: analytics.userEntry?.totalThisWeek || 0,
          totalThisMonth: analytics.userEntry?.totalThisMonth || 0,
          uniqueUsersToday: analytics.userEntry?.uniqueUsersToday || 0,
          uniqueUsersWeek: analytics.userEntry?.uniqueUsersWeek || 0,
          uniqueUsersMonth: analytics.userEntry?.uniqueUsersMonth || 0,
          peakHour: analytics.userEntry?.peakHour || 'N/A',
          trend: analytics.userEntry?.trend || 'stable'
        })
        
        setLockerUsageData({
          totalLockers: analytics.lockerUsage?.totalLockers || 0,
          occupiedLockers: analytics.lockerUsage?.occupiedLockers || 0,
          availableLockers: analytics.lockerUsage?.availableLockers || 0,
          averageUsageTime: analytics.lockerUsage?.averageUsageTime || 'N/A',
          mostUsedLocker: analytics.lockerUsage?.mostUsedLocker || 'N/A',
          utilizationRate: analytics.lockerUsage?.utilizationRate || 0
        })
        
        setBookBorrowedData({
          borrowedToday: analytics.bookBorrowed?.borrowedToday || 0,
          borrowedThisWeek: analytics.bookBorrowed?.borrowedThisWeek || 0,
          borrowedThisMonth: analytics.bookBorrowed?.borrowedThisMonth || 0,
          popularBook: analytics.bookBorrowed?.popularBook || 'N/A',
          averageBorrowDuration: analytics.bookBorrowed?.averageBorrowDuration || 'N/A',
          returnRate: analytics.bookBorrowed?.returnRate || 0
        })
        
        setOverdueData({
          totalOverdue: analytics.overdues?.totalOverdue || 0,
          overdueBooks: analytics.overdues?.overdueBooks || 0,
          overdueLockers: analytics.overdues?.overdueLockers || 0,
          totalFines: analytics.overdues?.totalFines || 0,
          oldestOverdue: analytics.overdues?.oldestOverdue || 'None',
          averageOverdueDays: analytics.overdues?.averageOverdueDays || 0
        })
        
        // Set chart data
        setChartData({
          day: analytics.chartData?.day || [],
          week: analytics.chartData?.week || [],
          month: analytics.chartData?.month || [],
          year: analytics.chartData?.year || []
        })
        
        setLastUpdated(new Date())
        
      } else {
        console.error('Failed to fetch admin analytics:', response.status, response.statusText)
      }
      
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  return (
    <div className={`p-4 space-y-4 ${className || ''}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Library Overview Reports</h2>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Quick Actions</h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          <Link
            href="/reports"
            className="aspect-square flex flex-col items-center justify-center p-2 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            <i className="fas fa-chart-bar text-blue-600 text-xl mb-1"></i>
            <p className="text-xs font-medium text-gray-700 text-center leading-tight">View Reports</p>
          </Link>
          <Link
            href="/users/register"
            className="aspect-square flex flex-col items-center justify-center p-2 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            <i className="fas fa-user-tie text-teal-600 text-xl mb-1"></i>
            <p className="text-xs font-medium text-gray-700 text-center leading-tight">Manage Staff</p>
          </Link>
          <Link
            href="/lockers"
            className="aspect-square flex flex-col items-center justify-center p-2 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            <i className="fas fa-lock text-orange-600 text-xl mb-1"></i>
            <p className="text-xs font-medium text-gray-700 text-center leading-tight">Manage Lockers</p>
          </Link>
          <Link
            href="/books"
            className="aspect-square flex flex-col items-center justify-center p-2 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            <i className="fas fa-book text-green-600 text-xl mb-1"></i>
            <p className="text-xs font-medium text-gray-700 text-center leading-tight">Book Management</p>
          </Link>
          <Link
            href="/overdue"
            className="aspect-square flex flex-col items-center justify-center p-2 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            <i className="fas fa-exclamation-triangle text-red-600 text-xl mb-1"></i>
            <p className="text-xs font-medium text-gray-700 text-center leading-tight">Handle Overdues</p>
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-6 px-4" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('userEntry')}
              className={`py-3 px-1 border-b-2 font-medium text-xs ${
                activeTab === 'userEntry'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <i className="fas fa-users mr-1 text-xs"></i>
              User Entry
            </button>
            <button
              onClick={() => setActiveTab('lockerUsage')}
              className={`py-3 px-1 border-b-2 font-medium text-xs ${
                activeTab === 'lockerUsage'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <i className="fas fa-archive mr-1 text-xs"></i>
              Locker Usage
            </button>
            <button
              onClick={() => setActiveTab('bookBorrowed')}
              className={`py-3 px-1 border-b-2 font-medium text-xs ${
                activeTab === 'bookBorrowed'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <i className="fas fa-book mr-1 text-xs"></i>
              Book Borrowed
            </button>
            <button
              onClick={() => setActiveTab('overdues')}
              className={`py-3 px-1 border-b-2 font-medium text-xs ${
                activeTab === 'overdues'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <i className="fas fa-exclamation-triangle mr-1 text-xs"></i>
              Overdues
            </button>
          </nav>
        </div>

        <div className="p-4">
          {activeTab === 'userEntry' && (
            <UserEntryTab userEntryData={userEntryData} chartData={chartData} />
          )}

          {activeTab === 'lockerUsage' && (
            <LockerUsageTab lockerUsageData={lockerUsageData} />
          )}

          {activeTab === 'bookBorrowed' && (
            <BookBorrowedTab bookBorrowedData={bookBorrowedData} />
          )}

          {activeTab === 'overdues' && (
            <OverduesTab overdueData={overdueData} userEmail={userEmail} />
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminView
