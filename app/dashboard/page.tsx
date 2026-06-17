'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingScreen } from '@/components/ui/loading-spinner'
import { UserRole } from '@/types'
import AdminView from '@/components/dashboard/AdminView'
import { LineChart, BarChart, PieChart } from '@/components/charts'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const [isMounted, setIsMounted] = useState(false)
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [loadingActivities, setLoadingActivities] = useState(true)
  const activitiesInitializedRef = useRef(false)
  const [dashboardStats, setDashboardStats] = useState<any>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  
  // Staff dashboard specific state with initial fallback data
  const [todayEntryLogs, setTodayEntryLogs] = useState<any[]>([])
  const [recentLockerTransactions, setRecentLockerTransactions] = useState<any[]>([])
  const [activeBorrows, setActiveBorrows] = useState<any[]>([])
  const [overdueAlerts, setOverdueAlerts] = useState<any[]>([])
  const [usageChartData, setUsageChartData] = useState<any[]>(() => {
    // Initialize with empty data for the last 7 days to prevent chart loading issues
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      return {
        name: date.toLocaleDateString('en-US', { weekday: 'short' }),
        entries: 0,
        books: 0,
        lockers: 0
      }
    })
  })
  const [loadingStaffData, setLoadingStaffData] = useState(false) // Changed to false for background loading
  const [staffAnalytics, setStaffAnalytics] = useState<any>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Set mounted state after initial render to prevent flashing
  useEffect(() => {
    // Mark as mounted immediately - session check is handled by middleware
    setIsMounted(true)
  }, [])

  // Fetch recent activities (role-scoped by backend)
  useEffect(() => {
    if (status !== 'loading' && session) {
    const fetchRecentActivities = async () => {
      try {
        if (!activitiesInitializedRef.current) {
          setLoadingActivities(true)
        }

        const response = await fetch('/api/activity-logs?limit=3', {
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        })
        if (response.ok) {
          const data = await response.json()
          setRecentActivities(data.logs || [])
        }
      } catch (error) {
      } finally {
        activitiesInitializedRef.current = true
        setLoadingActivities(false)
      }
    }

    fetchRecentActivities()

    // Keep the widget up-to-date without UI flashing
    const interval = setInterval(fetchRecentActivities, 30000)
    window.addEventListener('focus', fetchRecentActivities)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', fetchRecentActivities)
    }
    }
  }, [status, session])

  // Fetch role-based dashboard statistics
  useEffect(() => {
    if (status !== 'loading' && session) {
      const fetchDashboardStats = async () => {
        try {
          setLoadingStats(true)
          const response = await fetch('/api/dashboard/stats', {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          })
          if (response.ok) {
            const data = await response.json()
            setDashboardStats(data)
          } else {
          }
        } catch (error) {
        } finally {
          setLoadingStats(false)
        }
      }

      fetchDashboardStats()
    }
  }, [status, session])

  // Fetch staff-specific data
  useEffect(() => {
    const userRole = session?.user?.role as UserRole
    if (userRole === UserRole.STAFF) {
      const fetchStaffData = async (showRefreshIndicator = false) => {
        try {
          if (showRefreshIndicator) setIsRefreshing(true)
          
          // Fetch real analytics data for chart
          const analyticsResponse = await fetch('/api/dashboard/staff-analytics', {
            credentials: 'include',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          })
          if (analyticsResponse.ok) {
            const analyticsData = await analyticsResponse.json()
            setUsageChartData(analyticsData.usageChartData || [])
            setStaffAnalytics(analyticsData)
          }
          
          // Fetch other data in parallel without blocking the UI
          const [entryLogsResponse, lockersResponse, borrowsResponse, overdueResponse] = await Promise.all([
            fetch('/api/entry-logs?limit=10&include_user=true', {
              credentials: 'include',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              }
            }),
            fetch('/api/lockers/recent-transactions?limit=10'),
            fetch('/api/borrowing-transactions?status=ACTIVE&limit=10'),
            fetch('/api/overdue')
          ])

          // Process responses
          if (entryLogsResponse.ok) {
            const entryData = await entryLogsResponse.json()
            setTodayEntryLogs(entryData?.data?.logs || entryData?.logs || [])
          }

          if (lockersResponse.ok) {
            const lockerData = await lockersResponse.json()
            setRecentLockerTransactions(lockerData?.transactions || [])
          }

          if (borrowsResponse.ok) {
            const borrowData = await borrowsResponse.json()
            setActiveBorrows(borrowData?.data || [])
          } else {
          }

          if (overdueResponse.ok) {
            const overdueData = await overdueResponse.json()
            setOverdueAlerts([...(overdueData?.overdue_books || []), ...(overdueData?.overdue_lockers || [])])
          } else {
          }

        } catch (error) {
          // Set empty arrays to prevent UI crashes
          if (!usageChartData.length) setUsageChartData([])
          if (!todayEntryLogs.length) setTodayEntryLogs([])
          if (!recentLockerTransactions.length) setRecentLockerTransactions([])
          if (!activeBorrows.length) setActiveBorrows([])
          if (!overdueAlerts.length) setOverdueAlerts([])
        } finally {
          setLoadingStaffData(false)
          setIsRefreshing(false)
          setLastUpdated(new Date())
        }
      }

      // Initial load
      fetchStaffData()
      
      // Auto-refresh every 5 minutes for real-time updates
      const refreshInterval = setInterval(() => fetchStaffData(false), 5 * 60 * 1000)
      
      // Manual refresh function
      const manualRefresh = () => fetchStaffData(true)
      
      return () => {
        clearInterval(refreshInterval)
      }
    }
  }, [session])

  // Show loading only on initial mount
  if (!isMounted || status === 'loading') {
    return <LoadingScreen message="Loading dashboard..." />
  }

  // If no session, let middleware handle redirect - don't show another loading screen
  if (!session) {
    return null
  }

  const userRole = session.user.role as UserRole
  const isSuperAdmin = userRole === UserRole.SUPER_ADMIN

  // Define role-based quick actions
  const getQuickActions = () => {
    switch (userRole) {
      case UserRole.SUPER_ADMIN:
        return [
          { icon: 'fa-user-shield', text: 'Add Admin', color: 'blue', href: '/users/register-admin' },
          { icon: 'fa-user-plus', text: 'Register User', color: 'green', href: '/library-users/add' },
          { icon: 'fa-history', text: 'System Logs', color: 'purple', href: '/activity-logs' }
        ]
      case UserRole.ADMIN:
        return [
          { icon: 'fa-user-tie', text: 'Add Staff', color: 'blue', href: '/users/register' },
          { icon: 'fa-id-card', text: 'Library Users', color: 'green', href: '/library-users' },
          { icon: 'fa-exclamation-triangle', text: 'Overdue Items', color: 'red', href: '/overdue' },
          { icon: 'fa-chart-bar', text: 'Reports', color: 'orange', href: '/reports' }
        ]
      case UserRole.STAFF:
        return [
          { icon: 'fa-book-medical', text: 'Add Book', color: 'green', href: '/books/add' },
          { icon: 'fa-door-open', text: 'Entry Monitoring', color: 'purple', href: '/entry-monitoring' },
          { icon: 'fa-lock', text: 'Lockers', color: 'blue', href: '/lockers' },
          { icon: 'fa-history', text: 'My Activity', color: 'orange', href: '/activity-logs' }
        ]
      default:
        return [
          { icon: 'fa-search', text: 'Browse Books', color: 'green', href: '/browse' },
          { icon: 'fa-user', text: 'My Profile', color: 'blue', href: '/profile' },
          { icon: 'fa-history', text: 'My Activity', color: 'purple', href: '/activity-logs' },
          { icon: 'fa-question-circle', text: 'Help', color: 'orange', href: '/contact' }
        ]
    }
  }

  const quickActions = getQuickActions()

  // Define role-based summary cards
  const getSummaryCards = () => {

    switch (userRole) {
      case UserRole.SUPER_ADMIN:
        return [
          {
            title: "Total Users",
            value: dashboardStats?.totalUsers || 0,
            icon: "fa-users",
            color: "blue",
            description: "Registered users"
          },
          {
            title: "Admin Accounts",
            value: dashboardStats?.adminAccounts || 0,
            icon: "fa-user-shield",
            color: "purple",
            description: "System administrators"
          },
          {
            title: "Departments",
            value: dashboardStats?.totalDepartments || 0,
            icon: "fa-building",
            color: "green",
            description: "Active departments"
          },
          {
            title: "Programs",
            value: dashboardStats?.totalPrograms || 0,
            icon: "fa-graduation-cap",
            color: "orange",
            description: "Active programs"
          }
        ]
      case UserRole.ADMIN:
        return [
          {
            title: "Today's Entries",
            value: dashboardStats?.todayEntries || 0,
            icon: "fa-door-open",
            color: "blue",
            description: "Library entries today"
          },
          {
            title: "Locker Usage",
            value: `${dashboardStats?.lockerUsage || 0}/${dashboardStats?.totalLockers || 0}`,
            icon: "fa-lock",
            color: "green", 
            description: `${dashboardStats?.lockerUtilization || 0}% utilized`
          },
          {
            title: "Book Borrowing",
            value: `${dashboardStats?.borrowedBooks || 0}/${dashboardStats?.totalBooks || 0}`,
            icon: "fa-book",
            color: "purple",
            description: `${dashboardStats?.borrowedBooks || 0} borrowed, ${dashboardStats?.pendingBooks || 0} pending`
          },
          {
            title: "Overdue Counts",
            value: dashboardStats?.overdueItems || 0,
            icon: "fa-exclamation-triangle",
            color: "red",
            description: `${dashboardStats?.overdueBooks || 0} books, ${dashboardStats?.overdueLockers || 0} lockers`
          }
        ]
      case UserRole.STAFF:
        return [
          {
            title: "Active Lockers",
            value: dashboardStats?.activeLockers || 0,
            icon: "fa-lock",
            color: "green",
            description: "Currently occupied"
          },
          {
            title: "Borrowed Books",
            value: dashboardStats?.borrowedBooks || 0,
            icon: "fa-book",
            color: "purple",
            description: `${dashboardStats?.borrowedBooks || 0} borrowed, ${dashboardStats?.pendingBooks || 0} pending`
          },
          {
            title: "Today's Entries",
            value: dashboardStats?.todayEntries || 0,
            icon: "fa-door-open",
            color: "blue",
            description: "Library entries today"
          },
          {
            title: "Overdue Items",
            value: dashboardStats?.overdueItems || 0,
            icon: "fa-exclamation-triangle",
            color: "red",
            description: "Items requiring attention"
          }
        ]
      default: // STUDENT or other roles
        return [
          {
            title: "My Borrowed Books",
            value: dashboardStats?.myBorrowedBooks || 0,
            icon: "fa-book",
            color: "blue",
            description: "Books I have borrowed"
          },
          {
            title: "My Locker",
            value: dashboardStats?.myLockerStatus || "None",
            icon: "fa-lock",
            color: "green",
            description: "Current locker status"
          },
          {
            title: "Overdue Items",
            value: dashboardStats?.myOverdueItems || 0,
            icon: "fa-exclamation-triangle",
            color: "red",
            description: "My overdue items"
          },
          {
            title: "Library Visits",
            value: dashboardStats?.myLibraryVisits || 0,
            icon: "fa-door-open",
            color: "purple",
            description: "This month"
          }
        ]
    }
  }

  const summaryCards = getSummaryCards()

  // Helper function to get icon for activity type
  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'USER_CREATE':
      case 'USER_UPDATE':
        return 'fa-user-plus'
      case 'BOOK_ADD':
      case 'BOOK_UPDATE':
        return 'fa-book'
      case 'SYSTEM_CONFIG':
        return 'fa-cogs'
      case 'DEPARTMENT_CREATE':
        return 'fa-building'
      case 'PROGRAM_CREATE':
        return 'fa-graduation-cap'
      default:
        return 'fa-info-circle'
    }
  }

  // Helper function to get color for activity type
  const getActivityColor = (action: string) => {
    switch (action) {
      case 'USER_CREATE':
      case 'USER_UPDATE':
        return 'blue'
      case 'BOOK_ADD':
      case 'BOOK_UPDATE':
        return 'green'
      case 'SYSTEM_CONFIG':
        return 'purple'
      case 'DEPARTMENT_CREATE':
        return 'orange'
      case 'PROGRAM_CREATE':
        return 'indigo'
      default:
        return 'gray'
    }
  }

  // Helper function to format time ago
  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }

  // Helper function to format time
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  // Helper function to format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  // Render the AdminView for ADMIN users with detailed analytics
  if (userRole === UserRole.ADMIN) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome back, {session.user.name}
            </p>
          </div>
          <Badge variant="outline">
            {userRole.replace('_', ' ')}
          </Badge>
        </div>

        {/* Summary Cards for ADMIN */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loadingStats ? (
            Array(4).fill(null).map((_, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="animate-pulse bg-gray-200 h-4 w-24 rounded" />
                    <div className="animate-pulse bg-gray-200 h-8 w-8 rounded-full" />
                  </div>
                  <div className="animate-pulse bg-gray-200 h-10 w-20 rounded mt-4" />
                  <div className="animate-pulse bg-gray-200 h-3 w-32 rounded mt-2" />
                </CardContent>
              </Card>
            ))
          ) : (
            summaryCards.map((card, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-600">{card.title}</h3>
                    <div className={`w-10 h-10 rounded-full bg-${card.color}-100 flex items-center justify-center`}>
                      <i className={`fas ${card.icon} text-${card.color}-600 text-lg`} />
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-gray-900">{card.value}</div>
                  <p className="text-xs text-gray-500 mt-2">{card.description}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Detailed Analytics View for ADMIN */}
        <AdminView className="mt-6" userEmail={session?.user?.email} />
      </div>
    )
  }

  // Enhanced Staff Dashboard
  if (userRole === UserRole.STAFF) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Staff Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Monitor library operations and daily activities
            </p>
          </div>
          <Badge variant="outline">
            {userRole}
          </Badge>
        </div>

        {/* Summary Cards for STAFF */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loadingStats ? (
            Array(4).fill(null).map((_, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="animate-pulse bg-gray-200 h-4 w-24 rounded" />
                    <div className="animate-pulse bg-gray-200 h-8 w-8 rounded-full" />
                  </div>
                  <div className="animate-pulse bg-gray-200 h-10 w-20 rounded mt-4" />
                  <div className="animate-pulse bg-gray-200 h-3 w-32 rounded mt-2" />
                </CardContent>
              </Card>
            ))
          ) : (
            summaryCards.map((card, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-600">{card.title}</h3>
                    <div className={`w-10 h-10 rounded-full bg-${card.color}-100 flex items-center justify-center`}>
                      <i className={`fas ${card.icon} text-${card.color}-600 text-lg`} />
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-gray-900">{card.value}</div>
                  <p className="text-xs text-gray-500 mt-2">{card.description}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Quick View Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <i className="fas fa-chart-line text-blue-600"></i>
                Daily Usage Trends (Last 7 Days)
                {staffAnalytics?.summary && (
                  <Badge 
                    variant={staffAnalytics.trends?.entries === 'up' ? 'success' : staffAnalytics.trends?.entries === 'down' ? 'error' : 'outline'}
                    className="ml-2"
                  >
                    {staffAnalytics.summary.currentTrend}
                  </Badge>
                )}
              </CardTitle>
              {staffAnalytics?.summary && (
                <p className="text-sm text-gray-600">
                  Most active day: {staffAnalytics.summary.mostActiveDay} • 
                  Peak hour: {staffAnalytics.todayStats?.peakHour || 'N/A'} • 
                  Weekly total: {staffAnalytics.summary.totalWeeklyActivity} activities
                </p>
              )}
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                <div className="h-80">
                  <LineChart
                    data={usageChartData}
                    lines={[
                      { dataKey: 'entries', stroke: '#3B82F6', name: 'Library Entries' },
                      { dataKey: 'books', stroke: '#10B981', name: 'Books Borrowed' },
                      { dataKey: 'lockers', stroke: '#F59E0B', name: 'Lockers Assigned' }
                    ]}
                    height={280}
                  />
                </div>
                
                {staffAnalytics?.weeklyAverages && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-center">
                      <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Avg Daily Entries</p>
                      <p className="text-2xl font-bold text-blue-800 mt-1">{staffAnalytics.weeklyAverages.entries}</p>
                      <p className="text-xs text-blue-600 mt-1">per day (7-day avg)</p>
                    </div>
                    <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-center">
                      <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Avg Daily Books</p>
                      <p className="text-2xl font-bold text-green-800 mt-1">{staffAnalytics.weeklyAverages.books}</p>
                      <p className="text-xs text-green-600 mt-1">per day (7-day avg)</p>
                    </div>
                    <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg text-center">
                      <p className="text-xs text-orange-600 font-medium uppercase tracking-wide">Avg Daily Lockers</p>
                      <p className="text-2xl font-bold text-orange-800 mt-1">{staffAnalytics.weeklyAverages.lockers}</p>
                      <p className="text-xs text-orange-600 mt-1">per day (7-day avg)</p>
                    </div>
                  </div>
                )}
                
                {!staffAnalytics && (
                  <div className="flex items-center justify-center py-4">
                    <div className="text-center">
                      <div className="animate-pulse bg-gray-200 h-4 w-32 rounded mx-auto mb-2"></div>
                      <p className="text-xs text-gray-500">Loading analytics...</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts and Quick Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <i className="fas fa-exclamation-triangle text-red-600"></i>
                Overdue Alerts
                {overdueAlerts.length > 0 && (
                  <Badge variant="error" className="ml-2">
                    {overdueAlerts.length}
                  </Badge>
                )}
              </CardTitle>
              {staffAnalytics?.utilizationRates && (
                <div className="flex gap-4 text-xs text-gray-600">
                  <span>Locker Utilization: {staffAnalytics.utilizationRates.lockers}%</span>
                  <span>Book Circulation: {staffAnalytics.utilizationRates.books}%</span>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {loadingStaffData ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
                  </div>
                ) : overdueAlerts.length > 0 ? (
                  overdueAlerts.map((alert, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <i className={`fas ${alert.book ? 'fa-book' : 'fa-lock'} text-red-600`}></i>
                        <div>
                          <p className="text-sm font-medium">
                            {alert.book ? alert.book.title : `Locker #${alert.locker?.locker_number}`}
                          </p>
                          <p className="text-xs text-red-600">
                            {alert.book 
                              ? `Overdue by ${alert.days_overdue} days`
                              : `Used for ${alert.days_used} days`
                            }
                          </p>
                          <p className="text-xs text-gray-500">
                            {alert.user?.full_name || 'Unknown User'}
                          </p>
                        </div>
                      </div>
                      <Badge variant="error" className="text-xs">
                        {alert.book ? 'Book' : 'Locker'}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <i className="fas fa-check-circle text-green-600 text-3xl mb-2"></i>
                    <p className="text-sm text-gray-600">No overdue items</p>
                    {staffAnalytics?.summary && (
                      <p className="text-xs text-gray-500 mt-1">
                        Weekly activity: {staffAnalytics.summary.totalWeeklyActivity} transactions
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Today's Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Entry Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <i className="fas fa-door-open text-blue-600"></i>
                Today's Entry Logs
                <Badge variant="outline">{todayEntryLogs.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {loadingStaffData ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : todayEntryLogs.length > 0 ? (
                  todayEntryLogs.map((log, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <i className="fas fa-user text-blue-600 text-sm"></i>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{log.user?.full_name || 'Unknown User'}</p>
                          <p className="text-xs text-gray-600">
                            {formatTime(log.entry_time)} • {log.user?.user_type}
                          </p>
                        </div>
                      </div>
                      <Badge variant={log.exit_time ? "outline" : "success"} className="text-xs">
                        {log.exit_time ? 'Exited' : 'Inside'}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <i className="fas fa-door-open text-gray-400 text-3xl mb-2"></i>
                    <p className="text-sm text-gray-600">No entries today</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Locker Transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <i className="fas fa-lock text-green-600"></i>
                Lockers Assigned/Returned
                <Badge variant="outline">{recentLockerTransactions.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {loadingStaffData ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
                  </div>
                ) : recentLockerTransactions.length > 0 ? (
                  recentLockerTransactions.map((transaction, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <i className="fas fa-lock text-green-600 text-sm"></i>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Locker #{transaction.locker?.locker_number || 'N/A'}</p>
                          <p className="text-xs text-gray-600">
                            {transaction.user?.full_name || 'Unknown User'}
                          </p>
                        </div>
                      </div>
                      <Badge variant={transaction.return_time ? "outline" : "success"} className="text-xs">
                        {transaction.return_time ? 'Returned' : 'Assigned'}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <i className="fas fa-lock text-gray-400 text-3xl mb-2"></i>
                    <p className="text-sm text-gray-600">No locker activity</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Active Book Borrows */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <i className="fas fa-book text-purple-600"></i>
                Active Borrows
                <Badge variant="outline">{activeBorrows.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {loadingStaffData ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                  </div>
                ) : activeBorrows.length > 0 ? (
                  activeBorrows.map((borrow, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <i className="fas fa-book text-purple-600 text-sm"></i>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{borrow.book?.title || 'Unknown Book'}</p>
                          <p className="text-xs text-gray-600">
                            Due: {formatDate(borrow.due_date)}
                          </p>
                        </div>
                      </div>
                      <Badge 
                        variant={new Date(borrow.due_date) < new Date() ? "error" : "success"}
                        className="text-xs"
                      >
                        {new Date(borrow.due_date) < new Date() ? 'Overdue' : 'Active'}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <i className="fas fa-book text-gray-400 text-3xl mb-2"></i>
                    <p className="text-sm text-gray-600">No active borrows</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {quickActions.map((action, index) => (
                <Link
                  key={index}
                  href={action.href}
                  className={
                    `flex flex-col items-center justify-center border-2 border-gray-200 hover:border-gray-400 hover:shadow-md transition-all duration-200 group ` +
                    (isSuperAdmin
                      ? 'px-4 py-4 rounded-lg'
                      : 'aspect-square p-6 rounded-xl')
                  }
                >
                  <div className="flex-1 flex items-center justify-center">
                    <i
                      className={`fas ${action.icon} text-${action.color}-600 ${isSuperAdmin ? 'text-2xl' : 'text-3xl'} group-hover:scale-110 transition-transform duration-200`}
                    />
                  </div>
                  <p className={`${isSuperAdmin ? 'text-xs' : 'text-sm'} font-semibold text-gray-700 group-hover:text-gray-900 mt-3`}>{action.text}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Welcome back, {session.user.name}
          </p>
        </div>
        <Badge variant="outline">
          {userRole?.replace('_', ' ') || 'User'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingStats ? (
          Array(4).fill(null).map((_, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="animate-pulse bg-gray-200 h-4 w-24 rounded" />
                  <div className="animate-pulse bg-gray-200 h-8 w-8 rounded-full" />
                </div>
                <div className="animate-pulse bg-gray-200 h-10 w-20 rounded mt-4" />
                <div className="animate-pulse bg-gray-200 h-3 w-32 rounded mt-2" />
              </CardContent>
            </Card>
          ))
        ) : (
          summaryCards.map((card, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">{card.title}</h3>
                  <div className={`w-10 h-10 rounded-full bg-${card.color}-100 flex items-center justify-center`}>
                    <i className={`fas ${card.icon} text-${card.color}-600 text-lg`} />
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900">{card.value}</div>
                <p className="text-xs text-gray-500 mt-2">{card.description}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loadingActivities ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : recentActivities.length > 0 ? (
                recentActivities.map((activity, index) => (
                  <div key={index} className="flex items-center space-x-4">
                    <div className={`w-8 h-8 bg-${getActivityColor(activity.action)}-100 rounded-full flex items-center justify-center`}>
                      <i className={`fas ${getActivityIcon(activity.action)} text-${getActivityColor(activity.action)}-600 text-sm`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.details}</p>
                      <p className="text-xs text-gray-500">
                        {activity.user?.full_name || 'System'} • {activity.action.replace('_', ' ')}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">{getTimeAgo(activity.created_at)}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <i className="fas fa-info-circle text-gray-600 text-sm" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">No recent system activity</p>
                    <p className="text-xs text-gray-500">System activities will appear here</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {quickActions.map((action, index) => (
                  <Link
                    key={index}
                    href={action.href}
                    className={
                      `flex flex-col items-center justify-center border-2 border-gray-200 hover:border-gray-400 hover:shadow-md transition-all duration-200 group ` +
                      (isSuperAdmin
                        ? 'px-4 py-4 rounded-lg'
                        : 'aspect-square p-6 rounded-xl')
                    }
                  >
                    <div className="flex-1 flex items-center justify-center">
                      <i
                        className={`fas ${action.icon} text-${action.color}-600 ${isSuperAdmin ? 'text-2xl' : 'text-3xl'} group-hover:scale-110 transition-transform duration-200`}
                      />
                    </div>
                    <p className={`${isSuperAdmin ? 'text-xs' : 'text-sm'} font-semibold text-gray-700 group-hover:text-gray-900 mt-3`}>{action.text}</p>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
      </div>
    </div>
  )
}