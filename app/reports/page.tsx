'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { notify } from '@/lib/notification'
import { PDFReportGenerator, type PaperSize } from '@/lib/pdf-report-generator'
import { ExcelReportGenerator } from '@/lib/excel-report-generator'
import { formatDateRangeForTitle, formatDateRangeForFilename } from '@/lib/utils'
import { ExportButtonGroup } from './components/common/ExportButtonGroup'
import { NoDataState } from './components/common/NoDataState'
import { SummaryCardsGrid, type SummaryCardData } from './components/visualizations/SummaryCardsGrid'
import { PeakHoursChart } from './components/visualizations/PeakHoursChart'
import { UserTypeDistributionTable } from './components/visualizations/UserTypeDistributionTable'
import { DatePresetSelector, type DatePreset } from './components/filters/DatePresetSelector'
import { UserSearchInput } from './components/filters/UserSearchInput'

interface ReportData {
  period: {
    month: number
    year: number
    startDate: string
    endDate: string
  }
  dailyData: Array<{
    date: string
    dayOfWeek: string
    dayOfMonth: number
    hours: Record<number, number>
    total: number
    holiday?: { name: string; description?: string | null }
  }>
  hourlyTotals: Record<number, number>
  hourlyAverages?: Record<number, number>
  peakHours?: Array<{ hour: number; count: number }>
  userTypeStats: Record<string, number>
  gradeLevelStats: Record<string, number>
  summary: {
    totalEntries: number
    totalDays: number
    averagePerDay: number
    maxOccupancy?: number
    averageOccupancy?: number
    peakHour?: number
    totalUniqueUsers?: number
  }
}

