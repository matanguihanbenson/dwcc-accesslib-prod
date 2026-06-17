"use client"
import React, { useState, useMemo, useEffect } from 'react'
import { notify } from '@/lib/notification'

interface AdminViewProps {
  lockers: any[]
  transactions: any[]
  onRefresh: () => void
}

function AdminView({ lockers, transactions, onRefresh }: AdminViewProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeTab, setActiveTab] = useState('lockers')
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  
  // Date filter states
  const [dateFilterType, setDateFilterType] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom' | 'date'>('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [specificDate, setSpecificDate] = useState('')
  
  // Debug logging
  console.log('AdminView - Lockers count:', lockers.length)
  console.log('AdminView - Transactions count:', transactions.length)
  console.log('AdminView - Transactions:', transactions)
  
  // Modal states
  const [showAddLockerModal, setShowAddLockerModal] = useState(false)
  const [showUpdateLockerModal, setShowUpdateLockerModal] = useState(false)
  const [showRfidModal, setShowRfidModal] = useState(false)
  const [selectedLocker, setSelectedLocker] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rfidInput, setRfidInput] = useState('')
  const [isScanning, setIsScanning] = useState(false)

  // Real-time timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    
    return () => clearInterval(timer)
  }, [])

  // Format time as HH:MM:SS
  const formatTimeHMS = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  // Calculate real-time locker info
  const calculateLockerTimeInfo = (locker: any) => {
    if (!locker.activeTransaction) return null
    
    const now = currentTime
    const borrowTime = new Date(locker.activeTransaction.borrow_time)
    const dueTime = locker.activeTransaction.due_time ? new Date(locker.activeTransaction.due_time) : null
    
    const timeUsedMs = now.getTime() - borrowTime.getTime()
    const timeUsedFormatted = formatTimeHMS(timeUsedMs)
    
    // Determine if overdue with 2 hours free use + extensions
    let isOvertime = false
    let fine = 0
    
    if (dueTime) {
      // Use the due_time from the transaction (which includes extensions)
      isOvertime = now > dueTime

      if (isOvertime) {
        const exceededMs = now.getTime() - dueTime.getTime()
        const exceededHours = exceededMs / (1000 * 60 * 60)
        // Immediate-fine policy: any overrun (even 1 second) is billed as
        // the first full hour, and each started hour after that adds
        // another fine. Math.ceil ensures the first penalty applies
        // right away, matching the staff view and the return/extend APIs.
        fine = Math.ceil(exceededHours) * 20
      }
    } else {
      // If no due_time, assume 2 hours free use from borrow time
      const twoHoursMs = 2 * 60 * 60 * 1000
      const freeUseEndTime = borrowTime.getTime() + twoHoursMs
      isOvertime = now.getTime() > freeUseEndTime

      if (isOvertime) {
        const exceededMs = now.getTime() - freeUseEndTime
        const exceededHours = exceededMs / (1000 * 60 * 60)
        // Same immediate-fine policy as above.
        fine = Math.ceil(exceededHours) * 20
      }
    }
    
    return {
      timeUsedFormatted,
      isOvertime,
      fine
    }
  }
  
  // Form data
  const [lockerForm, setLockerForm] = useState({
    lockerNumber: '',
    location: '',
    status: 'AVAILABLE'
  })

  const handleAddLocker = () => {
    setShowAddLockerModal(true)
    setLockerForm({
      lockerNumber: '',
      location: 'Main Library',
      status: 'AVAILABLE'
    })
  }

  const handleUpdateLocker = (locker: any) => {
    setSelectedLocker(locker)
    setShowUpdateLockerModal(true)
    setLockerForm({
      lockerNumber: locker.locker_number,
      location: locker.location,
      status: locker.status
    })
  }

  const handleSubmitAddLocker = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!lockerForm.lockerNumber.trim() || !lockerForm.location.trim()) {
      notify.error('Error', 'Please enter locker number and location')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          locker_number: lockerForm.lockerNumber,
          location: lockerForm.location
        })
      })

      if (response.ok) {
        notify.success('Success', `Locker ${lockerForm.lockerNumber} added successfully!`)
        setShowAddLockerModal(false)
        setLockerForm({ lockerNumber: '', location: '', status: 'AVAILABLE' })
        onRefresh()
      } else {
        const error = await response.json()
        
        // Check if there's an archived locker with the same name
        if (error.error === 'ARCHIVED_LOCKER_EXISTS') {
          setIsSubmitting(false)
          
          const confirmed = await notify.confirm(
            'Archived Locker Found',
            `Locker ${lockerForm.lockerNumber} exists in the archive. Would you like to restore it instead?`
          )
          
          if (confirmed) {
            // Restore the archived locker
            await handleRestoreArchivedLocker(error.data.locker_id)
          }
          return
        }
        
        notify.error('Error', error.message || error.error || 'Failed to add locker')
      }
    } catch (error) {
      notify.error('Error', 'Failed to add locker. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRestoreArchivedLocker = async (lockerId: number) => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/lockers/${lockerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: 'AVAILABLE',
          unarchive: true
        })
      })

      if (response.ok) {
        notify.success('Success', 'Locker restored from archive successfully!')
        setShowAddLockerModal(false)
        setLockerForm({ lockerNumber: '', location: '', status: 'AVAILABLE' })
        onRefresh()
      } else {
        const error = await response.json()
        notify.error('Error', error.error || 'Failed to restore locker')
      }
    } catch (error) {
      notify.error('Error', 'Failed to restore locker. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitUpdateLocker = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!lockerForm.lockerNumber.trim() || !lockerForm.location.trim()) {
      notify.error('Error', 'Please enter locker number and location')
      return
    }

    if (!selectedLocker?.locker_id) {
      notify.error('Error', 'No locker selected')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        locker_number: lockerForm.lockerNumber.trim(),
        location: lockerForm.location.trim(),
        status: lockerForm.status
      }
      
      console.log('Updating locker:', selectedLocker.locker_id, payload)
      
      const response = await fetch(`/api/lockers/${selectedLocker.locker_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      console.log('Update response:', response.status, result)

      if (response.ok) {
        notify.success('Success', result.message || 'Locker updated successfully!')
        setShowUpdateLockerModal(false)
        setSelectedLocker(null)
        setLockerForm({ lockerNumber: '', location: '', status: 'AVAILABLE' })
        onRefresh()
      } else {
        notify.error('Error', result.error || result.message || 'Failed to update locker')
      }
    } catch (error) {
      console.error('Update locker error:', error)
      notify.error('Error', 'Failed to update locker. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleArchiveLocker = async (locker: any) => {
    const confirmed = await notify.confirm(
      'Archive Locker?',
      `Are you sure you want to archive locker ${locker.locker_number}? This action cannot be undone.`
    )

    if (!confirmed) return

    try {
      const response = await fetch(`/api/lockers/${locker.locker_id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (response.ok) {
        notify.success('Success', 'Locker archived successfully')
        onRefresh()
      } else {
        const error = await response.json()
        notify.error('Error', error.error || 'Failed to archive locker')
      }
      } catch (error) {
      notify.error('Error', 'Failed to archive locker')
    }
  }

  const handleBindRfid = (locker: any) => {
    setSelectedLocker(locker)
    setRfidInput(locker.rfid_code || '')
    setShowRfidModal(true)
  }

  const handleSubmitRfid = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!rfidInput.trim()) {
      notify.error('Error', 'Please tap or enter RFID code')
      return
    }

    if (!selectedLocker?.locker_id) {
      notify.error('Error', 'No locker selected')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = { rfid_code: rfidInput.trim() }
      
      const response = await fetch(`/api/lockers/${selectedLocker.locker_id}/bind-rfid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      console.log('RFID bind response:', response.status, result)

      if (response.ok) {
        notify.success('Success', result.message || 'RFID bound successfully')
        setShowRfidModal(false)
        setRfidInput('')
        setSelectedLocker(null)
        onRefresh()
      } else {
        notify.error('Error', result.error || result.message || 'Failed to bind RFID')
      }
    } catch (error) {
      console.error('RFID bind error:', error)
      notify.error('Error', 'Failed to bind RFID')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUnbindRfid = async () => {
    if (!selectedLocker?.rfid_code) {
      notify.error('Error', 'No RFID bound to this locker')
      return
    }

    if (!selectedLocker?.locker_id) {
      notify.error('Error', 'No locker selected')
      return
    }

    const confirmed = await notify.confirm(
      'Unbind RFID?',
      `Are you sure you want to unbind the RFID from locker ${selectedLocker.locker_number}?`
    )

    if (!confirmed) return

    setIsSubmitting(true)
    try {
      console.log('Unbinding RFID from locker:', selectedLocker.locker_id)
      
      const response = await fetch(`/api/lockers/${selectedLocker.locker_id}/bind-rfid`, {
        method: 'DELETE',
        credentials: 'include'
      })

      const result = await response.json()
      console.log('RFID unbind response:', response.status, result)

      if (response.ok) {
        notify.success('Success', result.message || 'RFID unbound successfully')
        setShowRfidModal(false)
        setRfidInput('')
        setSelectedLocker(null)
        onRefresh()
      } else {
        notify.error('Error', result.error || result.message || 'Failed to unbind RFID')
      }
    } catch (error) {
      console.error('RFID unbind error:', error)
      notify.error('Error', 'Failed to unbind RFID')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filter lockers
  const filteredLockers = useMemo(() => {
    const list = lockers.filter(locker => {
      const matchesSearch = locker.locker_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            locker.location.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = !statusFilter || locker.status === statusFilter
      return matchesSearch && matchesStatus
    })
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [lockers, searchTerm, statusFilter])

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchesSearch = tx.locker.locker_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            tx.user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            tx.user.account_id.toLowerCase().includes(searchTerm.toLowerCase())
      
      // Date filtering
      let matchesDate = true
      const borrowTime = new Date(tx.borrow_time)
      const now = new Date()
      
      if (dateFilterType === 'today') {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        matchesDate = borrowTime >= today && borrowTime < tomorrow
      } else if (dateFilterType === 'week') {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        weekAgo.setHours(0, 0, 0, 0)
        matchesDate = borrowTime >= weekAgo
      } else if (dateFilterType === 'month') {
        const monthAgo = new Date()
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        monthAgo.setHours(0, 0, 0, 0)
        matchesDate = borrowTime >= monthAgo
      } else if (dateFilterType === 'year') {
        const yearAgo = new Date()
        yearAgo.setFullYear(yearAgo.getFullYear() - 1)
        yearAgo.setHours(0, 0, 0, 0)
        matchesDate = borrowTime >= yearAgo
      } else if (dateFilterType === 'custom' && customStartDate && customEndDate) {
        const startDate = new Date(customStartDate)
        startDate.setHours(0, 0, 0, 0)
        const endDate = new Date(customEndDate)
        endDate.setHours(23, 59, 59, 999)
        matchesDate = borrowTime >= startDate && borrowTime <= endDate
      } else if (dateFilterType === 'date' && specificDate) {
        const targetDate = new Date(specificDate)
        targetDate.setHours(0, 0, 0, 0)
        const nextDay = new Date(targetDate)
        nextDay.setDate(nextDay.getDate() + 1)
        matchesDate = borrowTime >= targetDate && borrowTime < nextDay
      }
      
      return matchesSearch && matchesDate
    })
  }, [transactions, searchTerm, dateFilterType, customStartDate, customEndDate, specificDate])

  // Calculate statistics for summary cards
  const stats = useMemo(() => {
    const total = lockers.length
    const occupied = lockers.filter(l => l.status === 'OCCUPIED').length
    const available = lockers.filter(l => l.status === 'AVAILABLE').length
    const maintenance = lockers.filter(l => l.status === 'MAINTENANCE' || l.status === 'DAMAGED').length
    
    return { total, occupied, available, maintenance }
  }, [lockers])

  const renderStatsCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Total Lockers */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Lockers</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
            <i className="fas fa-inbox text-blue-600 text-xl"></i>
          </div>
        </div>
      </div>

      {/* Occupied */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Occupied</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{stats.occupied}</p>
          </div>
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <i className="fas fa-lock text-blue-600 text-xl"></i>
          </div>
        </div>
      </div>

      {/* Available */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Available</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{stats.available}</p>
          </div>
          <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
            <i className="fas fa-unlock text-green-600 text-xl"></i>
          </div>
        </div>
      </div>

      {/* Maintenance */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Maintenance</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.maintenance}</p>
          </div>
          <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
            <i className="fas fa-wrench text-yellow-600 text-xl"></i>
          </div>
        </div>
      </div>
    </div>
  )

  const renderTabs = () => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      <nav className="flex space-x-1 p-1">
        <button
          onClick={() => setActiveTab('lockers')}
          className={`flex-1 py-3 px-4 rounded-md font-medium text-sm transition-all duration-200 ${
            activeTab === 'lockers'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <i className="fas fa-inbox mr-2"></i>
          All Lockers
          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
            activeTab === 'lockers' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
          }`}>
            {filteredLockers.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('usage')}
          className={`flex-1 py-3 px-4 rounded-md font-medium text-sm transition-all duration-200 ${
            activeTab === 'usage'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <i className="fas fa-clock mr-2"></i>
          Usage Records
          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
            activeTab === 'usage' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
          }`}>
            {filteredTransactions.length}
          </span>
        </button>
      </nav>
    </div>
  )

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

  const renderLockersTab = () => (
    <div className="space-y-4">
      {/* Enhanced Filter Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
            <div className="relative flex-1 min-w-[300px]">
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by locker number or location..."
                className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="relative min-w-[180px]">
              <i className="fas fa-filter absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none bg-white"
              >
                <option value="">All Status</option>
                <option value="AVAILABLE">Available</option>
                <option value="OCCUPIED">Occupied</option>
                <option value="DAMAGED">Damaged</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
              <i className="fas fa-chevron-down absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"></i>
            </div>
          </div>
          <button
            onClick={handleAddLocker}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-medium transition-all hover:shadow-md flex items-center gap-2 whitespace-nowrap"
          >
            <i className="fas fa-plus"></i>
            Add Locker
          </button>
        </div>
      </div>

      {/* Enhanced Lockers Table */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <i className="fas fa-hashtag mr-2 text-gray-400"></i>Locker Number
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <i className="fas fa-map-marker-alt mr-2 text-gray-400"></i>Location
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <i className="fas fa-info-circle mr-2 text-gray-400"></i>Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <i className="fas fa-wifi mr-2 text-gray-400"></i>RFID Code
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <i className="fas fa-user mr-2 text-gray-400"></i>Assigned To
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <i className="fas fa-clock mr-2 text-gray-400"></i>Time Info
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <i className="fas fa-cog mr-2 text-gray-400"></i>Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredLockers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <i className="fas fa-inbox text-4xl mb-3"></i>
                      <p className="text-sm font-medium">No lockers found</p>
                      <p className="text-xs mt-1">Try adjusting your filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLockers.map((locker) => (
                  <tr key={locker.locker_id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-bold text-gray-900 bg-gray-100 px-3 py-1.5 rounded-md">
                        {locker.locker_number}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-700">{locker.location}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1.5 inline-flex text-xs leading-5 font-semibold rounded-lg ${getStatusBadge(locker.status)}`}>
                      {locker.status}
                    </span>
                  </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {locker.rfid_code ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-blue-50 px-2.5 py-1.5 rounded-md border border-blue-200 text-blue-700">
                            {locker.rfid_code}
                          </span>
                          <i className="fas fa-check-circle text-green-500" title="RFID Bound"></i>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs flex items-center gap-1">
                          <i className="fas fa-unlink"></i> Not bound
                        </span>
                      )}
                  </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {locker.activeTransaction ? (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <i className="fas fa-user text-blue-600 text-xs"></i>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{locker.activeTransaction.user.full_name}</div>
                            <div className="text-xs text-gray-500">{locker.activeTransaction.user.account_id}</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                  </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(() => {
                        const timeInfo = calculateLockerTimeInfo(locker)
                        return timeInfo ? (
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-gray-900 flex items-center gap-1">
                              <i className="fas fa-hourglass-half text-gray-400 text-xs"></i>
                              {timeInfo.timeUsedFormatted}
                            </div>
                            {timeInfo.isOvertime && (
                              <div className="text-xs text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded inline-flex items-center gap-1">
                                <i className="fas fa-exclamation-triangle"></i>
                                Overdue! ₱{timeInfo.fine}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )
                      })()}
                  </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleBindRfid(locker)}
                          className={`p-2 rounded-lg transition-all hover:shadow-md ${
                            locker.rfid_code 
                              ? 'bg-purple-50 text-purple-600 hover:bg-purple-100' 
                              : 'bg-green-50 text-green-600 hover:bg-green-100'
                          }`}
                          title={locker.rfid_code ? 'Manage RFID' : 'Bind RFID'}
                        >
                          <i className={`fas ${locker.rfid_code ? 'fa-id-card' : 'fa-plus-circle'}`}></i>
                        </button>
			      <button
                          onClick={() => handleUpdateLocker(locker)}
                          className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all hover:shadow-md"
                          title="Update Locker"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        {locker.status !== 'OCCUPIED' && (
                          <button
                            onClick={() => handleArchiveLocker(locker)}
                            className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all hover:shadow-md"
                            title="Archive Locker"
                          >
                            <i className="fas fa-archive"></i>
                          </button>
                        )}
			    </div>
			  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderUsageTab = () => (
    <div className="space-y-4">
      {/* Enhanced Filters */}
      <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 space-y-5">
        {/* Search */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            <i className="fas fa-search mr-2 text-gray-400"></i>Search Records
          </label>
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by locker, name, or ID..."
              className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Date Filter Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            <i className="fas fa-calendar-alt mr-2 text-gray-400"></i>Filter by Date
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setDateFilterType('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'all'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
              }`}
            >
              <i className="fas fa-globe mr-1"></i>All Records
            </button>
            <button
              onClick={() => setDateFilterType('today')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'today'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
              }`}
            >
              <i className="fas fa-calendar-day mr-1"></i>Today
            </button>
            <button
              onClick={() => setDateFilterType('week')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'week'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
              }`}
            >
              <i className="fas fa-calendar-week mr-1"></i>This Week
            </button>
            <button
              onClick={() => setDateFilterType('month')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'month'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
              }`}
            >
              <i className="fas fa-calendar-alt mr-1"></i>This Month
            </button>
            <button
              onClick={() => setDateFilterType('year')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'year'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
              }`}
            >
              <i className="fas fa-calendar mr-1"></i>This Year
            </button>
            <button
              onClick={() => setDateFilterType('date')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'date'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
              }`}
            >
              <i className="fas fa-calendar-check mr-1"></i>Specific Date
            </button>
            <button
              onClick={() => setDateFilterType('custom')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'custom'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
              }`}
            >
              <i className="fas fa-calendar-plus mr-1"></i>Custom Range
            </button>
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {dateFilterType === 'custom' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Specific Date Input */}
        {dateFilterType === 'date' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
            <input
              type="date"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Active Filter Summary */}
        {dateFilterType !== 'all' && (
          <div className="flex items-center gap-3 text-sm text-gray-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <i className="fas fa-filter text-blue-600"></i>
            </div>
            <span className="flex-1 font-medium">
              {dateFilterType === 'today' && 'Showing records from today'}
              {dateFilterType === 'week' && 'Showing records from the last 7 days'}
              {dateFilterType === 'month' && 'Showing records from the last 30 days'}
              {dateFilterType === 'year' && 'Showing records from the last year'}
              {dateFilterType === 'date' && specificDate && `Showing records from ${new Date(specificDate).toLocaleDateString()}`}
              {dateFilterType === 'custom' && customStartDate && customEndDate && 
                `Showing records from ${new Date(customStartDate).toLocaleDateString()} to ${new Date(customEndDate).toLocaleDateString()}`}
            </span>
            <button
              onClick={() => {
                setDateFilterType('all')
                setCustomStartDate('')
                setCustomEndDate('')
                setSpecificDate('')
              }}
              className="px-3 py-1.5 bg-white text-blue-600 hover:bg-blue-100 rounded-md font-medium transition-colors border border-blue-200"
            >
              <i className="fas fa-times mr-1"></i>Clear
            </button>
          </div>
        )}
      </div>

      {/* Enhanced Usage Records Table */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <i className="fas fa-inbox mr-2 text-gray-400"></i>Locker
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <i className="fas fa-user mr-2 text-gray-400"></i>User
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <i className="fas fa-sign-in-alt mr-2 text-gray-400"></i>Borrow Time
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <i className="fas fa-sign-out-alt mr-2 text-gray-400"></i>Return Time
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <i className="fas fa-hourglass-half mr-2 text-gray-400"></i>Duration
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <i className="fas fa-info-circle mr-2 text-gray-400"></i>Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <i className="fas fa-folder-open text-4xl mb-3"></i>
                      <p className="text-sm font-medium">
                        {dateFilterType !== 'all' ? 'No usage records found for the selected date range' : 'No usage records found'}
                      </p>
                      <p className="text-xs mt-1">Try adjusting your filters or date range</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.transaction_id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-bold text-gray-900 bg-gray-100 px-3 py-1.5 rounded-md">
                        {tx.locker.locker_number}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <i className="fas fa-user text-blue-600 text-xs"></i>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{tx.user.full_name}</div>
                          <div className="text-xs text-gray-500">{tx.user.account_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {new Date(tx.borrow_time).toLocaleString('en-US', { 
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true,
                        timeZone: 'Asia/Manila'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {tx.return_time ? new Date(tx.return_time).toLocaleString('en-US', { 
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true,
                        timeZone: 'Asia/Manila'
                      }) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {(() => {
                        if (tx.return_time) {
                          // For completed transactions, calculate duration correctly
                          // Use absolute to guard against timezone drift/mismatch
                          const borrowTime = new Date(tx.borrow_time)
                          const returnTime = new Date(tx.return_time)
                          const timeUsedMs = Math.abs(returnTime.getTime() - borrowTime.getTime())
                          return <span className="font-mono">{formatTimeHMS(timeUsedMs)}</span>
                        } else {
                          // For active transactions, use current time for real-time tracking
                          const borrowTime = new Date(tx.borrow_time)
                          const timeUsedMs = currentTime.getTime() - borrowTime.getTime()
                          return <span className="font-mono">{formatTimeHMS(timeUsedMs)}</span>
                        }
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        tx.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 
                        tx.isOvertime ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {tx.status === 'COMPLETED' ? 'Completed' : tx.isOvertime ? 'Overtime' : 'Active'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-6">
      {renderStatsCards()}
      {renderTabs()}
      
      {activeTab === 'lockers' && renderLockersTab()}
      {activeTab === 'usage' && renderUsageTab()}

      {/* Enhanced Add Locker Modal */}
      {showAddLockerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 border border-gray-200">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-200">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-plus text-green-600 text-lg"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900">Add New Locker</h3>
            </div>

            <form onSubmit={handleSubmitAddLocker} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Locker Number *
                </label>
                <input
                  type="text"
                  value={lockerForm.lockerNumber}
                  onChange={(e) => setLockerForm(prev => ({ ...prev, lockerNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., L-051"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location *
                </label>
                  <input
                    type="text"
                  value={lockerForm.location}
                  onChange={(e) => setLockerForm(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., Main Library"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddLockerModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Locker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enhanced Update Locker Modal */}
      {showUpdateLockerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 border border-gray-200">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-200">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-edit text-blue-600 text-lg"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900">Update Locker</h3>
            </div>

            <form onSubmit={handleSubmitUpdateLocker} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Locker Number *
                </label>
                <input
                  type="text"
                  value={lockerForm.lockerNumber}
                  onChange={(e) => setLockerForm(prev => ({ ...prev, lockerNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location *
                </label>
                  <input
                    type="text"
                  value={lockerForm.location}
                  onChange={(e) => setLockerForm(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                  </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={lockerForm.status}
                  onChange={(e) => setLockerForm(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="AVAILABLE">Available</option>
                  <option value="OCCUPIED">Occupied</option>
                  <option value="DAMAGED">Damaged</option>
                  <option value="MAINTENANCE">Maintenance</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUpdateLockerModal(false)
                    setSelectedLocker(null)
                  }}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Updating...' : 'Update Locker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RFID Binding Modal */}
      {showRfidModal && selectedLocker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 border border-gray-200">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-200">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-id-card text-purple-600 text-lg"></i>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Bind RFID to Locker</h3>
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                  <i className="fas fa-inbox text-xs"></i> Locker: <span className="font-semibold">{selectedLocker.locker_number}</span>
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitRfid} className="space-y-4">
              {/* Current RFID Display (if exists) */}
              {selectedLocker.rfid_code && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Currently Bound RFID:</div>
                      <div className="text-lg font-mono font-bold text-purple-700">
                        {selectedLocker.rfid_code}
                      </div>
                    </div>
                    <i className="fas fa-check-circle text-green-600 text-2xl"></i>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <i className="fas fa-wifi mr-2"></i>
                  {selectedLocker.rfid_code ? 'Enter New RFID Code to Update' : 'Tap or Enter RFID Code'}
                </label>
                <input
                  type="text"
                  value={rfidInput}
                  onChange={(e) => setRfidInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder={selectedLocker.rfid_code ? "Tap new RFID card..." : "Tap RFID card or enter code..."}
                  disabled={isSubmitting || isScanning}
                  autoFocus
                />
                {isScanning && (
                  <div className="flex items-center justify-center mt-2">
                    <i className="fas fa-spinner fa-spin text-purple-600 mr-2"></i>
                    <span className="text-sm text-gray-600">Scanning...</span>
                  </div>
                )}
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-start gap-2 text-sm text-purple-700">
                  <i className="fas fa-lightbulb mt-0.5"></i>
                  <div>
                    <p className="font-medium">How to bind RFID:</p>
                    <ol className="list-decimal list-inside text-xs mt-1 space-y-1">
                      <li>Click inside the input field</li>
                      <li>Tap the RFID card on the reader</li>
                      <li>The code will appear automatically</li>
                      <li>Click "Bind RFID" to save</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {/* Action Buttons Row */}
                <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                      setShowRfidModal(false)
                      setRfidInput('')
                      setSelectedLocker(null)
                  }}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                    disabled={isSubmitting || !rfidInput.trim()}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded transition-colors disabled:opacity-50"
                  >
                    <i className="fas fa-link mr-2"></i>
                    {isSubmitting ? (selectedLocker.rfid_code ? 'Updating...' : 'Binding...') : (selectedLocker.rfid_code ? 'Update RFID' : 'Bind RFID')}
                  </button>
                </div>

                {/* Unbind Button (separate row for emphasis) */}
                {selectedLocker.rfid_code && (
                  <button
                    type="button"
                    onClick={handleUnbindRfid}
                    disabled={isSubmitting}
                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50"
                  >
                    <i className="fas fa-unlink mr-2"></i>
                    {isSubmitting ? 'Unbinding...' : 'Unbind RFID (Remove Binding)'}
                </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminView
