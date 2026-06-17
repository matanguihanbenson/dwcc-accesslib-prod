'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Search, Download, TrendingUp, Users, BookOpen, Lock, AlertTriangle, PieChart, BarChart3 } from "lucide-react"
// Simple notification utilities
const showErrorAlert = (title: string, message: string) => {
  console.error(`ERROR: ${title} - ${message}`)
  alert(`${title}: ${message}`)
}

const showSuccessAlert = (title: string, message: string) => {
  console.log(`SUCCESS: ${title} - ${message}`)
  alert(`${title}: ${message}`)
}

interface OverdueTrackingData {
  summary: {
    total_overdue_books: number
    total_overdue_lockers: number
    total_book_penalties: number
    total_locker_penalties: number
    average_overdue_days_books: number
    average_usage_hours_lockers: number
  }
  analytics: {
    books: {
      totalPenalties: number
      averageOverdueDays: number
      severityBreakdown: { low: number; medium: number; high: number; critical: number }
      categoryBreakdown: Record<string, number>
    }
    lockers: {
      totalPenalties: number
      averageUsageHours: number
      severityBreakdown: { low: number; medium: number; high: number; critical: number }
    }
  }
  breakdowns: {
    departments: Record<string, { books: number; lockers: number; total: number }>
    user_types: Record<string, { books: number; lockers: number; total: number }>
  }
  recent_patterns: {
    new_overdue_books: number
    new_overdue_lockers: number
    resolved_books: number
    resolved_lockers: number
  }
  overdue_items: {
    books: any[]
    lockers: any[]
  }
}