export default function ReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [authReady, setAuthReady] = useState(false)
  
  // Form state
  const currentDate = new Date()
  const [reportType, setReportType] = useState<'users-concurrent' | 'users-per-transaction' | 'individual' | 'locker-concurrent' | 'locker-per-transaction' | 'entrance-exit' | 'student-visits-dept-grade'>('entrance-exit')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [datePreset, setDatePreset] = useState<DatePreset>('month')
  const [paperSize, setPaperSize] = useState<PaperSize>('short')
  
  // User search state for individual statistics
  const [userSearch, setUserSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [userSearchResults, setUserSearchResults] = useState<any[]>([])
  const [searchingUsers, setSearchingUsers] = useState(false)
  
  // Entry Records Export state
  const [entryUserFilter, setEntryUserFilter] = useState<'all' | 'specific'>('all')
  const [entrySelectedUserId, setEntrySelectedUserId] = useState<number | null>(null)
  const [entrySelectedUserName, setEntrySelectedUserName] = useState<string>('')
  const [entryRecordLimit, setEntryRecordLimit] = useState<number>(100)
  const [entrySpecificDate, setEntrySpecificDate] = useState('')
  const [entryRecordsData, setEntryRecordsData] = useState<any>(null)
  
  // Data state
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [usersConcurrentData, setUsersConcurrentData] = useState<ReportData | null>(null)
  const [usersPerTransactionData, setUsersPerTransactionData] = useState<ReportData | null>(null)
  const [entranceExitData, setEntranceExitData] = useState<any>(null)
  const [individualReportData, setIndividualReportData] = useState<any>(null)
  const [lockerConcurrentData, setLockerConcurrentData] = useState<any>(null)
  const [lockerPerTransactionData, setLockerPerTransactionData] = useState<any>(null)
  const [studentVisitsDeptGradeData, setStudentVisitsDeptGradeData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('monthly')

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') return

      if (status === 'authenticated' && session?.user) {
        const userRole = (session.user as any).role
        if (!['ADMIN', 'STAFF'].includes(userRole)) {
          router.push('/dashboard')
          return
        }
        setAuthReady(true)
      } else {
        router.push('/login')
      }
    }

    checkAuth()
  }, [session, status, router])

  // Debounced user search for individual statistics
  useEffect(() => {
    const searchUsers = async () => {
      if (userSearch.trim().length < 2) {
        setUserSearchResults([])
        return
      }

      setSearchingUsers(true)
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(userSearch)}`, {
          credentials: 'include'
        })
        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setUserSearchResults(result.data)
          }
        }
      } catch (error) {
        console.error('Error searching users:', error)
      } finally {
        setSearchingUsers(false)
      }
    }

    const timeoutId = setTimeout(searchUsers, 300)
    return () => clearTimeout(timeoutId)
  }, [userSearch])

  // Apply date preset when changed
  useEffect(() => {
    const applyDatePreset = () => {
      const now = new Date()
      
      // Helper to format date as YYYY-MM-DD in local timezone
      const formatLocalDate = (date: Date): string => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }
      
      switch (datePreset) {
        case 'today':
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          setDateFrom(formatLocalDate(today))
          setDateTo(formatLocalDate(today))
          break
        case 'week':
          const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          weekStart.setDate(weekStart.getDate() - weekStart.getDay())
          const weekEnd = new Date(weekStart)
          weekEnd.setDate(weekStart.getDate() + 6)
          setDateFrom(formatLocalDate(weekStart))
          setDateTo(formatLocalDate(weekEnd))
          break
        case 'month':
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
          setDateFrom(formatLocalDate(monthStart))
          setDateTo(formatLocalDate(monthEnd))
          break
        case 'year':
          const yearStart = new Date(now.getFullYear(), 0, 1)
          const yearEnd = new Date(now.getFullYear(), 11, 31)
          setDateFrom(formatLocalDate(yearStart))
          setDateTo(formatLocalDate(yearEnd))
          break
        case 'date':
          // Date preset for specific date
          break
        case 'custom':
          break
      }
    }

    // Apply date preset for all report types
    applyDatePreset()
  }, [datePreset, reportType, entrySpecificDate])

  const fetchReportData = async () => {
    try {
      setLoading(true)
      console.log('Fetching report for type:', reportType, 'Date range:', dateFrom, '-', dateTo)
      
      if (reportType === 'users-concurrent') {
        if (!dateFrom || !dateTo || dateFrom === '' || dateTo === '') {
          await notify.error('Error', 'Please select a date range')
          setLoading(false)
          return
        }

        const params = new URLSearchParams({
          date_from: dateFrom,
          date_to: dateTo
        })

        const response = await fetch(`/api/reports/users-per-hour?${params}`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          }
        })

        if (response.ok) {
          const result = await response.json()
          console.log('Users-concurrent API response:', result)
          if (result.success) {
            console.log('Setting usersConcurrentData with:', result.data)
            setUsersConcurrentData(result.data)
            await notify.success('Success', 'User\'s concurrent statistics loaded successfully')
          } else {
            console.error('API returned success=false:', result.error)
            await notify.error('Error', result.error || 'Failed to fetch user\'s concurrent statistics')
          }
        } else {
          console.error('API response not OK:', response.status, response.statusText)
          await notify.error('Error', 'Failed to fetch user\'s concurrent statistics')
        }
      } else if (reportType === 'users-per-transaction') {
        if (!dateFrom || !dateTo || dateFrom === '' || dateTo === '') {
          await notify.error('Error', 'Please select a date range')
          setLoading(false)
          return
        }

        const params = new URLSearchParams({
          date_from: dateFrom,
          date_to: dateTo
        })

        const response = await fetch(`/api/reports/users-per-transaction?${params}`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          }
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setUsersPerTransactionData(result.data)
            await notify.success('Success', 'User\'s per-transaction statistics loaded successfully')
          } else {
            await notify.error('Error', result.error || 'Failed to fetch user\'s per-transaction statistics')
          }
        } else {
          await notify.error('Error', 'Failed to fetch user\'s per-transaction statistics')
        }
      } else if (reportType === 'student-visits-dept-grade') {
        if (!dateFrom || !dateTo || dateFrom === '' || dateTo === '') {
          await notify.error('Error', 'Please select a date range')
          setLoading(false)
          return
        }

        const params = new URLSearchParams({
          date_from: dateFrom,
          date_to: dateTo
        })

        const response = await fetch(`/api/reports/student-visits-by-dept-grade?${params}`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          }
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setStudentVisitsDeptGradeData(result.data)
            await notify.success('Success', 'Student visits by department/grade statistics loaded successfully')
          } else {
            await notify.error('Error', result.error || 'Failed to fetch student visits statistics')
          }
        } else {
          await notify.error('Error', 'Failed to fetch student visits statistics')
        }
      } else if (reportType === 'individual') {
        if (!selectedUser) {
          await notify.error('Error', 'Please select a student/user first')
          setLoading(false)
          return
        }

        const params = new URLSearchParams({
          user_id: selectedUser.user_id.toString(),
          ...(dateFrom && { date_from: dateFrom }),
          ...(dateTo && { date_to: dateTo })
        })

        const response = await fetch(`/api/reports/user-statistics?${params}`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          }
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setIndividualReportData(result.data)
            await notify.success('Success', 'Individual student statistics loaded successfully')
          } else {
            await notify.error('Error', result.error || 'Failed to fetch individual statistics')
          }
        } else {
          await notify.error('Error', 'Failed to fetch individual statistics')
        }
      } else if (reportType === 'locker-concurrent') {
        if (!dateFrom || !dateTo || dateFrom === '' || dateTo === '') {
          await notify.error('Error', 'Please select a date range')
          setLoading(false)
          return
        }

        const params = new URLSearchParams({
          date_from: dateFrom,
          date_to: dateTo
        })

        const response = await fetch(`/api/reports/locker-concurrent?${params}`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          }
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setLockerConcurrentData(result.data)
            await notify.success('Success', 'Locker concurrent statistics loaded successfully')
          } else {
            await notify.error('Error', result.error || 'Failed to fetch locker concurrent statistics')
          }
        } else {
          await notify.error('Error', 'Failed to fetch locker concurrent statistics')
        }
      } else if (reportType === 'locker-per-transaction') {
        if (!dateFrom || !dateTo || dateFrom === '' || dateTo === '') {
          await notify.error('Error', 'Please select a date range')
          setLoading(false)
          return
        }

        const params = new URLSearchParams({
          date_from: dateFrom,
          date_to: dateTo
        })

        const response = await fetch(`/api/reports/locker-statistics?${params}`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          }
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setLockerPerTransactionData(result.data)
            await notify.success('Success', 'Locker per-transaction statistics loaded successfully')
          } else {
            await notify.error('Error', result.error || 'Failed to fetch locker per-transaction statistics')
          }
        } else {
          await notify.error('Error', 'Failed to fetch locker per-transaction statistics')
        }
      } else if (reportType === 'entrance-exit') {
        if (!dateFrom || !dateTo || dateFrom === '' || dateTo === '') {
          await notify.error('Error', 'Please select a date range')
          setLoading(false)
          return
        }

        const params = new URLSearchParams({
          date_from: dateFrom,
          date_to: dateTo
        })

        const response = await fetch(`/api/reports/entrance-exit?${params}`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          }
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setEntranceExitData(result.data)
            await notify.success('Success', 'Entrance/Exit control statistics loaded successfully')
          } else {
            await notify.error('Error', result.error || 'Failed to fetch entrance/exit statistics')
          }
        } else {
          await notify.error('Error', 'Failed to fetch entrance/exit statistics')
        }
      } else if (reportType === 'entry-records') {
        // Fetch entry records with filters
        if (entryUserFilter === 'specific' && !entrySelectedUserId) {
          await notify.error('Error', 'Please select a user first')
          setLoading(false)
          return
        }

        const params = new URLSearchParams({
          include_user: 'true',
          limit: entryRecordLimit.toString(),
          ...(entryUserFilter === 'specific' && entrySelectedUserId && { user_id: entrySelectedUserId.toString() }),
          ...(dateFrom && { date_from: dateFrom }),
          ...(dateTo && { date_to: dateTo })
        })

        const response = await fetch(`/api/entry-logs?${params}`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          }
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            // Check if result.data is an array
            if (!Array.isArray(result.data)) {
              await notify.error('Error', 'Invalid data format received')
              setLoading(false)
              return
            }
            
            // Calculate duration for each entry
            const processedRecords = result.data.map((record: any) => {
              const entryTime = new Date(record.entry_time)
              const exitTime = record.exit_time ? new Date(record.exit_time) : null
              const isActive = !exitTime
              const endTime = exitTime || new Date()
              const durationMs = endTime.getTime() - entryTime.getTime()
              const hours = Math.floor(durationMs / (1000 * 60 * 60))
              const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
              
              let durationText = ''
              if (hours > 0) {
                durationText = `${hours} hr${hours !== 1 ? 's' : ''} ${minutes} min`
              } else {
                durationText = `${minutes} min`
              }
              
              if (isActive) {
                durationText = `Active (${durationText})`
              }
              
              return {
                ...record,
                isActive,
                durationText,
                durationHours: hours,
                durationMinutes: minutes
              }
            })
            
            setEntryRecordsData(processedRecords)
            const activeCount = processedRecords.filter((r: any) => r.isActive).length
            await notify.success('Success', `Loaded ${processedRecords.length} entry records (${activeCount} active)`)
          } else {
            await notify.error('Error', result.error || 'Failed to fetch entry records')
          }
        } else {
          await notify.error('Error', 'Failed to fetch entry records')
        }
      }
    } catch (error) {
      console.error('Error fetching report data:', error)
      await notify.error('Error', 'Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Entry Records Export Functions
  const exportEntryRecordsToPDF = () => {
    if (!entryRecordsData || entryRecordsData.length === 0) {
      notify.error('Error', 'No data to export. Please generate a report first.')
      return
    }

    try {
      const generator = new PDFReportGenerator(paperSize)
      const preparedBy = (session?.user as any)?.name || 'Library Staff'
      
      const filters = {
        userFilter: entryUserFilter,
        userName: entryUserFilter === 'specific' ? entrySelectedUserName : 'All Users',
        dateFrom,
        dateTo,
        recordCount: entryRecordsData.length,
        activeCount: entryRecordsData.filter((r: any) => r.isActive).length
      }
      
      generator.generateEntryRecordsReport(entryRecordsData, filters, preparedBy)
      
      const dateRange = dateFrom && dateTo
        ? `${dateFrom}_to_${dateTo}`
        : new Date().toISOString().split('T')[0]
      const userPart = entryUserFilter === 'specific' 
        ? entrySelectedUserName.replace(/\s+/g, '_')
        : 'All'
      const filename = `Entry_Records_${userPart}_${dateRange}.pdf`
      
      generator.save(filename)
      notify.success('Success', 'PDF exported successfully')
    } catch (error) {
      console.error('PDF export error:', error)
      notify.error('Error', 'Failed to export PDF')
    }
  }

  const exportEntryRecordsToExcel = () => {
    if (!entryRecordsData || entryRecordsData.length === 0) {
      notify.error('Error', 'No data to export. Please generate a report first.')
      return
    }

    try {
      const excelGenerator = new ExcelReportGenerator()
      
      const filters = {
        userFilter: entryUserFilter,
        userName: entryUserFilter === 'specific' ? entrySelectedUserName : 'All Users',
        dateFrom,
        dateTo,
        recordCount: entryRecordsData.length,
        activeCount: entryRecordsData.filter((r: any) => r.isActive).length
      }
      
      excelGenerator.generateEntryRecordsReport(entryRecordsData, filters)
      
      const dateRange = dateFrom && dateTo
        ? `${dateFrom}_to_${dateTo}`
        : new Date().toISOString().split('T')[0]
      const userPart = entryUserFilter === 'specific' 
        ? entrySelectedUserName.replace(/\s+/g, '_')
        : 'All'
      const filename = `Entry_Records_${userPart}_${dateRange}.xlsx`
      
      excelGenerator.save(filename)
      notify.success('Success', 'Excel file exported successfully')
    } catch (error) {
      console.error('Excel export error:', error)
      notify.error('Error', 'Failed to export Excel file')
    }
  }

  const exportEntryRecordsToCSV = () => {
    if (!entryRecordsData || entryRecordsData.length === 0) {
      notify.error('Error', 'No data to export. Please generate a report first.')
      return
    }

    try {
      // Transform data for CSV
      const csvData = entryRecordsData.map((record: any) => ({
        'Entry Time': new Date(record.entry_time).toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }),
        'Exit Time': record.exit_time
          ? new Date(record.exit_time).toLocaleString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            })
          : 'Still Inside',
        'User Name': record.user?.full_name || 'Unknown',
        'ID Number': record.user?.account_id || 'N/A',
        'User Type': record.user?.user_type || 'N/A',
        'Purpose': record.purpose || 'General',
        'Duration': record.durationText,
        'Status': record.isActive ? 'Active' : 'Completed'
      }))

      // Convert to CSV string
      const headers = Object.keys(csvData[0])
      const csvContent = [
        headers.join(','),
        ...csvData.map((row: any) => 
          headers.map(header => {
            const value = row[header as keyof typeof row]
            // Escape commas and quotes in values
            return `"${String(value).replace(/"/g, '""')}"`
          }).join(',')
        )
      ].join('\n')

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      
      const dateRange = formatDateRangeForFilename(dateFrom, dateTo, datePreset)
      const userPart = entryUserFilter === 'specific' 
        ? entrySelectedUserName.replace(/\s+/g, '_')
        : 'All'
      const filename = `Entry_Records_${userPart}_${dateRange}.csv`
      
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      notify.success('Success', 'CSV file exported successfully')
    } catch (error) {
      console.error('CSV export error:', error)
      notify.error('Error', 'Failed to export CSV file')
    }
  }

  const exportToPDF = () => {
    if (reportType === 'individual') {
      if (!individualReportData) {
        notify.error('Error', 'No data to export. Please generate a report first.')
        return
      }
      
      try {
        const generator = new PDFReportGenerator(paperSize)
        const preparedBy = (session?.user as any)?.name || 'Library Staff'
        const dateRangeTitle = formatDateRangeForTitle(dateFrom, dateTo, datePreset)
        
        generator.generateIndividualUserReport(individualReportData, preparedBy, dateRangeTitle)
        
        const filename = `Individual_User_${individualReportData.user.account_id}_${formatDateRangeForFilename(dateFrom, dateTo, datePreset)}.pdf`
        generator.save(filename)
        notify.success('Success', 'PDF exported successfully')
      } catch (error) {
        console.error('PDF export error:', error)
        notify.error('Error', 'Failed to export PDF')
      }
      return
    }

    if (reportType === 'entrance-exit') {
      if (!entranceExitData) {
        notify.error('Error', 'No data to export. Please generate a report first.')
        return
      }
      
      try {
        const generator = new PDFReportGenerator(paperSize)
        const preparedBy = (session?.user as any)?.name || 'Library Staff'
        const dateRangeTitle = formatDateRangeForTitle(dateFrom, dateTo, datePreset)
        
        generator.generateEntranceExitStatistics(entranceExitData, preparedBy, dateRangeTitle)
        
        const filename = `Entrance_Exit_Control_${formatDateRangeForFilename(dateFrom, dateTo, datePreset)}.pdf`
        generator.save(filename)
        notify.success('Success', 'PDF exported successfully')
      } catch (error) {
        console.error('PDF export error:', error)
        notify.error('Error', 'Failed to export PDF')
      }
      return
    }

    if (reportType === 'locker-concurrent') {
      if (!lockerConcurrentData) {
        notify.error('Error', 'No data to export. Please generate a report first.')
        return
      }
      
      try {
        const generator = new PDFReportGenerator(paperSize)
        const preparedBy = (session?.user as any)?.name || 'Library Staff'
        const dateRangeTitle = formatDateRangeForTitle(dateFrom, dateTo, datePreset)
        
        generator.generateLockerConcurrentStatistics(lockerConcurrentData, preparedBy, dateRangeTitle)
        
        const filename = `Locker_Concurrent_Statistics_${formatDateRangeForFilename(dateFrom, dateTo, datePreset)}.pdf`
        generator.save(filename)
        notify.success('Success', 'PDF exported successfully')
      } catch (error) {
        console.error('PDF export error:', error)
        notify.error('Error', 'Failed to export PDF')
      }
      return
    }

    if (reportType === 'locker-per-transaction') {
      if (!lockerPerTransactionData) {
        notify.error('Error', 'No data to export. Please generate a report first.')
        return
      }
      
      try {
        const generator = new PDFReportGenerator(paperSize)
        const preparedBy = (session?.user as any)?.name || 'Library Staff'
        const dateRangeTitle = formatDateRangeForTitle(dateFrom, dateTo, datePreset)
        
        generator.generateLockerUsageStatistics(lockerPerTransactionData, preparedBy, dateRangeTitle)
        
        const filename = `Locker_PerTransaction_Statistics_${formatDateRangeForFilename(dateFrom, dateTo, datePreset)}.pdf`
      generator.save(filename)
      notify.success('Success', 'PDF exported successfully')
    } catch (error) {
      console.error('PDF export error:', error)
      notify.error('Error', 'Failed to export PDF')
    }
    return
    }

    if (reportType === 'student-visits-dept-grade') {
      if (!studentVisitsDeptGradeData) {
        notify.error('Error', 'No data to export. Please generate a report first.')
        return
      }
      try {
        const generator = new PDFReportGenerator(paperSize)
        const preparedBy = (session?.user as any)?.name || 'Library Staff'
        const dateRangeTitle = formatDateRangeForTitle(dateFrom, dateTo, datePreset)

        generator.generateStudentVisitsByDeptGrade(studentVisitsDeptGradeData, preparedBy, dateRangeTitle)

        const filename = `Student_Visits_Department_Grade_${formatDateRangeForFilename(dateFrom, dateTo, datePreset)}.pdf`
        generator.save(filename)
        notify.success('Success', 'PDF exported successfully')
      } catch (error) {
        console.error('PDF export error:', error)
        notify.error('Error', 'Failed to export PDF')
      }
      return
    }
    
    const dataToExport = reportType === 'users-concurrent' ? usersConcurrentData : reportType === 'users-per-transaction' ? usersPerTransactionData : reportData
    
    if (!dataToExport) {
      notify.error('Error', 'No data to export. Please generate a report first.')
      return
    }

    try {
      const generator = new PDFReportGenerator(paperSize)
      const preparedBy = (session?.user as any)?.name || 'Library Staff'
      const dateRangeTitle = formatDateRangeForTitle(dateFrom, dateTo, datePreset)
      
      // Transform data to match PDFReportGenerator's expected ReportData interface
      const pdfData = {
        month: dataToExport.period.month,
        year: dataToExport.period.year,
        dailyData: dataToExport.dailyData,
        hourlyTotals: dataToExport.hourlyTotals,
        userTypeStats: dataToExport.userTypeStats,
        gradeLevelStats: dataToExport.gradeLevelStats,
        summary: dataToExport.summary
      }
      
      // Generate appropriate report based on type
      if (reportType === 'users-concurrent') {
        generator.generateUsersPerHourStatistics(pdfData, preparedBy, dateRangeTitle)
      } else if (reportType === 'users-per-transaction') {
        generator.generateUsersPerTransactionStatistics(pdfData, preparedBy, dateRangeTitle)
      } else {
        generator.generateMonthlyStatistics(pdfData, preparedBy, dateRangeTitle)
      }
      generator.generateUserTypeStatistics(pdfData, preparedBy)
      
      const paperSizeLabels = {
        short: 'Short',
        long: 'Long',
        a4: 'A4'
      }
      const reportTypeLabel = reportType === 'users-concurrent' ? 'Users_Concurrent' : reportType === 'users-per-transaction' ? 'Users_PerTransaction' : 'Entry_Exit'
      const filename = `${reportTypeLabel}_${formatDateRangeForFilename(dateFrom, dateTo, datePreset)}_${paperSizeLabels[paperSize]}.pdf`
      
      generator.save(filename)
      notify.success('Success', 'PDF report generated successfully')
    } catch (error) {
      console.error('Error generating PDF:', error)
      notify.error('Error', 'Failed to generate PDF report')
    }
  }

  const exportToExcel = () => {
    const generator = new ExcelReportGenerator()
    const dateRangeTitle = formatDateRangeForTitle(dateFrom, dateTo, datePreset)
    let workbook: any
    let filename: string

    try {
      // Handle different report types
      if (reportType === 'entrance-exit') {
        if (!entranceExitData) {
          notify.error('Error', 'No data to export. Please generate a report first.')
          return
        }
        workbook = generator.generateEntranceExitReport(entranceExitData, dateRangeTitle)
        filename = `Entrance_Exit_Control_${formatDateRangeForFilename(dateFrom, dateTo, datePreset)}.xlsx`
      } else if (reportType === 'locker-concurrent') {
        if (!lockerConcurrentData) {
          notify.error('Error', 'No data to export. Please generate a report first.')
          return
        }
        workbook = generator.generateLockerConcurrentReport(lockerConcurrentData, dateRangeTitle)
        filename = `Locker_Concurrent_Statistics_${formatDateRangeForFilename(dateFrom, dateTo, datePreset)}.xlsx`
      } else if (reportType === 'locker-per-transaction') {
        if (!lockerPerTransactionData) {
          notify.error('Error', 'No data to export. Please generate a report first.')
          return
        }
        workbook = generator.generateLockerPerTransactionReport(lockerPerTransactionData, dateRangeTitle)
        filename = `Locker_PerTransaction_Statistics_${formatDateRangeForFilename(dateFrom, dateTo, datePreset)}.xlsx`
      } else if (reportType === 'student-visits-dept-grade') {
        if (!studentVisitsDeptGradeData) {
          notify.error('Error', 'No data to export. Please generate a report first.')
          return
        }
        workbook = generator.generateStudentVisitsByDeptGrade(studentVisitsDeptGradeData, dateRangeTitle)
        filename = `Student_Visits_Department_Grade_${formatDateRangeForFilename(dateFrom, dateTo, datePreset)}.xlsx`
      } else if (reportType === 'users-concurrent') {
        if (!usersConcurrentData) {
          notify.error('Error', 'No data to export. Please generate a report first.')
          return
        }
        const excelData = {
          month: usersConcurrentData.period.month,
          year: usersConcurrentData.period.year,
          dailyData: usersConcurrentData.dailyData,
          hourlyTotals: usersConcurrentData.hourlyTotals,
          userTypeStats: usersConcurrentData.userTypeStats,
          gradeLevelStats: usersConcurrentData.gradeLevelStats,
          summary: usersConcurrentData.summary
        }
        workbook = generator.generateUsersConcurrentReport(excelData, dateRangeTitle)
        filename = `Users_Concurrent_${formatDateRangeForFilename(dateFrom, dateTo, datePreset)}.xlsx`
      } else if (reportType === 'users-per-transaction') {
        if (!usersPerTransactionData) {
          notify.error('Error', 'No data to export. Please generate a report first.')
          return
        }
        const excelData = {
          month: usersPerTransactionData.period.month,
          year: usersPerTransactionData.period.year,
          dailyData: usersPerTransactionData.dailyData,
          hourlyTotals: usersPerTransactionData.hourlyTotals,
          userTypeStats: usersPerTransactionData.userTypeStats,
          gradeLevelStats: usersPerTransactionData.gradeLevelStats,
          summary: usersPerTransactionData.summary
        }
        workbook = generator.generateUsersPerTransactionReport(excelData, dateRangeTitle)
        filename = `Users_PerTransaction_${formatDateRangeForFilename(dateFrom, dateTo, datePreset)}.xlsx`
      } else if (reportType === 'individual') {
        if (!individualReportData) {
          notify.error('Error', 'No data to export. Please generate a report first.')
          return
        }
        workbook = generator.generateIndividualUserReport(individualReportData, dateRangeTitle)
        filename = `Individual_User_${individualReportData.user.account_id}_${formatDateRangeForFilename(dateFrom, dateTo, datePreset)}.xlsx`
      } else {
        // Entry monitoring report (default)
        if (!reportData) {
          notify.error('Error', 'No data to export. Please generate a report first.')
          return
        }
        const excelData = {
          month: reportData.period.month,
          year: reportData.period.year,
          dailyData: reportData.dailyData,
          hourlyTotals: reportData.hourlyTotals,
          userTypeStats: reportData.userTypeStats,
          gradeLevelStats: reportData.gradeLevelStats,
          summary: reportData.summary
        }
        workbook = generator.generateMonthlyStatistics(excelData, dateRangeTitle)
        filename = `Entry_Monitoring_${formatDateRangeForFilename(dateFrom, dateTo, datePreset)}.xlsx`
      }
      
      generator.saveWorkbook(workbook, filename)
      notify.success('Success', 'Excel report generated successfully')
    } catch (error) {
      console.error('Error generating Excel:', error)
      notify.error('Error', 'Failed to generate Excel report')
    }
  }

  const exportToCSV = () => {
    const dateRangeTitle = formatDateRangeForTitle(dateFrom, dateTo, datePreset)
    let csvContent: string = ''
    let filename: string

    try {
      // Handle different report types
      if (reportType === 'entrance-exit') {
        if (!entranceExitData) {
          notify.error('Error', 'No data to export. Please generate a report first.')
          return
        }
        
        csvContent = `Divine Word College of Calapan - College Library\n`
        csvContent += `Entrance/Exit Control for ${dateRangeTitle}\n\n`
        csvContent += `Time Range,Admin,Faculty,Employee,Guest,Alumni,Basic Education,College Students,Total\n`
        
        let grandTotal = 0
        entranceExitData.timeRangeData.forEach((range: any) => {
          csvContent += `${range.timeRange},${range.admin || 0},${range.faculty || 0},${range.employee || 0},${range.guest || 0},${range.alumni || 0},${range.basicEducation || 0},${range.collegeStudents || 0},${range.total || 0}\n`
          grandTotal += (range.total || 0)
        })
        
        // Calculate totals
        const totals = entranceExitData.timeRangeData.reduce((acc: any, range: any) => ({
          admin: acc.admin + (range.admin || 0),
          faculty: acc.faculty + (range.faculty || 0),
          employee: acc.employee + (range.employee || 0),
          guest: acc.guest + (range.guest || 0),
          alumni: acc.alumni + (range.alumni || 0),
          basicEducation: acc.basicEducation + (range.basicEducation || 0),
          collegeStudents: acc.collegeStudents + (range.collegeStudents || 0)
        }), { admin: 0, faculty: 0, employee: 0, guest: 0, alumni: 0, basicEducation: 0, collegeStudents: 0 })
        
        csvContent += `TOTAL,${totals.admin},${totals.faculty},${totals.employee},${totals.guest},${totals.alumni},${totals.basicEducation},${totals.collegeStudents},${grandTotal}\n`
        
        filename = `Entrance_Exit_Control_${formatDateRangeForFilename(dateFrom, dateTo, datePreset)}.csv`
      } else if (reportType === 'locker-concurrent') {
        if (!lockerConcurrentData) {
          notify.error('Error', 'No data to export. Please generate a report first.')
          return
        }
        
        csvContent = `Divine Word College of Calapan - College Library\n`
        csvContent += `Locker Concurrent Statistics for ${dateRangeTitle}\n\n`
        csvContent += `Date,Day,7:00 AM,8:00 AM,9:00 AM,10:00 AM,11:00 AM,12:00 NN,1:00 PM,2:00 PM,3:00 PM,4:00 PM,5:00 PM,6:00 PM,7:00 PM,Total\n`
        
        let grandTotal = 0
        lockerConcurrentData.dailyData.forEach((day: any) => {
          const dayDate = new Date(day.date)
          const isHoliday = !!day.holiday
          const dayLabel = isHoliday ? 'Holiday' : (day.dayOfWeek ? day.dayOfWeek.substring(0, 3) : dayDate.toLocaleDateString('en-US', { weekday: 'short' }))
          const dateStr = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          
          let dayTotal = 0
          let row = `${dateStr},${dayLabel}`
          for (let hour = 7; hour <= 19; hour++) {
            const hourCount = day.hours[hour] || 0
            row += `,${isHoliday ? '-' : hourCount}`
            if (!isHoliday) dayTotal += hourCount
          }
          row += `,${isHoliday ? '-' : dayTotal}\n`
          if (!isHoliday) grandTotal += dayTotal
          csvContent += row
        })
        
        let totalsRow = 'TOTAL,'
        for (let hour = 7; hour <= 19; hour++) {
          totalsRow += `,${lockerConcurrentData.hourlyTotals[hour] || 0}`
        }
        totalsRow += `,${grandTotal}\n`
        csvContent += totalsRow
        
        // Add summary section
        const totalDays = lockerConcurrentData.dailyData.filter((day: any) => !day.holiday).length
        const totalAssignments = lockerConcurrentData.summary.totalAssignments || 0
        const avgPerDay = totalDays > 0 ? (totalAssignments / totalDays).toFixed(2) : '0.00'
        csvContent += `\nSummary\n`
        csvContent += `Total Active Rentals,${totalAssignments}\n`
        csvContent += `Total Days,${totalDays}\n`
        csvContent += `Average Per Day,${avgPerDay}\n`
        
        filename = `Locker_Concurrent_Statistics_${formatDateRangeForFilename(dateFrom, dateTo, datePreset)}.csv`
      } else if (reportType === 'locker-per-transaction') {
        if (!lockerPerTransactionData) {
          notify.error('Error', 'No data to export. Please generate a report first.')
          return
        }
        
        csvContent = `Divine Word College of Calapan - College Library\n`
        csvContent += `Locker Usage Statistics for ${dateRangeTitle}\n\n`
        csvContent += `Date,Day,7:00 AM,8:00 AM,9:00 AM,10:00 AM,11:00 AM,12:00 NN,1:00 PM,2:00 PM,3:00 PM,4:00 PM,5:00 PM,6:00 PM,7:00 PM,Total\n`
        
        let grandTotal = 0
        lockerPerTransactionData.dailyData.forEach((day: any) => {
          const dayDate = new Date(day.date)
          const isHoliday = !!day.holiday
          const dayLabel = isHoliday ? 'Holiday' : (day.dayOfWeek ? day.dayOfWeek.substring(0, 3) : dayDate.toLocaleDateString('en-US', { weekday: 'short' }))
          const dateStr = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          
          let dayTotal = 0
          let row = `${dateStr},${dayLabel}`
          for (let hour = 7; hour <= 19; hour++) {
            const hourCount = day.hours[hour] || 0
            row += `,${isHoliday ? '-' : hourCount}`
            if (!isHoliday) dayTotal += hourCount
          }
          row += `,${isHoliday ? '-' : dayTotal}\n`
          if (!isHoliday) grandTotal += dayTotal
          csvContent += row
        })
        
        let totalsRow = 'TOTAL,'
        for (let hour = 7; hour <= 19; hour++) {
          totalsRow += `,${lockerPerTransactionData.hourlyTotals[hour] || 0}`
        }
        totalsRow += `,${grandTotal}\n`
        csvContent += totalsRow
        
        // Add summary section
        const totalDays = lockerPerTransactionData.dailyData.filter((day: any) => !day.holiday).length
        const totalTransactions = lockerPerTransactionData.summary.totalTransactions || 0
        const avgPerDay = totalDays > 0 ? (totalTransactions / totalDays).toFixed(2) : '0.00'
        csvContent += `\nSummary\n`
        csvContent += `Total Transactions,${totalTransactions}\n`
        csvContent += `Total Days,${totalDays}\n`
        csvContent += `Average Per Day,${avgPerDay}\n`
        
        filename = `Locker_PerTransaction_Statistics_${formatDateRangeForFilename(dateFrom, dateTo, datePreset)}.csv`
      } else if (reportType === 'student-visits-dept-grade') {
        if (!studentVisitsDeptGradeData) {
          notify.error('Error', 'No data to export. Please generate a report first.')
          return
        }
        csvContent = `Divine Word College of Calapan - College Library\n`
        csvContent += `Student Visits by Department/Grade Level for ${dateRangeTitle}\n\n`
        csvContent += `By Department\n`
        csvContent += `Department,Code,Visits,Percentage\n`
        const totalDeptVisits = (studentVisitsDeptGradeData.totals?.totalVisits || studentVisitsDeptGradeData.byDepartment.reduce((s: number, d: any) => s + (d.count || 0), 0))
        studentVisitsDeptGradeData.byDepartment.forEach((d: any) => {
          const pct = totalDeptVisits > 0 ? ((d.count / totalDeptVisits) * 100).toFixed(1) + '%' : '0.0%'
          csvContent += `${d.name},${d.code || ''},${d.count},${pct}\n`
        })
        csvContent += `\nBy Grade Level\n`
        csvContent += `Grade Level,Education Level,Visits,Percentage\n`
        const totalGradeVisits = studentVisitsDeptGradeData.byGradeLevel.reduce((s: number, g: any) => s + (g.count || 0), 0)
        studentVisitsDeptGradeData.byGradeLevel.forEach((g: any) => {
          const pct = totalGradeVisits > 0 ? ((g.count / totalGradeVisits) * 100).toFixed(1) + '%' : '0.0%'
          csvContent += `${g.name},${g.education_level || ''},${g.count},${pct}\n`
        })
        csvContent += `\nSummary\n`
        csvContent += `Total Visits (logs),${totalDeptVisits}\n`
        csvContent += `Departments Counted,${studentVisitsDeptGradeData.byDepartment.length}\n`
        csvContent += `Grade Levels Counted,${studentVisitsDeptGradeData.byGradeLevel.length}\n`
        filename = `Student_Visits_Department_Grade_${formatDateRangeForFilename(dateFrom, dateTo, datePreset)}.csv`
      } else if (reportType === 'users-concurrent') {
        if (!usersConcurrentData) {
          notify.error('Error', 'No data to export. Please generate a report first.')
          return
        }
        
        csvContent = `Divine Word College of Calapan - College Library\n`
        csvContent += `User's Statistics (Concurrent) for ${dateRangeTitle}\n\n`
        csvContent += `Date,Day,7:00 AM,8:00 AM,9:00 AM,10:00 AM,11:00 AM,12:00 NN,1:00 PM,2:00 PM,3:00 PM,4:00 PM,5:00 PM,6:00 PM,7:00 PM,Total\n`
        
        let grandTotal = 0
        usersConcurrentData.dailyData.forEach((day: any) => {
          const dayDate = new Date(day.date)
          const isHoliday = !!day.holiday
          const dayLabel = isHoliday ? 'Holiday' : (day.dayOfWeek ? day.dayOfWeek.substring(0, 3) : dayDate.toLocaleDateString('en-US', { weekday: 'short' }))
          const dateStr = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          
          let dayTotal = 0
          let row = `${dateStr},${dayLabel}`
          for (let hour = 7; hour <= 19; hour++) {
            const hourCount = day.hours[hour] || 0
            row += `,${isHoliday ? '-' : hourCount}`
            if (!isHoliday) dayTotal += hourCount
          }
          row += `,${isHoliday ? '-' : dayTotal}\n`
          if (!isHoliday) grandTotal += dayTotal
          csvContent += row
        })
        
        let totalsRow = 'TOTAL,'
        for (let hour = 7; hour <= 19; hour++) {
          totalsRow += `,${usersConcurrentData.hourlyTotals[hour] || 0}`
        }
        totalsRow += `,${grandTotal}\n`
        csvContent += totalsRow
        
        // Add summary section
        const totalDays = usersConcurrentData.dailyData.filter((day: any) => !day.holiday).length
        const totalVisits = usersConcurrentData.summary.totalEntries || 0
        const avgPerDay = totalDays > 0 ? (totalVisits / totalDays).toFixed(2) : '0.00'
        csvContent += `\nSummary\n`
        csvContent += `Total Visits,${totalVisits}\n`
        csvContent += `Total Days,${totalDays}\n`
        csvContent += `Average Per Day,${avgPerDay}\n`
        csvContent += `Total Unique Users,${usersConcurrentData.summary.totalUniqueUsers || 0}\n`
        if (usersConcurrentData.summary.maxOccupancy) {
          csvContent += `Max Occupancy,${usersConcurrentData.summary.maxOccupancy}\n`
        }
        if (usersConcurrentData.summary.averageOccupancy) {
          csvContent += `Average Occupancy,${usersConcurrentData.summary.averageOccupancy}\n`
        }
        
        filename = `Users_Concurrent_${formatDateRangeForFilename(dateFrom, dateTo, datePreset)}.csv`
      } else if (reportType === 'users-per-transaction') {
        if (!usersPerTransactionData) {
          notify.error('Error', 'No data to export. Please generate a report first.')
          return
        }
        
        csvContent = `Divine Word College of Calapan - College Library\n`
        csvContent += `Users per Transaction Statistics for ${dateRangeTitle}\n\n`
        csvContent += `Date,Day,7:00 AM,8:00 AM,9:00 AM,10:00 AM,11:00 AM,12:00 NN,1:00 PM,2:00 PM,3:00 PM,4:00 PM,5:00 PM,6:00 PM,7:00 PM,Total\n`
        
        let grandTotal = 0
        usersPerTransactionData.dailyData.forEach((day: any) => {
          const dayDate = new Date(day.date)
          const isHoliday = !!day.holiday
          const dayLabel = isHoliday ? 'Holiday' : (day.dayOfWeek ? day.dayOfWeek.substring(0, 3) : dayDate.toLocaleDateString('en-US', { weekday: 'short' }))
          const dateStr = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          
          let dayTotal = 0
          let row = `${dateStr},${dayLabel}`
          for (let hour = 7; hour <= 19; hour++) {
            const hourCount = day.hours[hour] || 0
            row += `,${isHoliday ? '-' : hourCount}`
            if (!isHoliday) dayTotal += hourCount
          }
          row += `,${isHoliday ? '-' : dayTotal}\n`
          if (!isHoliday) grandTotal += dayTotal
          csvContent += row
        })
        
        let totalsRow = 'TOTAL,'
        for (let hour = 7; hour <= 19; hour++) {
          totalsRow += `,${usersPerTransactionData.hourlyTotals[hour] || 0}`
        }
        totalsRow += `,${grandTotal}\n`
        csvContent += totalsRow
        
        // Add summary section
        const totalDays = usersPerTransactionData.dailyData.filter((day: any) => !day.holiday).length
        const totalEntries = usersPerTransactionData.summary.totalEntries || 0
        const avgPerDay = totalDays > 0 ? (totalEntries / totalDays).toFixed(2) : '0.00'
        csvContent += `\nSummary\n`
        csvContent += `Total Transactions,${totalEntries}\n`
        csvContent += `Total Days,${totalDays}\n`
        csvContent += `Average Per Day,${avgPerDay}\n`
        if (usersPerTransactionData.summary.totalUniqueUsers) {
          csvContent += `Total Unique Users,${usersPerTransactionData.summary.totalUniqueUsers}\n`
        }
        
        filename = `Users_PerTransaction_${formatDateRangeForFilename(dateFrom, dateTo, datePreset)}.csv`
      } else if (reportType === 'individual') {
        if (!individualReportData) {
          notify.error('Error', 'No data to export. Please generate a report first.')
          return
        }
        
        csvContent = `Divine Word College of Calapan - College Library\n`
        csvContent += `Individual User Statistics for ${dateRangeTitle}\n\n`
        csvContent += `User Information\n`
        csvContent += `ID Number,${individualReportData.user.account_id}\n`
        csvContent += `Full Name,${individualReportData.user.full_name}\n`
        csvContent += `User Type,${individualReportData.user.user_type}\n`
        if (individualReportData.user.department) {
          csvContent += `Department,${individualReportData.user.department}\n`
        }
        if (individualReportData.user.program) {
          csvContent += `Program,${individualReportData.user.program}\n`
        }
        csvContent += `\nSummary Statistics\n`
        csvContent += `Total Books Borrowed,${individualReportData.borrowing.summary.total_borrowed}\n`
        csvContent += `Currently Borrowed,${individualReportData.borrowing.summary.currently_borrowed}\n`
        csvContent += `Total Visits,${individualReportData.visits.summary.total_visits}\n`
        csvContent += `Avg Duration (minutes),${individualReportData.visits.summary.avg_duration_minutes}\n`
        csvContent += `Total Penalties,₱${individualReportData.penalties.summary.total_penalties.toFixed(2)}\n`
        csvContent += `Total Balance,₱${individualReportData.penalties.summary.total_balance.toFixed(2)}\n`
        csvContent += `Total Locker Rentals,${individualReportData.locker_usage.summary.total_rentals}\n`
        
        filename = `Individual_User_${individualReportData.user.account_id}_${formatDateRangeForFilename(dateFrom, dateTo, datePreset)}.csv`
      } else {
        // Default case - should not reach here
        notify.error('Error', 'Invalid report type selected')
        return
      }
      
      // Create and download CSV file with UTF-8 BOM for proper Excel display
      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      notify.success('Success', 'CSV report generated successfully')
    } catch (error) {
      console.error('Error generating CSV:', error)
      notify.error('Error', 'Failed to generate CSV report')
    }
  }

  if (!authReady) {
    return (
      <div className="px-6 py-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Loading...</div>
          </div>
        </div>
      </div>
    )
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const timeSlots = [
    '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 NN',
    '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'
  ]

  return (
    <>
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-800">Library Reports</h1>
              <p className="text-sm text-gray-600 mt-1">
                Generate and export library statistics and reports
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {/* Paper Size Selector */}
              <div className="flex items-center space-x-2 mr-2">
                <label className="text-sm font-medium text-gray-700">Paper Size:</label>
                <select
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="short">8.5&quot; x 11&quot; (Short)</option>
                  <option value="long">8.5&quot; x 13&quot; (Long)</option>
                  <option value="a4">A4 (210mm x 297mm)</option>
                </select>
              </div>
              
              {/* Export Buttons */}
              <ExportButtonGroup
                onExportExcel={exportToExcel}
                onExportPDF={exportToPDF}
                onExportCSV={exportToCSV}
                disabled={!reportData && !usersConcurrentData && !usersPerTransactionData && !entranceExitData && !lockerConcurrentData && !lockerPerTransactionData && !individualReportData && !studentVisitsDeptGradeData}
                variant="colored"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        {/* Filters Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Report Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Report Type Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Report Type
                </label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="entrance-exit">Entrance/Exit Control Statistics (Hourly)</option>
                  <optgroup label="User Statistics">
                    <option value="users-concurrent">User's Statistics (Concurrent)</option>
                    <option value="users-per-transaction">User's Statistics (Per Transaction)</option>
                    <option value="student-visits-dept-grade">Student Visits by Department/Grade Level</option>
                  </optgroup>
                  <optgroup label="Locker Statistics">
                    <option value="locker-concurrent">Locker Usage (Concurrent)</option>
                    <option value="locker-per-transaction">Locker Usage (Per Transaction)</option>
                  </optgroup>
                  <option value="individual">Individual Student Statistics</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {reportType === 'entrance-exit' && 'View hourly entrance/exit control with user type breakdown'}
                  {reportType === 'users-concurrent' && 'View count of library users present per hour (concurrent occupancy)'}
                  {reportType === 'users-per-transaction' && 'View count of library entry transactions per hour'}
                  {reportType === 'student-visits-dept-grade' && 'View total student visits grouped by department and grade level'}
                  {reportType === 'locker-concurrent' && 'View count of active locker assignments per hour (concurrent usage)'}
                  {reportType === 'locker-per-transaction' && 'View locker assignment transactions per hour'}
                  {reportType === 'individual' && 'View detailed statistics for a specific student/user (borrowing, penalties, visits)'}
                </p>
              </div>

              {/* Date Range Filters - For Individual Statistics */}
              {reportType === 'individual' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date Range
                  </label>
                  <DatePresetSelector
                    preset={datePreset}
                    onPresetChange={setDatePreset}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onDateFromChange={setDateFrom}
                    onDateToChange={setDateTo}
                    variant="tabs"
                  />
                </div>
              ) : null}

              {/* Unified Date Range Selector for all report types except individual */}
              {reportType !== 'individual' && (
                <DatePresetSelector
                  preset={datePreset}
                  onPresetChange={setDatePreset}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  onDateFromChange={setDateFrom}
                  onDateToChange={setDateTo}
                  variant="buttons"
                />
              )}

              {/* User Selector for Individual Student Statistics */}
              {reportType === 'individual' && (
                <UserSearchInput
                  value={userSearch}
                  onChange={(value) => {
                    setUserSearch(value)
                    if (!value) setUserSearchResults([])
                  }}
                  selectedUser={selectedUser}
                  onSelectUser={(user) => {
                    setSelectedUser(user)
                    if (!user) setUserSearch('')
                    else setUserSearchResults([])
                  }}
                  searchResults={userSearchResults}
                  isSearching={searchingUsers}
                  helperText="Search and select a student/user to view their individual statistics"
                />
              )}

              <div className="flex justify-end">
                <Button
                  onClick={fetchReportData}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loading ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Generating...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-chart-bar mr-2"></i>
                      Generate Report
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report Data - Entry report removed */}

        {/* User's Statistics Report (Concurrent) */}
        {reportType === 'users-concurrent' && usersConcurrentData && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="monthly">
                <i className="fas fa-calendar-alt mr-2"></i>
                Monthly Statistics
              </TabsTrigger>
              <TabsTrigger value="usertype">
                <i className="fas fa-users mr-2"></i>
                User Type Stats
              </TabsTrigger>
              <TabsTrigger value="summary">
                <i className="fas fa-chart-pie mr-2"></i>
                Summary
              </TabsTrigger>
            </TabsList>

            {/* Monthly Statistics Tab */}
            <TabsContent value="monthly">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>
                    User's Statistics (Concurrent) for {formatDateRangeForTitle(dateFrom, dateTo, datePreset)}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={exportToPDF}>
                      <i className="fas fa-file-pdf mr-2"></i>
                      Export PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportToExcel}>
                      <i className="fas fa-file-excel mr-2"></i>
                      Export Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportToCSV}>
                      <i className="fas fa-file-csv mr-2"></i>
                      Export CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-600 mb-4">
                    <i className="fas fa-info-circle mr-2"></i>
                    Shows the count of library users present per hour (concurrent occupancy)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">Date</th>
                          <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">Day</th>
                          {timeSlots.map((slot, index) => (
                            <th key={index} className="border border-gray-300 px-2 py-3 text-xs font-semibold text-gray-700 text-center">
                              {slot}
                            </th>
                          ))}
                          <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 bg-blue-100">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersConcurrentData.dailyData.map((day: any, dayIndex: number) => {
                          const date = new Date(day.date)
                          const isWeekend = date.getDay() === 0 || date.getDay() === 6
                          const isHoliday = day.holiday

                          return (
                            <tr key={dayIndex} className={`${isWeekend ? 'bg-blue-50' : ''} ${isHoliday ? 'bg-red-50' : ''}`}>
                              <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900">
                                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </td>
                              <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                                {isHoliday ? 'Holiday' : day.dayOfWeek.substring(0, 3)}
                              </td>
                              {timeSlots.map((_, slotIndex) => {
                                const hour = 7 + slotIndex
                                const count = day.hours[hour] || 0

                                if (isHoliday) {
                                  return slotIndex === 0 ? (
                                    <td key={slotIndex} colSpan={timeSlots.length} className="border border-gray-300 px-2 py-3 text-sm text-center text-red-700 font-medium">
                                      {day.holiday.name}
                                    </td>
                                  ) : null
                                }

                                return (
                                  <td key={slotIndex} className="border border-gray-300 px-2 py-3 text-sm text-center text-gray-900">
                                    {count || ''}
                                  </td>
                                )
                              })}
                              <td className="border border-gray-300 px-4 py-3 text-sm text-center font-semibold text-blue-800 bg-blue-50">
                                {isHoliday ? 0 : Object.values(day.hours).reduce((sum: number, val: any) => sum + (val || 0), 0)}
                              </td>
                            </tr>
                          )
                        })}
                        <tr className="bg-gray-100 font-bold">
                          <td colSpan={2} className="border border-gray-300 px-4 py-3 text-sm text-gray-900">AVERAGE</td>
                          {timeSlots.map((_, slotIndex) => {
                            const hour = 7 + slotIndex
                            const avg = usersConcurrentData.hourlyAverages?.[hour] || 0
                            return (
                              <td key={slotIndex} className="border border-gray-300 px-2 py-3 text-sm text-center text-gray-900">
                                {avg || ''}
                              </td>
                            )
                          })}
                          <td className="border border-gray-300 px-4 py-3 text-sm text-center font-bold text-blue-800 bg-blue-200">
                            {Math.round(Object.values(usersConcurrentData.hourlyAverages || {}).reduce((sum: number, val: any) => sum + (val || 0), 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* User Type Statistics Tab */}
            <TabsContent value="usertype">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>User Type Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User Type</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Count</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Percentage</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {Object.entries(usersConcurrentData.userTypeStats).map(([type, count]) => (
                            <tr key={type} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">{type}</td>
                              <td className="px-6 py-4 text-sm text-center text-gray-900">{count}</td>
                              <td className="px-6 py-4 text-sm text-center text-gray-900">
                                {((count / (usersConcurrentData.summary.totalUniqueUsers || 1)) * 100).toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {Object.keys(usersConcurrentData.gradeLevelStats).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Grade Level Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade Level</th>
                              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Count</th>
                              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Percentage</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {Object.entries(usersConcurrentData.gradeLevelStats).map(([grade, count]) => (
                              <tr key={grade} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{grade}</td>
                                <td className="px-6 py-4 text-sm text-center text-gray-900">{count}</td>
                                <td className="px-6 py-4 text-sm text-center text-gray-900">
                                  {((count / (usersConcurrentData.summary.totalUniqueUsers || 1)) * 100).toFixed(1)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Summary Tab */}
            <TabsContent value="summary">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Total Unique Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-blue-600">
                      {(usersConcurrentData.summary.totalUniqueUsers || 0).toLocaleString()}
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Unique users who visited during the period
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Average Occupancy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-green-600">
                      {usersConcurrentData.summary.averageOccupancy}
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Average users per hour
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Max Occupancy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-purple-600">
                      {usersConcurrentData.summary.maxOccupancy}
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Peak number of users present at one time
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Peak Hours Chart */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Peak Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {usersConcurrentData.peakHours && usersConcurrentData.peakHours.length > 0 ? (
                      usersConcurrentData.peakHours.slice(0, 5).map((peak: any, index: number) => {
                        const hourNum = peak.hour
                        const timeLabel = hourNum < 12 
                          ? `${hourNum}:00 AM` 
                          : hourNum === 12 
                            ? '12:00 NN' 
                            : `${hourNum - 12}:00 PM`
                        const percentage = (usersConcurrentData.summary.maxOccupancy || 0) > 0
                          ? (peak.count / (usersConcurrentData.summary.maxOccupancy || 1)) * 100
                          : 0
                        return (
                          <div key={index}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium">{timeLabel}</span>
                              <span className="text-gray-600">{peak.count} users ({percentage.toFixed(1)}%)</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div
                                className="bg-blue-600 h-2.5 rounded-full"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <p className="text-sm text-gray-600">No peak hour data available</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* User's Per-Transaction Statistics Report */}
        {reportType === 'users-per-transaction' && usersPerTransactionData && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="monthly">
                <i className="fas fa-calendar-alt mr-2"></i>
                Monthly Statistics
              </TabsTrigger>
              <TabsTrigger value="usertype">
                <i className="fas fa-users mr-2"></i>
                User Type Stats
              </TabsTrigger>
              <TabsTrigger value="summary">
                <i className="fas fa-chart-pie mr-2"></i>
                Summary
              </TabsTrigger>
            </TabsList>

            {/* Monthly Statistics Tab */}
            <TabsContent value="monthly">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>
                    User Entry Transactions Statistics for {formatDateRangeForTitle(dateFrom, dateTo, datePreset)}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={exportToPDF}>
                      <i className="fas fa-file-pdf mr-2"></i>
                      Export PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportToExcel}>
                      <i className="fas fa-file-excel mr-2"></i>
                      Export Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportToCSV}>
                      <i className="fas fa-file-csv mr-2"></i>
                      Export CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-600 mb-4">
                    <i className="fas fa-info-circle mr-2"></i>
                    Shows the count of library entry transactions per hour
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">Date</th>
                          <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">Day</th>
                          {timeSlots.map((slot, index) => (
                            <th key={index} className="border border-gray-300 px-2 py-3 text-xs font-semibold text-gray-700 text-center">
                              {slot}
                            </th>
                          ))}
                          <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">Total</th>
                          <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">UNIQUE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersPerTransactionData.dailyData.map((day: any, dayIndex: number) => {
                          const isHoliday = day.holiday !== null && day.holiday !== undefined
                          const isSunday = day.dayOfWeek === 'Sunday'
                          
                          return (
                            <tr key={dayIndex} className={isHoliday ? 'bg-red-50' : isSunday ? 'bg-yellow-50' : dayIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="border border-gray-300 px-4 py-3 text-sm font-medium text-gray-900 text-center">
                                {day.dayOfMonth}
                              </td>
                              <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                                {day.dayOfWeek}
                              </td>
                              {isHoliday || isSunday ? (
                                <td colSpan={15} className="border border-gray-300 px-4 py-3 text-center">
                                  <span className={`font-semibold ${isHoliday ? 'text-red-700' : 'text-gray-700'}`}>
                                    {isHoliday ? day.holiday.name : 'SUNDAY'}
                                  </span>
                                </td>
                              ) : (
                                <>
                                  {timeSlots.map((_, hourIndex) => {
                                    const hour = hourIndex + 7
                                    const count = day.hours[hour] || 0
                                    return (
                                      <td key={hourIndex} className="border border-gray-300 px-2 py-3 text-xs text-gray-900 text-center">
                                        {count}
                                      </td>
                                    )
                                  })}
                                  <td className="border border-gray-300 px-4 py-3 text-sm font-medium text-gray-900 text-center">
                                    {day.total || 0}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-3 text-sm font-medium text-gray-900 text-center">
                                    {day.uniqueCount || 0}
                                  </td>
                                </>
                              )}
                            </tr>
                          )
                        })}
                        <tr className="bg-gray-200 font-bold">
                          <td colSpan={2} className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">
                            TOTAL
                          </td>
                          {timeSlots.map((_, hourIndex) => {
                            const hour = hourIndex + 7
                            const total = usersPerTransactionData.hourlyTotals[hour] || 0
                            return (
                              <td key={hourIndex} className="border border-gray-300 px-2 py-3 text-xs text-gray-900 text-center">
                                {total}
                              </td>
                            )
                          })}
                          <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">
                            {usersPerTransactionData.summary.totalEntries}
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">
                            {usersPerTransactionData.summary.totalUniqueUsers}
                          </td>
                        </tr>
                        <tr className="bg-gray-100 font-semibold">
                          <td colSpan={2} className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">
                            AVERAGE
                          </td>
                          {timeSlots.map((_, hourIndex) => {
                            const hour = hourIndex + 7
                            const avg = usersPerTransactionData.hourlyAverages?.[hour] || 0
                            return (
                              <td key={hourIndex} className="border border-gray-300 px-2 py-3 text-xs text-gray-900 text-center">
                                {avg}
                              </td>
                            )
                          })}
                          <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">
                            {Math.round(Object.values(usersPerTransactionData.hourlyAverages || {}).reduce((sum: number, val: any) => sum + (val || 0), 0))}
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">
                            {Math.round((usersPerTransactionData.summary.totalUniqueUsers || 0) / (usersPerTransactionData.summary.totalDays || 1))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* User Type Stats Tab */}
            <TabsContent value="usertype">
              <Card>
                <CardHeader>
                  <CardTitle>User Type Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User Type
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Transactions
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Percentage
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {Object.entries(usersPerTransactionData.userTypeStats).map(([type, count]) => (
                          <tr key={type}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{type}</td>
                            <td className="px-6 py-4 text-sm text-center text-gray-900">{count as number}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                              {((count as number / (usersPerTransactionData.summary.totalUniqueUsers || 1)) * 100).toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Summary Tab */}
            <TabsContent value="summary">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Total Unique Users</CardTitle>
                    <i className="fas fa-users text-blue-500"></i>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">
                      {(usersPerTransactionData.summary.totalUniqueUsers || 0).toLocaleString()}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Entered during the month
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Average Transactions</CardTitle>
                    <i className="fas fa-chart-line text-green-500"></i>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">
                      {usersPerTransactionData.summary.averageOccupancy}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Per hour average
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Max Transactions</CardTitle>
                    <i className="fas fa-arrow-up text-red-500"></i>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">
                      {usersPerTransactionData.summary.maxOccupancy}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Peak hour
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Peak Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {usersPerTransactionData.peakHours && usersPerTransactionData.peakHours.length > 0 ? (
                      usersPerTransactionData.peakHours.slice(0, 5).map((peak: any, index: number) => {
                        const hourLabel = peak.hour <= 12 
                          ? `${peak.hour === 12 ? 12 : peak.hour}:00 ${peak.hour < 12 ? 'AM' : 'NN'}`
                          : `${peak.hour - 12}:00 PM`

                        const percentage = (usersPerTransactionData.summary.maxOccupancy || 0) > 0
                          ? (peak.count / (usersPerTransactionData.summary.maxOccupancy || 1)) * 100
                          : 0

                        return (
                          <div key={index} className="flex items-center">
                            <div className="w-24 text-sm font-medium text-gray-700">{hourLabel}</div>
                            <div className="flex-1 mx-4">
                              <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 transition-all duration-300"
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                            </div>
                            <div className="w-20 text-sm font-semibold text-gray-900 text-right">
                              {peak.count} ({percentage.toFixed(1)}%)
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <p className="text-sm text-gray-600">No peak hour data available</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Locker Concurrent Usage Statistics Report */}
        {reportType === 'locker-concurrent' && lockerConcurrentData && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="monthly">
                <i className="fas fa-calendar-alt mr-2"></i>
                Monthly Statistics
              </TabsTrigger>
              <TabsTrigger value="usertype">
                <i className="fas fa-users mr-2"></i>
                User Type Stats
              </TabsTrigger>
              <TabsTrigger value="summary">
                <i className="fas fa-chart-pie mr-2"></i>
                Summary
              </TabsTrigger>
            </TabsList>

            {/* Monthly Statistics Tab */}
            <TabsContent value="monthly">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>
                    Locker Concurrent Usage Statistics for {formatDateRangeForTitle(dateFrom, dateTo, datePreset)}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={exportToPDF}>
                      <i className="fas fa-file-pdf mr-2"></i>
                      Export PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportToExcel}>
                      <i className="fas fa-file-excel mr-2"></i>
                      Export Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportToCSV}>
                      <i className="fas fa-file-csv mr-2"></i>
                      Export CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-600 mb-4">
                    <i className="fas fa-info-circle mr-2"></i>
                    Shows the count of active locker assignments per hour (concurrent usage)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">Date</th>
                          <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">Day</th>
                          {timeSlots.map((slot, index) => (
                            <th key={index} className="border border-gray-300 px-2 py-3 text-xs font-semibold text-gray-700 text-center">
                              {slot}
                            </th>
                          ))}
                          <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">Total</th>
                          <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">UNIQUE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lockerConcurrentData.dailyData.map((day: any, index: number) => {
                          const isHoliday = day.holiday !== null && day.holiday !== undefined
                          const isSunday = day.dayOfWeek === 'Sunday'
                          
                          return (
                            <tr key={index} className={isHoliday ? 'bg-red-50' : isSunday ? 'bg-yellow-50' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="border border-gray-300 px-4 py-3 text-sm font-medium text-gray-900 text-center">
                                {day.dayOfMonth}
                              </td>
                              <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">
                                {day.dayOfWeek}
                              </td>
                              {isHoliday || isSunday ? (
                                <td colSpan={15} className="border border-gray-300 px-4 py-3 text-center">
                                  <span className={`font-semibold ${isHoliday ? 'text-red-700' : 'text-gray-700'}`}>
                                    {isHoliday ? day.holiday.name : 'SUNDAY'}
                                  </span>
                                </td>
                              ) : (
                                <>
                                  {timeSlots.map((_, hourIndex) => {
                                    const hour = hourIndex + 7
                                    const count = day.hours[hour] || 0
                                    return (
                                      <td key={hourIndex} className="border border-gray-300 px-2 py-3 text-xs text-gray-900 text-center">
                                        {count}
                                      </td>
                                    )
                                  })}
                                  <td className="border border-gray-300 px-4 py-3 text-sm font-medium text-gray-900 text-center">
                                    {day.total || 0}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-3 text-sm font-medium text-gray-900 text-center">
                                    {day.uniqueCount || 0}
                                  </td>
                                </>
                              )}
                            </tr>
                          )
                        })}
                        <tr className="bg-gray-200 font-bold">
                          <td colSpan={2} className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">
                            TOTAL
                          </td>
                          {timeSlots.map((_, hourIndex) => {
                            const hour = hourIndex + 7
                            const total = lockerConcurrentData.hourlyTotals[hour] || 0
                            return (
                              <td key={hourIndex} className="border border-gray-300 px-2 py-3 text-xs text-gray-900 text-center">
                                {total}
                              </td>
                            )
                          })}
                          <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">
                            {lockerConcurrentData.summary.totalAssignments}
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">
                            {lockerConcurrentData.summary.totalUniqueUsers}
                          </td>
                        </tr>
                        <tr className="bg-gray-100 font-semibold">
                          <td colSpan={2} className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">
                            AVERAGE
                          </td>
                          {timeSlots.map((_, hourIndex) => {
                            const hour = hourIndex + 7
                            const avg = lockerConcurrentData.hourlyAverages?.[hour] || 0
                            return (
                              <td key={hourIndex} className="border border-gray-300 px-2 py-3 text-xs text-gray-900 text-center">
                                {avg}
                              </td>
                            )
                          })}
                          <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">
                            {Math.round(Object.values(lockerConcurrentData.hourlyAverages || {}).reduce((sum: number, val: any) => sum + (val || 0), 0))}
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center">
                            {Math.round((lockerConcurrentData.summary.totalUniqueUsers || 0) / (lockerConcurrentData.summary.totalDays || 1))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* User Type Stats Tab */}
            <TabsContent value="usertype">
              <Card>
                <CardHeader>
                  <CardTitle>User Type Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User Type
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Users
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Percentage
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {Object.entries(lockerConcurrentData.userTypeStats).map(([type, count]) => (
                          <tr key={type}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{type}</td>
                            <td className="px-6 py-4 text-sm text-center text-gray-900">{count as number}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                              {lockerConcurrentData.summary.totalAssignments > 0
                                ? (((count as number) / lockerConcurrentData.summary.totalAssignments) * 100).toFixed(1)
                                : '0.0'}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Summary Tab */}
            <TabsContent value="summary">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Total Unique Users</CardTitle>
                    <i className="fas fa-users text-blue-500"></i>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">
                      {(lockerConcurrentData.summary.totalUniqueUsers || 0).toLocaleString()}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Had active lockers
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Average Concurrent</CardTitle>
                    <i className="fas fa-chart-line text-green-500"></i>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">
                      {lockerConcurrentData.summary.averageOccupancy}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Per hour average
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Max Concurrent</CardTitle>
                    <i className="fas fa-arrow-up text-red-500"></i>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900">
                      {lockerConcurrentData.summary.maxOccupancy}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Peak hour
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Peak Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {lockerConcurrentData.peakHours && lockerConcurrentData.peakHours.length > 0 ? (
                      lockerConcurrentData.peakHours.slice(0, 5).map((peak: any, index: number) => {
                        const hourLabel = peak.hour <= 12 
                          ? `${peak.hour === 12 ? 12 : peak.hour}:00 ${peak.hour < 12 ? 'AM' : 'NN'}`
                          : `${peak.hour - 12}:00 PM`

                        const percentage = (lockerConcurrentData.summary.maxOccupancy || 0) > 0
                          ? (peak.count / (lockerConcurrentData.summary.maxOccupancy || 1)) * 100
                          : 0

                        return (
                          <div key={index} className="flex items-center">
                            <div className="w-24 text-sm font-medium text-gray-700">{hourLabel}</div>
                            <div className="flex-1 mx-4">
                              <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500 transition-all duration-300"
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                            </div>
                            <div className="w-20 text-sm font-semibold text-gray-900 text-right">
                              {peak.count} ({percentage.toFixed(1)}%)
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <p className="text-sm text-gray-600">No peak hour data available</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Locker Usage Statistics Report */}
        {reportType === 'locker-per-transaction' && lockerPerTransactionData && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="monthly">
                <i className="fas fa-calendar-alt mr-2"></i>
                Monthly Statistics
              </TabsTrigger>
              <TabsTrigger value="usertype">
                <i className="fas fa-users mr-2"></i>
                User Type Stats
              </TabsTrigger>
              <TabsTrigger value="summary">
                <i className="fas fa-chart-pie mr-2"></i>
                Summary
              </TabsTrigger>
            </TabsList>

            {/* Monthly Statistics Tab */}
            <TabsContent value="monthly">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>
                    Locker Users' Statistics for {formatDateRangeForTitle(dateFrom, dateTo, datePreset)}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={exportToPDF}>
                      <i className="fas fa-file-pdf mr-2"></i>
                      Export PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportToExcel}>
                      <i className="fas fa-file-excel mr-2"></i>
                      Export Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportToCSV}>
                      <i className="fas fa-file-csv mr-2"></i>
                      Export CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-600 mb-4">
                    <i className="fas fa-info-circle mr-2"></i>
                    Shows the count of locker assignments per hour (7 AM - 7 PM)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">Date</th>
                          {['7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 NN',
                            '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'].map((time, index) => (
                            <th key={index} className="border border-gray-300 px-2 py-3 text-xs font-semibold text-gray-700">
                              {time}
                            </th>
                          ))}
                          <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">Total</th>
                          <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">UNIQUE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lockerPerTransactionData.dailyData.map((day: any, index: number) => {
                          const isHoliday = day.holiday !== null && day.holiday !== undefined
                          const isSunday = day.dayOfWeek === 'Sunday'
                          const isSpecialDay = isHoliday || isSunday
                          
                          return (
                            <tr key={index} className={isSpecialDay ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                              <td className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-900">
                                {day.dayOfMonth}
                              </td>
                              {isSpecialDay ? (
                                <td colSpan={13} className="border border-gray-300 px-4 py-3 text-sm text-center font-semibold text-gray-700">
                                  {isHoliday ? day.holiday.name : 'Sunday'}
                                </td>
                              ) : (
                                <>
                                  {[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((hour, slotIndex) => {
                                    const count = day.hours[hour] || 0
                                    return (
                                      <td key={slotIndex} className="border border-gray-300 px-2 py-3 text-sm text-center text-gray-900">
                                        {count || ''}
                                      </td>
                                    )
                                  })}
                                  <td className="border border-gray-300 px-4 py-3 text-sm text-center font-semibold text-blue-800 bg-blue-50">
                                    {day.total}
                                  </td>
                                  <td className="border border-gray-300 px-4 py-3 text-sm text-center font-semibold text-green-800 bg-green-50">
                                    {day.uniqueCount}
                                  </td>
                                </>
                              )}
                            </tr>
                          )
                        })}
                        <tr className="bg-gray-200 font-semibold">
                          <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900">TOTAL</td>
                          {[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((hour, slotIndex) => {
                            const total = lockerPerTransactionData.hourlyTotals[hour] || 0
                            return (
                              <td key={slotIndex} className="border border-gray-300 px-2 py-3 text-sm text-center text-gray-900">
                                {total || ''}
                              </td>
                            )
                          })}
                          <td className="border border-gray-300 px-4 py-3 text-sm text-center font-bold text-blue-800 bg-blue-200">
                            {lockerPerTransactionData.summary.totalAssignments}
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-sm text-center font-bold text-green-800 bg-green-200">
                            {lockerPerTransactionData.summary.totalUniqueUsers}
                          </td>
                        </tr>
                        <tr className="bg-gray-100">
                          <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900">AVERAGE</td>
                          {[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((hour, slotIndex) => {
                            const avg = lockerPerTransactionData.hourlyAverages?.[hour] || 0
                            return (
                              <td key={slotIndex} className="border border-gray-300 px-2 py-3 text-sm text-center text-gray-900">
                                {avg || ''}
                              </td>
                            )
                          })}
                          <td className="border border-gray-300 px-4 py-3 text-sm text-center font-bold text-blue-800 bg-blue-200">
                            {Math.round(Object.values(lockerPerTransactionData.hourlyAverages || {}).reduce((sum: number, val: any) => sum + (val || 0), 0))}
                          </td>
                          <td className="border border-gray-300 px-4 py-3 text-sm text-center"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* User Type Statistics Tab */}
            <TabsContent value="usertype">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>User Type Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User Type</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Count</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Percentage</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {Object.entries(lockerPerTransactionData.userTypeStats).map(([type, count]) => (
                            <tr key={type} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">{type}</td>
                              <td className="px-6 py-4 text-sm text-center text-gray-900">{count as number}</td>
                              <td className="px-6 py-4 text-sm text-center text-gray-900">
                                {lockerPerTransactionData.summary.totalAssignments > 0
                                  ? ((count as number / lockerPerTransactionData.summary.totalAssignments) * 100).toFixed(1)
                                  : '0.0'}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Summary Tab */}
            <TabsContent value="summary">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Total Unique Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-blue-600">
                      {(lockerPerTransactionData.summary.totalUniqueUsers || 0).toLocaleString()}
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Unique users who borrowed lockers during the period
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Average Assignments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-green-600">
                      {lockerPerTransactionData.summary.averageOccupancy}
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Average locker assignments per hour
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Max Assignments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-purple-600">
                      {lockerPerTransactionData.summary.maxOccupancy}
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Peak number of locker assignments in one hour
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Peak Hours Chart */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Peak Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {lockerPerTransactionData.peakHours && lockerPerTransactionData.peakHours.length > 0 ? (
                      lockerPerTransactionData.peakHours.slice(0, 5).map((peak: any, index: number) => {
                        const hourNum = peak.hour
                        const timeLabel = hourNum < 12 
                          ? `${hourNum}:00 AM` 
                          : hourNum === 12 
                            ? '12:00 NN' 
                            : `${hourNum - 12}:00 PM`
                        const percentage = lockerPerTransactionData.summary.maxOccupancy > 0 
                          ? (peak.count / lockerPerTransactionData.summary.maxOccupancy) * 100 
                          : 0

                        return (
                          <div key={index}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium">{timeLabel}</span>
                              <span className="text-gray-600">{peak.count} assignments ({percentage.toFixed(1)}%)</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div
                                className="bg-blue-600 h-2.5 rounded-full"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <p className="text-sm text-gray-600">No peak hour data available</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Entrance/Exit Control Statistics Report */}
        {reportType === 'entrance-exit' && entranceExitData && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                Entrance/Exit Control Statistics for {formatDateRangeForTitle(dateFrom, dateTo, datePreset)}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportToPDF}>
                  <i className="fas fa-file-pdf mr-2"></i>
                  Export PDF
                </Button>
                <Button variant="outline" size="sm" onClick={exportToExcel}>
                  <i className="fas fa-file-excel mr-2"></i>
                  Export Excel
                </Button>
                <Button variant="outline" size="sm" onClick={exportToCSV}>
                  <i className="fas fa-file-csv mr-2"></i>
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600 mb-4">
                <i className="fas fa-info-circle mr-2"></i>
                Shows entrance/exit counts by user category for each hourly time range
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">TIME</th>
                      <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">ADMIN</th>
                      <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">FACULTY</th>
                      <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">EMPLOYEE</th>
                      <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">GUEST</th>
                      <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">ALUMNI</th>
                      <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">BASIC EDUCATION</th>
                      <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">COLLEGE STUDENTS</th>
                      <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 bg-blue-100">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entranceExitData.timeRangeData.map((range: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-900">{range.timeRange}</td>
                        <td className="border border-gray-300 px-4 py-3 text-sm text-center text-gray-900">{range.admin || '-'}</td>
                        <td className="border border-gray-300 px-4 py-3 text-sm text-center text-gray-900">{range.faculty || '-'}</td>
                        <td className="border border-gray-300 px-4 py-3 text-sm text-center text-gray-900">{range.employee || '-'}</td>
                        <td className="border border-gray-300 px-4 py-3 text-sm text-center text-gray-900">{range.guest || '-'}</td>
                        <td className="border border-gray-300 px-4 py-3 text-sm text-center text-gray-900">{range.alumni || '-'}</td>
                        <td className="border border-gray-300 px-4 py-3 text-sm text-center text-gray-900">{range.basicEducation || '-'}</td>
                        <td className="border border-gray-300 px-4 py-3 text-sm text-center text-gray-900">{range.collegeStudents || '-'}</td>
                        <td className="border border-gray-300 px-4 py-3 text-sm text-center font-semibold text-gray-900 bg-blue-50">{range.total}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-200 font-semibold">
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900">TOTAL</td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-center text-gray-900">
                        {entranceExitData.timeRangeData.reduce((sum: number, r: any) => sum + r.admin, 0)}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-center text-gray-900">
                        {entranceExitData.timeRangeData.reduce((sum: number, r: any) => sum + r.faculty, 0)}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-center text-gray-900">
                        {entranceExitData.timeRangeData.reduce((sum: number, r: any) => sum + r.employee, 0)}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-center text-gray-900">
                        {entranceExitData.timeRangeData.reduce((sum: number, r: any) => sum + r.guest, 0)}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-center text-gray-900">
                        {entranceExitData.timeRangeData.reduce((sum: number, r: any) => sum + r.alumni, 0)}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-center text-gray-900">
                        {entranceExitData.timeRangeData.reduce((sum: number, r: any) => sum + r.basicEducation, 0)}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-center text-gray-900">
                        {entranceExitData.timeRangeData.reduce((sum: number, r: any) => sum + r.collegeStudents, 0)}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-center text-gray-900 bg-blue-100">
                        {entranceExitData.summary.totalEntries}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {/* Summary Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-gray-600">Total Entries</div>
                    <div className="text-2xl font-bold text-blue-600">{entranceExitData.summary.totalEntries}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-gray-600">Peak Time Range</div>
                    <div className="text-2xl font-bold text-green-600">{entranceExitData.summary.peakTimeRange}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-gray-600">Average Per Hour</div>
                    <div className="text-2xl font-bold text-purple-600">{entranceExitData.summary.averagePerHour}</div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Student Visits by Department/Grade Level */}
        {reportType === 'student-visits-dept-grade' && studentVisitsDeptGradeData && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                Student Visits by Department/Grade Level for {formatDateRangeForTitle(dateFrom, dateTo, datePreset)}
              </h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportToPDF}>
                  <i className="fas fa-file-pdf mr-2"></i>
                  Export PDF
                </Button>
                <Button variant="outline" size="sm" onClick={exportToExcel}>
                  <i className="fas fa-file-excel mr-2"></i>
                  Export Excel
                </Button>
                <Button variant="outline" size="sm" onClick={exportToCSV}>
                  <i className="fas fa-file-csv mr-2"></i>
                  Export CSV
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-gray-600">Total Visits (logs)</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {studentVisitsDeptGradeData.totals?.totalVisits || studentVisitsDeptGradeData.byDepartment.reduce((s: number, d: any) => s + (d.count || 0), 0)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-gray-600">Departments Counted</div>
                  <div className="text-2xl font-bold text-green-600">
                    {studentVisitsDeptGradeData.byDepartment.length}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-gray-600">Grade Levels Counted</div>
                  <div className="text-2xl font-bold text-purple-600">
                    {studentVisitsDeptGradeData.byGradeLevel.length}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>By Department</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">Department</th>
                        <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">Code</th>
                        <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 text-right">Visits</th>
                        <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 text-right">Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentVisitsDeptGradeData.byDepartment.map((d: any, idx: number) => {
                        const total = studentVisitsDeptGradeData.totals?.totalVisits || studentVisitsDeptGradeData.byDepartment.reduce((s: number, x: any) => s + (x.count || 0), 0)
                        const pct = total > 0 ? ((d.count / total) * 100).toFixed(1) + '%' : '0.0%'
                        return (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900">{d.name}</td>
                            <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">{d.code || ''}</td>
                            <td className="border border-gray-300 px-4 py-3 text-sm text-right text-gray-900">{d.count}</td>
                            <td className="border border-gray-300 px-4 py-3 text-sm text-right text-gray-900">{pct}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>By Grade Level</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">Grade Level</th>
                        <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700">Education Level</th>
                        <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 text-right">Visits</th>
                        <th className="border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 text-right">Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentVisitsDeptGradeData.byGradeLevel.map((g: any, idx: number) => {
                        const total = studentVisitsDeptGradeData.byGradeLevel.reduce((s: number, x: any) => s + (x.count || 0), 0)
                        const pct = total > 0 ? ((g.count / total) * 100).toFixed(1) + '%' : '0.0%'
                        return (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900">{g.name}</td>
                            <td className="border border-gray-300 px-4 py-3 text-sm text-gray-700">{g.education_level || ''}</td>
                            <td className="border border-gray-300 px-4 py-3 text-sm text-right text-gray-900">{g.count}</td>
                            <td className="border border-gray-300 px-4 py-3 text-sm text-right text-gray-900">{pct}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {reportType === 'student-visits-dept-grade' && !studentVisitsDeptGradeData && !loading && (
          <NoDataState
            icon="fas fa-building"
            message='Click "Generate Report" to view student visits grouped by department and grade level'
          />
        )}


        {/* Individual Student Statistics Report */}
        {reportType === 'individual' && individualReportData && (
          <div className="space-y-6">
            {/* Export Buttons */}
            <div className="flex justify-end gap-2 mb-4">
              <Button variant="outline" size="sm" onClick={exportToPDF}>
                <i className="fas fa-file-pdf mr-2"></i>
                Export PDF
              </Button>
              <Button variant="outline" size="sm" onClick={exportToExcel}>
                <i className="fas fa-file-excel mr-2"></i>
                Export Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <i className="fas fa-file-csv mr-2"></i>
                Export CSV
              </Button>
            </div>

            {/* User Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Student/User Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">ID Number</p>
                    <p className="font-semibold">{individualReportData.user.account_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Full Name</p>
                    <p className="font-semibold">{individualReportData.user.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">User Type</p>
                    <p className="font-semibold">{individualReportData.user.user_type}</p>
                  </div>
                  {individualReportData.user.department && (
                    <div>
                      <p className="text-sm text-gray-600">Department</p>
                      <p className="font-semibold">{individualReportData.user.department}</p>
                    </div>
                  )}
                  {individualReportData.user.program && (
                    <div>
                      <p className="text-sm text-gray-600">Program</p>
                      <p className="font-semibold">{individualReportData.user.program}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Books Borrowed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {individualReportData.borrowing.summary.total_borrowed}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {individualReportData.borrowing.summary.currently_borrowed} active
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Library Visits</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {individualReportData.visits.summary.total_visits}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Avg {individualReportData.visits.summary.avg_duration_minutes} min/visit
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total Penalties</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    ₱{individualReportData.penalties.summary.total_penalties.toFixed(2)}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Balance: ₱{individualReportData.penalties.summary.total_balance.toFixed(2)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Locker Rentals</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">
                    {individualReportData.locker_usage.summary.total_rentals}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {individualReportData.locker_usage.summary.current_rental ? 'Active rental' : 'No active rental'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Borrowing History */}
            <Card>
              <CardHeader>
                <CardTitle>Borrowing History</CardTitle>
              </CardHeader>
              <CardContent>
                {individualReportData.borrowing.history.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Book</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Accession #</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Borrow Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Penalty</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {individualReportData.borrowing.history.map((item: any) => (
                          <tr key={item.transaction_id}>
                            <td className="px-4 py-3 text-sm">{item.book_title}</td>
                            <td className="px-4 py-3 text-sm">{item.accession_number}</td>
                            <td className="px-4 py-3 text-sm">{new Date(item.borrow_date).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-sm">{new Date(item.due_date).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`px-2 py-1 text-xs rounded ${
                                item.status === 'ACTIVE' ? 'bg-blue-100 text-blue-700' :
                                item.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">₱{Number(item.penalty).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No borrowing history</p>
                )}
              </CardContent>
            </Card>

            {/* Recent Visits */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Library Visits</CardTitle>
              </CardHeader>
              <CardContent>
                {individualReportData.visits.logs.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry Time</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exit Time</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purpose</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {individualReportData.visits.logs.slice(0, 10).map((log: any) => (
                          <tr key={log.entry_id}>
                            <td className="px-4 py-3 text-sm">{new Date(log.entry_time).toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm">
                              {log.exit_time ? new Date(log.exit_time).toLocaleString() : 'In library'}
                            </td>
                            <td className="px-4 py-3 text-sm">{log.purpose || 'N/A'}</td>
                            <td className="px-4 py-3 text-sm">
                              {log.duration_minutes ? `${log.duration_minutes} min` : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No visit records</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {reportType === 'individual' && !individualReportData && !loading && (
          <NoDataState
            icon="fas fa-user-chart"
            message='Search and select a student/user, then click "Generate Report" to view their individual statistics'
          />
        )}

        {/* Locker Usage Statistics Report */}
        {reportType === 'locker-per-transaction' && lockerPerTransactionData && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total Assignments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {lockerPerTransactionData.summary.totalAssignments}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">In period</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Unique Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {lockerPerTransactionData.summary.totalUniqueUsers || 0}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Different users</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Avg Per Day</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">
                    {lockerPerTransactionData.summary.averagePerDay}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Assignments/day</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Peak Hour</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {lockerPerTransactionData.summary.peakHour ? 
                      `${lockerPerTransactionData.summary.peakHour}:00` : 'N/A'}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Most active</p>
                </CardContent>
              </Card>
            </div>

            {/* User Type Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>User Type Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600">
                      {lockerPerTransactionData.userTypeStats.ADMIN || 0}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Admin</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-3xl font-bold text-green-600">
                      {lockerPerTransactionData.userTypeStats.FACULTY || 0}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Faculty</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-3xl font-bold text-purple-600">
                      {lockerPerTransactionData.userTypeStats['COLLEGE STUDENTS'] || 0}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">College Students</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-3xl font-bold text-yellow-600">
                      {lockerPerTransactionData.userTypeStats['BASIC EDUCATION STUDENTS'] || 0}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Basic Education</div>
                  </div>
                  <div className="text-center p-4 bg-pink-50 rounded-lg">
                    <div className="text-3xl font-bold text-pink-600">
                      {lockerPerTransactionData.userTypeStats.EMPLOYEE || 0}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Employee</div>
                  </div>
                  <div className="text-center p-4 bg-indigo-50 rounded-lg">
                    <div className="text-3xl font-bold text-indigo-600">
                      {lockerPerTransactionData.userTypeStats.GUEST || 0}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Guest</div>
                  </div>
                  <div className="text-center p-4 bg-teal-50 rounded-lg">
                    <div className="text-3xl font-bold text-teal-600">
                      {lockerPerTransactionData.userTypeStats.ALUMNI || 0}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Alumni</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Hourly Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Peak Hours</CardTitle>
              </CardHeader>
              <CardContent>
                {lockerPerTransactionData.peakHours && lockerPerTransactionData.peakHours.length > 0 ? (
                  <div className="space-y-2">
                    {lockerPerTransactionData.peakHours.map((peak: { hour: number; count: number }, index: number) => (
                      <div key={peak.hour} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex items-center">
                          <span className="text-lg font-semibold text-gray-700 mr-3">#{index + 1}</span>
                          <span className="text-sm font-medium">{peak.hour}:00 - {peak.hour + 1}:00</span>
                        </div>
                        <span className="text-sm font-bold text-blue-600">{peak.count} assignments</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No peak hour data available</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {reportType === 'locker-per-transaction' && !lockerPerTransactionData && !loading && (
          <NoDataState
            icon="fas fa-door-closed"
            message='Click "Generate Report" to view locker statistics'
          />
        )}

        {/* Entry Records Export Display - Removed */}
        {false && (
          <div className="space-y-6">
            {/* Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle>Entry Records Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600">
                      {entryRecordsData.length}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Total Records</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-3xl font-bold text-green-600">
                      {entryRecordsData.filter((r: any) => !r.isActive).length}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Completed Visits</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-3xl font-bold text-orange-600">
                      {entryRecordsData.filter((r: any) => r.isActive).length}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Active (Inside)</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-3xl font-bold text-purple-600">
                      {entryUserFilter === 'specific' ? entrySelectedUserName : 'All Users'}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">User Filter</div>
                  </div>
                </div>
                {dateFrom && dateTo && (
                  <div className="mt-4 text-center text-sm text-gray-600">
                    Date Range: {new Date(dateFrom).toLocaleDateString()} - {new Date(dateTo).toLocaleDateString()}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Records Table */}
            <Card>
              <CardHeader>
                <CardTitle>Entry Records ({entryRecordsData.length} records)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exit Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purpose</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {entryRecordsData.map((record: any) => (
                        <tr key={record.entry_id} className={record.isActive ? 'bg-orange-50' : ''}>
                          <td className="px-4 py-3 text-sm">
                            {new Date(record.entry_time).toLocaleString('en-US', {
                              month: '2-digit',
                              day: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {record.exit_time ? (
                              new Date(record.exit_time).toLocaleString('en-US', {
                                month: '2-digit',
                                day: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              })
                            ) : (
                              <span className="text-gray-400 italic">Still Inside</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="font-medium text-gray-900">{record.user?.full_name || 'Unknown'}</div>
                            <div className="text-xs text-gray-500">{record.user?.account_id || 'N/A'}</div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              record.user?.user_type === 'STUDENT' ? 'bg-blue-100 text-blue-700' :
                              record.user?.user_type === 'EMPLOYEE' ? 'bg-green-100 text-green-700' :
                              record.user?.user_type === 'ALUMNI' ? 'bg-purple-100 text-purple-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {record.user?.user_type || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">{record.purpose || 'General'}</td>
                          <td className="px-4 py-3 text-sm font-medium">
                            {record.isActive ? (
                              <span className="text-orange-600">
                                <i className="fas fa-circle text-xs mr-1"></i>
                                {record.durationText}
                              </span>
                            ) : (
                              <span className="text-gray-700">{record.durationText}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              record.isActive
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {record.isActive ? 'Active' : 'Completed'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {entryRecordsData.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-8">No entry records found</p>
                )}
              </CardContent>
            </Card>

            {/* Export Instructions */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <i className="fas fa-info-circle text-blue-600 mt-1"></i>
                  <div>
                    <p className="text-sm font-medium text-blue-900 mb-1">Ready to Export</p>
                    <p className="text-xs text-blue-700">
                      Use the export buttons at the top to download this data in PDF, Excel, or CSV format. 
                      Active entries are highlighted and show current duration. Duration calculations use the format: "X hrs Y min" for easy reading.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {false && (
          <NoDataState
            icon="fas fa-file-export"
            message='Configure your filters and click "Generate Report" to load entry records for export'
          />
        )}

        {/* No Data States for All Report Types */}
        {false && (
          <NoDataState
            icon="fas fa-chart-bar"
            title="No Report Data"
            message='Select a date range, then click "Generate Report" to view statistics'
          />
        )}

        {!usersConcurrentData && !loading && reportType === 'users-concurrent' && (
          <NoDataState
            icon="fas fa-users"
            title="No Report Data"
            message='Select a date range, then click "Generate Report" to view user concurrent statistics'
          />
        )}

        {!usersPerTransactionData && !loading && reportType === 'users-per-transaction' && (
          <NoDataState
            icon="fas fa-user-clock"
            title="No Report Data"
            message='Select a date range, then click "Generate Report" to view user per-transaction statistics'
          />
        )}

        {!entranceExitData && !loading && reportType === 'entrance-exit' && (
          <NoDataState
            icon="fas fa-door-open"
            title="No Report Data"
            message='Select a date range, then click "Generate Report" to view entrance/exit control statistics'
          />
        )}
      </div>
    </>
  )
}