export default function AdminOverdueTracking() {
  const [data, setData] = useState<OverdueTrackingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchTrackingData()
  }, [])

  const fetchTrackingData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/overdue-tracking')
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tracking data: ${response.status}`)
      }
      
      const result = await response.json()
      setData(result)
      setError(null)
    } catch (error) {
      console.error('Error fetching tracking data:', error)
      setError(error instanceof Error ? error.message : 'Failed to load tracking data')
      showErrorAlert('Error', 'Failed to load overdue tracking data')
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getSeverityLabel = (daysOverdue: number, isLocker: boolean = false) => {
    if (isLocker) {
      const days = Math.floor(daysOverdue / 24)
      if (days <= 3) return 'low'
      if (days <= 7) return 'medium'
      if (days <= 14) return 'high'
      return 'critical'
    } else {
      if (daysOverdue <= 14) return 'low'
      if (daysOverdue <= 30) return 'medium'
      if (daysOverdue <= 60) return 'high'
      return 'critical'
    }
  }

  const exportData = () => {
    if (!data) return
    
    const exportContent = {
      summary: data.summary,
      analytics: data.analytics,
      breakdown: data.breakdowns,
      recent_patterns: data.recent_patterns,
      timestamp: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(exportContent, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `overdue-tracking-report-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    showSuccessAlert('Success', 'Report exported successfully')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading overdue tracking data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={fetchTrackingData} className="mt-4">
          Try Again
        </Button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>No tracking data available</AlertDescription>
        </Alert>
      </div>
    )
  }

  const filteredBooks = data.overdue_items.books.filter(book => {
    const matchesSearch = searchTerm === '' || 
      book.book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const severity = getSeverityLabel(book.days_overdue)
    const matchesSeverity = filterSeverity === 'all' || severity === filterSeverity
    const matchesType = filterType === 'all' || filterType === 'books'
    
    return matchesSearch && matchesSeverity && matchesType
  })

  const filteredLockers = data.overdue_items.lockers.filter(locker => {
    const matchesSearch = searchTerm === '' || 
      locker.locker.locker_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      locker.user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const severity = getSeverityLabel(locker.hours_used, true)
    const matchesSeverity = filterSeverity === 'all' || severity === filterSeverity
    const matchesType = filterType === 'all' || filterType === 'lockers'
    
    return matchesSearch && matchesSeverity && matchesType
  })

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Overdue Items Tracking</h1>
          <p className="text-gray-600 mt-2">Administrative oversight and analytics for overdue books and lockers</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchTrackingData} variant="outline">
            <TrendingUp className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Overdue Books</p>
                <p className="text-2xl font-bold">{data.summary.total_overdue_books}</p>
                <p className="text-xs text-gray-500">₱{data.summary.total_book_penalties} penalties</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Lock className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Overdue Lockers</p>
                <p className="text-2xl font-bold">{data.summary.total_overdue_lockers}</p>
                <p className="text-xs text-gray-500">₱{data.summary.total_locker_penalties} penalties</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg. Overdue Days</p>
                <p className="text-2xl font-bold">{data.summary.average_overdue_days_books}</p>
                <p className="text-xs text-gray-500">Books</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg. Usage Hours</p>
                <p className="text-2xl font-bold">{data.summary.average_usage_hours_lockers}</p>
                <p className="text-xs text-gray-500">Lockers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Severity Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PieChart className="h-5 w-5 mr-2" />
                  Books by Severity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(data.analytics.books.severityBreakdown).map(([severity, count]) => (
                    <div key={severity} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Badge className={getSeverityColor(severity)}>{severity.toUpperCase()}</Badge>
                        <span className="ml-2 text-sm">
                          {severity === 'low' && '≤14 days'}
                          {severity === 'medium' && '15-30 days'}
                          {severity === 'high' && '31-60 days'}
                          {severity === 'critical' && '>60 days'}
                        </span>
                      </div>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PieChart className="h-5 w-5 mr-2" />
                  Lockers by Severity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(data.analytics.lockers.severityBreakdown).map(([severity, count]) => (
                    <div key={severity} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Badge className={getSeverityColor(severity)}>{severity.toUpperCase()}</Badge>
                        <span className="ml-2 text-sm">
                          {severity === 'low' && '≤3 days'}
                          {severity === 'medium' && '4-7 days'}
                          {severity === 'high' && '8-14 days'}
                          {severity === 'critical' && '>14 days'}
                        </span>
                      </div>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Department Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Department Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Department/Course</th>
                      <th className="text-center py-2">Books</th>
                      <th className="text-center py-2">Lockers</th>
                      <th className="text-center py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.breakdowns.departments).map(([dept, counts]) => (
                      <tr key={dept} className="border-b">
                        <td className="py-2">{dept}</td>
                        <td className="text-center py-2">{counts.books}</td>
                        <td className="text-center py-2">{counts.lockers}</td>
                        <td className="text-center py-2 font-semibold">{counts.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* Category Breakdown */}
          {Object.keys(data.analytics.books.categoryBreakdown).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Books by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {Object.entries(data.analytics.books.categoryBreakdown).map(([category, count]) => (
                    <div key={category} className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm font-medium text-gray-600">{category}</p>
                      <p className="text-xl font-bold">{count}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* User Type Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>User Type Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">User Type</th>
                      <th className="text-center py-2">Books</th>
                      <th className="text-center py-2">Lockers</th>
                      <th className="text-center py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.breakdowns.user_types).map(([userType, counts]) => (
                      <tr key={userType} className="border-b">
                        <td className="py-2">{userType}</td>
                        <td className="text-center py-2">{counts.books}</td>
                        <td className="text-center py-2">{counts.lockers}</td>
                        <td className="text-center py-2 font-semibold">{counts.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by title, user name, or locker number..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                  <SelectTrigger className="w-full md:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-full md:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="books">Books Only</SelectItem>
                    <SelectItem value="lockers">Lockers Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Items Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {(filterType === 'all' || filterType === 'books') && (
              <Card>
                <CardHeader>
                  <CardTitle>Overdue Books ({filteredBooks.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {filteredBooks.map((book) => (
                      <div key={book.id} className="border rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-sm">{book.book.title}</h4>
                          <Badge className={getSeverityColor(getSeverityLabel(book.days_overdue))}>
                            {book.days_overdue} days
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600">{book.book.book_author}</p>
                        <p className="text-xs text-gray-600">{book.user.full_name} - {book.user.user_type}</p>
                        <p className="text-xs text-red-600">Penalty: ₱{book.calculated_penalty}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {(filterType === 'all' || filterType === 'lockers') && (
              <Card>
                <CardHeader>
                  <CardTitle>Overdue Lockers ({filteredLockers.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {filteredLockers.map((locker) => (
                      <div key={locker.id} className="border rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-sm">Locker #{locker.locker.locker_number}</h4>
                          <Badge className={getSeverityColor(getSeverityLabel(locker.hours_used, true))}>
                            {locker.days_used} days
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600">{locker.user.full_name} - {locker.user.user_type}</p>
                        <p className="text-xs text-gray-600">{locker.hours_used} hours used</p>
                        <p className="text-xs text-red-600">Penalty: ₱{locker.calculated_penalty}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity Patterns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-600">New Overdue Books</p>
                  <p className="text-2xl font-bold text-blue-700">{data.recent_patterns.new_overdue_books}</p>
                  <p className="text-xs text-blue-500">Last 7 days</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-purple-600">New Overdue Lockers</p>
                  <p className="text-2xl font-bold text-purple-700">{data.recent_patterns.new_overdue_lockers}</p>
                  <p className="text-xs text-purple-500">Last 7 days</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-600">Resolved Books</p>
                  <p className="text-2xl font-bold text-green-700">{data.recent_patterns.resolved_books}</p>
                  <p className="text-xs text-green-500">Last 7 days</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-orange-600">Resolved Lockers</p>
                  <p className="text-2xl font-bold text-orange-700">{data.recent_patterns.resolved_lockers}</p>
                  <p className="text-xs text-orange-500">Last 7 days</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Export Options</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button onClick={exportData} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Export Full Report (JSON)
                </Button>
                <Button variant="outline" className="w-full" disabled>
                  <Download className="h-4 w-4 mr-2" />
                  Export Summary (CSV) - Coming Soon
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
