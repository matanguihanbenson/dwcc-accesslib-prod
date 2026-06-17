"use client";
import React, { useState, useEffect, useMemo } from 'react'
import { notify } from '@/lib/notification'
import Swal from 'sweetalert2'

interface StaffViewProps {
  lockers: any[]
  onRefresh: () => void
}

function StaffView({ lockers, onRefresh }: StaffViewProps) {
  const [isClient, setIsClient] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showExtendModal, setShowExtendModal] = useState(false)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [showLockerInfoModal, setShowLockerInfoModal] = useState(false)
  const [selectedLockerForInfo, setSelectedLockerForInfo] = useState<any>(null)
  const [scannerInput, setScannerInput] = useState('')
  const [userLookupInput, setUserLookupInput] = useState('')
  const [lockerKeyInput, setLockerKeyInput] = useState('') // Separate input for assign modal
  const [isScanning, setIsScanning] = useState(false)
  const [userData, setUserData] = useState<any>(null)
  const [selectedLockerNumber, setSelectedLockerNumber] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [userInputMode, setUserInputMode] = useState<'rfid' | 'manual'>('rfid')
  const [lockerInputMode, setLockerInputMode] = useState<'rfid' | 'manual'>('rfid')
  const [systemSettings, setSystemSettings] = useState({
    grace_period_hours: 2,
    grace_period_minutes: 15,
    locker_fine_per_hour: 20,
    max_locker_fine: 500,
    max_locker_extensions: 1
  })

  useEffect(() => {
    setIsClient(true)
    
    // Update time every second for real-time tracking
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    
    // Fetch system settings
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/system-settings', {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          const newSettings = {
            grace_period_hours: data.data.fines.grace_period_hours,
            grace_period_minutes: data.data.fines.grace_period_minutes || 15,
            locker_fine_per_hour: data.data.fines.locker_fine_per_hour,
              max_locker_fine: data.data.fines.max_locker_fine,
              max_locker_extensions: data.data.fines.max_locker_extensions || 1
          }
          console.log('Loaded system settings:', newSettings)
          setSystemSettings(newSettings)
        }
      } catch (error) {
        console.error('Failed to fetch system settings:', error)
      }
    }
    fetchSettings()
    
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

  // Format date/time in a cleaner way
  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  // Calculate time used and fines
  const calculateLockerStatus = (locker: any) => {
    if (!locker.activeTransaction || !isClient) return null
    
    const now = currentTime // Use state current time for real-time updates
    const borrowTime = new Date(locker.activeTransaction.borrow_time)
    const dueTime = locker.activeTransaction.due_time ? new Date(locker.activeTransaction.due_time) : null
    
    const timeUsedMs = now.getTime() - borrowTime.getTime()
    const timeUsedFormatted = formatTimeHMS(timeUsedMs)
    
    // Determine if overdue
    // If no due_time is set, use grace period from system settings for free use
    let isOvertime = false
    let fine = 0
    let exceededMs = 0
    let exceededFormatted = '00:00:00'
    
    if (dueTime) {
      // Use the due_time from the transaction (which includes extensions)
      // Add grace period minutes after due_time before fines start
      const gracePeriodMs = (systemSettings.grace_period_minutes || 15) * 60 * 1000
      const fineStartTime = new Date(dueTime.getTime() + gracePeriodMs)
      isOvertime = now > fineStartTime

      if (isOvertime) {
        // Calculate exceeded time in hours after grace period
        exceededMs = now.getTime() - fineStartTime.getTime()
        exceededFormatted = formatTimeHMS(exceededMs)
        const exceededHours = exceededMs / (1000 * 60 * 60)
        // Fines start immediately once the grace window is exceeded: any
        // overrun (even 1 second) is billed as the first full hour, and each
        // started hour after that adds another fine. Use Math.ceil so the
        // first peso applies right away.
        fine = Math.min(
          Math.ceil(exceededHours) * systemSettings.locker_fine_per_hour,
          systemSettings.max_locker_fine
        )
      }
    } else {
      // If no due_time, use grace period from system settings (hours + minutes)
      const graceHoursMs = systemSettings.grace_period_hours * 60 * 60 * 1000
      const graceMinutesMs = (systemSettings.grace_period_minutes || 15) * 60 * 1000
      const freeUseEndTime = borrowTime.getTime() + graceHoursMs + graceMinutesMs
      isOvertime = now.getTime() > freeUseEndTime

      if (isOvertime) {
        exceededMs = now.getTime() - freeUseEndTime
        exceededFormatted = formatTimeHMS(exceededMs)
        const exceededHours = exceededMs / (1000 * 60 * 60)
        // Same immediate-fine policy as above.
        fine = Math.min(
          Math.ceil(exceededHours) * systemSettings.locker_fine_per_hour,
          systemSettings.max_locker_fine
        )
      }
    }
    
    return {
      timeUsedFormatted,
      timeUsedMs,
      isOvertime,
      fine,
      dueTime,
      exceededFormatted
    }
  }

  // Filter lockers
  const filteredLockers = useMemo(() => {
    if (statusFilter === 'Available') {
      return lockers.filter(l => l.status === 'AVAILABLE')
    } else if (statusFilter === 'Occupied') {
      return lockers.filter(l => l.status === 'OCCUPIED')
    }
    return lockers
  }, [lockers, statusFilter])

  const availableCount = lockers.filter(l => l.status === 'AVAILABLE').length
  const occupiedCount = lockers.filter(l => l.status === 'OCCUPIED').length

  // Handle user lookup
  const handleUserLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userLookupInput.trim()) return

    setIsScanning(true)
    try {
      // Use different API parameter based on input mode
      const lookupParam = userInputMode === 'rfid' 
        ? `rfid=${encodeURIComponent(userLookupInput.trim())}`
        : `id=${encodeURIComponent(userLookupInput.trim())}`
        
      const response = await fetch(`/api/staff/users/lookup?${lookupParam}`, {
        method: 'GET',
        credentials: 'include'
      })

      if (response.ok) {
        const result = await response.json()
        console.log('User lookup response:', result) // Debug log
        
        // API returns { success: true, data: { user: {...}, found: true } }
        if (result.data?.user && result.data?.found) {
          const user = result.data.user
          setUserData({
            user_id: user.user_id,
            full_name: user.full_name,
            account_id: user.account_id,
            user_type: user.user_type
          })
          // Success - no notification, just show the user data in the UI
        } else {
          notify.error('Error', result.data?.message || 'User not found')
          setUserData(null)
        }
      } else {
        const error = await response.json()
        notify.error('Error', error.error || 'User not found')
        setUserData(null)
      }
    } catch (error) {
      notify.error('Error', 'Network error occurred')
      setUserData(null)
    } finally {
      setIsScanning(false)
    }
  }

  // Handle assign locker
  const handleAssignLocker = async () => {
    if (!userData || !selectedLockerNumber) {
      notify.error('Error', 'Please scan user and locker key')
      return
    }

    // Validate locker exists and is available
    const locker = lockers.find(l => l.locker_number === selectedLockerNumber)
    if (!locker) {
      notify.error('Error', `Locker ${selectedLockerNumber} not found`)
      return
    }
    if (locker.status !== 'AVAILABLE') {
      notify.error('Error', `Locker ${selectedLockerNumber} is ${locker.status}`)
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/locker-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: userData.user_id,
          locker_number: selectedLockerNumber,
          due_hours: systemSettings.grace_period_hours
        })
      })

      if (response.ok) {
        notify.success('Success', `Locker ${selectedLockerNumber} assigned to ${userData.full_name}`)
        setShowAssignModal(false)
        setUserData(null)
        setUserLookupInput('')
        setSelectedLockerNumber('')
        setLockerKeyInput('')
        setScannerInput('')
        onRefresh()
      } else {
        const error = await response.json()
        notify.error('Error', error.error || 'Failed to assign locker')
      }
    } catch (error) {
      notify.error('Error', 'Failed to assign locker')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get locker from scanner input
  // Smart lookup: tries both RFID and locker-number formats regardless of the
  // currently selected tab. If the locker has an RFID, the RFID match wins;
  // otherwise the locker-number match handles unbound lockers (e.g. "L-20").
  const getLockerFromInput = (input: string) => {
    if (!input.trim()) return null

    const trimmedInput = input.trim().toUpperCase()

    // 1) Try exact RFID match first
    const byRfid = lockers.find(l => l.rfid_code && l.rfid_code.toUpperCase() === trimmedInput)
    if (byRfid) return byRfid

    // 2) Try locker-number match in common formats: "L-20", "L20", "20"
    let lockerNum = ''
    if (trimmedInput.match(/L-\d+/)) {
      lockerNum = trimmedInput.match(/L-\d+/)?.[0] || ''
    } else if (trimmedInput.match(/^\d+$/)) {
      lockerNum = `L-${trimmedInput.padStart(2, '0')}`
    } else if (trimmedInput.match(/^L\d+$/)) {
      const num = trimmedInput.substring(1)
      lockerNum = `L-${num.padStart(2, '0')}`
    }

    if (lockerNum) {
      return lockers.find(l => l.locker_number === lockerNum) || null
    }

    return null
  }

  // Auto-switch the locker input mode based on whether the matched locker
  // is bound to an RFID. Bound -> RFID tab, unbound -> Manual tab.
  const syncLockerInputMode = (input: string) => {
    const locker = getLockerFromInput(input)
    if (!locker) return
    const hasRfid = !!locker.rfid_code
    if (hasRfid && lockerInputMode !== 'rfid') {
      setLockerInputMode('rfid')
    } else if (!hasRfid && lockerInputMode !== 'manual') {
      setLockerInputMode('manual')
    }
  }

  // Handle extend time
  const handleExtendTime = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scannerInput.trim()) {
      notify.error('Error', 'Please enter locker number')
      return
    }

    setIsSubmitting(true)
    try {
      const locker = getLockerFromInput(scannerInput)

      if (!locker) {
        notify.error('Error', 'Locker not found')
        setIsSubmitting(false)
        return
      }

      if (!locker.activeTransaction) {
        notify.error('Error', 'Locker is not currently occupied')
        setIsSubmitting(false)
        return
      }

      console.log('Extending time for locker:', locker.locker_number, 'transaction:', locker.activeTransaction.transaction_id)

      const response = await fetch(`/api/locker-transactions/${locker.activeTransaction.transaction_id}/extend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ hours: systemSettings.grace_period_hours })
      })

      const result = await response.json()
      console.log('Extend response:', response.status, result)

      if (response.ok) {
        notify.success('Success', result.message || 'Locker time extended by 2 hours')
        setShowExtendModal(false)
        setScannerInput('')
        onRefresh()
      } else {
        const message = result.error || result.message || 'Failed to extend time'
        // If extension limit is reached, show SweetAlert2 dialog
        if (message.includes('Maximum of')) {
          await Swal.fire({
            icon: 'warning',
            title: 'Extension Limit Reached',
            text: message,
            confirmButtonText: 'OK',
          })
        } else {
          notify.error('Error', message)
        }
      }
    } catch (error) {
      console.error('Extend time error:', error)
      notify.error('Error', 'Failed to extend locker time')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle return locker
  const handleReturnLocker = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scannerInput.trim()) return

    setIsSubmitting(true)
    try {
      const locker = getLockerFromInput(scannerInput)

      if (!locker) {
        notify.error('Error', 'Locker not found')
        return
      }

      if (!locker.activeTransaction) {
        notify.error('Error', 'Locker is not currently occupied')
        return
      }

      const response = await fetch(`/api/locker-transactions/${locker.activeTransaction.transaction_id}/return`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      })

      if (response.ok) {
        notify.success('Success', `Locker ${locker.locker_number} returned successfully`)
        setShowReturnModal(false)
        setScannerInput('')
        onRefresh()
      } else {
        const error = await response.json()
        notify.error('Error', error.error || 'Failed to process return')
      }
    } catch (error) {
      notify.error('Error', 'Failed to return locker')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className='px-6 py-4'>
      {/* Action Buttons */}
      <div className="flex justify-end gap-3 mb-4">
        <button 
          onClick={() => { setShowReturnModal(true); setScannerInput('') }}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
        >
          <i className="fas fa-undo"></i>
          Return Locker
        </button>
        <button 
          onClick={() => { setShowExtendModal(true); setScannerInput('') }}
          className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
        >
          <i className="fas fa-clock"></i>
          Extend Time
        </button>
        <button 
          onClick={() => { 
            setShowAssignModal(true); 
            setUserData(null); 
            setUserLookupInput(''); 
            setSelectedLockerNumber(''); 
            setLockerKeyInput('');
            setScannerInput('') 
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
        >
          <i className="fas fa-plus"></i>
          Assign Locker
        </button>
      </div>

      {/* Compact Status Summary */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total</p>
              <p className="text-2xl font-bold text-gray-800">{lockers.length}</p>
            </div>
            <i className="fas fa-archive text-blue-600 text-2xl"></i>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Available</p>
              <p className="text-2xl font-bold text-green-600">{availableCount}</p>
            </div>
            <i className="fas fa-check-circle text-green-500 text-2xl"></i>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Occupied</p>
              <p className="text-2xl font-bold text-red-600">{occupiedCount}</p>
            </div>
            <i className="fas fa-lock text-red-500 text-2xl"></i>
          </div>
        </div>
      </div>

      {/* Legend and Filter */}
      <div className="flex items-center justify-between mb-4">
        <div className='flex gap-4 items-center text-sm'>
          <div className='flex items-center gap-2'>
            <i className="fas fa-circle text-green-500"></i>
            <span className="text-gray-700">Available</span>
          </div>
          <div className='flex items-center gap-2'>
            <i className="fas fa-circle text-red-500"></i>
            <span className="text-gray-700">Occupied</span>
          </div>
          <div className='flex items-center gap-2'>
            <i className="fas fa-circle text-orange-500"></i>
            <span className="text-gray-700">Overtime</span>
          </div>
        </div>
        
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option>All Status</option>
          <option>Available</option>
          <option>Occupied</option>
        </select>
      </div>

      {/* Lockers Grid */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="grid grid-cols-8 gap-3 max-h-[calc(100vh-400px)] overflow-y-auto">
          {filteredLockers.map((locker: any) => {
            const status = calculateLockerStatus(locker)
            const isAvailable = locker.status === 'AVAILABLE'
            const isOvertime = status?.isOvertime || false
            
            return (
              <div
                key={locker.locker_id}
                onClick={() => {
                  setSelectedLockerForInfo(locker)
                  setShowLockerInfoModal(true)
                }}
                className={`relative p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md group ${
                  isAvailable 
                    ? 'border-green-300 bg-green-50 hover:border-green-400' 
                    : isOvertime 
                      ? 'border-orange-300 bg-orange-50 hover:border-orange-400'
                      : 'border-red-300 bg-red-50 hover:border-red-400'
                }`}
                title={isAvailable ? `${locker.locker_number} - Available (Click for details)` : `${locker.locker_number} - ${locker.activeTransaction?.user.full_name} (Click for details)`}
              >
                {/* Locker Number */}
                <div className="text-center">
                  <div className={`w-10 h-10 mx-auto rounded-lg flex items-center justify-center text-sm font-bold mb-2 ${
                    isAvailable ? 'bg-green-600 text-white' 
                      : isOvertime ? 'bg-orange-500 text-white'
                      : 'bg-red-500 text-white'
                  }`}>
                    {locker.locker_number.replace('L-', '')}
                  </div>
                  
                  {/* Time info */}
                  {!isAvailable && status && isClient && (
                    <div className="text-xs text-gray-600">
                      <div className="font-mono">{status?.timeUsedFormatted}</div>
                      {status.fine > 0 && (
                        <div className="text-orange-600 font-medium">₱{status.fine.toFixed(2)}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Status Icon */}
                <i className={`absolute top-2 right-2 text-xs ${
                  isAvailable ? 'fas fa-check-circle text-green-500' 
                    : isOvertime ? 'fas fa-exclamation-circle text-orange-500'
                    : 'fas fa-lock text-red-500'
                }`}></i>

                {/* Hover Details */}
                {!isAvailable && locker.activeTransaction && isClient && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded-lg p-3 whitespace-nowrap z-10 pointer-events-none shadow-lg">
                    <div className="space-y-1">
                      <div className="font-medium">{locker.activeTransaction.user.full_name}</div>
                      <div>ID: {locker.activeTransaction.user.account_id}</div>
                      <div>Used: <span className="font-mono">{status?.timeUsedFormatted}</span></div>
                      {status && status.fine > 0 && (
                        <div className="text-orange-300 font-medium">Fine: ₱{status.fine.toFixed(2)}</div>
                      )}
                    </div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Assign Locker Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-3xl w-full mx-4">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <i className="fas fa-user-plus text-blue-600"></i>
              Assign Locker
            </h3>

            <div className="grid grid-cols-2 gap-6">
              {/* Step 1: User Lookup */}
              <div className="border-r pr-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">1. Find User</h4>
                  <div className="flex gap-1 bg-gray-100 rounded p-1">
                    <button
                      type="button"
                      onClick={() => setUserInputMode('rfid')}
                      className={`px-3 py-1 text-xs rounded transition-colors ${userInputMode === 'rfid' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
                    >
                      <i className="fas fa-id-card mr-1"></i>
                      RFID
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserInputMode('manual')}
                      className={`px-3 py-1 text-xs rounded transition-colors ${userInputMode === 'manual' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
                    >
                      <i className="fas fa-keyboard mr-1"></i>
                      Manual
                    </button>
                  </div>
                </div>
                <form onSubmit={handleUserLookup} className="space-y-3">
                  <input
                    type="text"
                    value={userLookupInput}
                    onChange={(e) => setUserLookupInput(e.target.value)}
                    placeholder={userInputMode === 'rfid' ? 'Scan user RFID card...' : 'Enter user ID number...'}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={isScanning}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors disabled:opacity-50"
                  >
                    {isScanning ? 'Searching...' : 'Find User'}
                  </button>
                </form>

                {userData && (
                  <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-sm space-y-1">
                      <div><strong>Name:</strong> {userData.full_name}</div>
                      <div><strong>ID:</strong> {userData.account_id}</div>
                      <div><strong>Type:</strong> {userData.user_type}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Locker Key */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">2. Select Locker</h4>
                  <div className="flex gap-1 bg-gray-100 rounded p-1">
                    <button
                      type="button"
                      onClick={() => setLockerInputMode('rfid')}
                      className={`px-3 py-1 text-xs rounded transition-colors ${lockerInputMode === 'rfid' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
                    >
                      <i className="fas fa-wifi mr-1"></i>
                      RFID
                    </button>
                    <button
                      type="button"
                      onClick={() => setLockerInputMode('manual')}
                      className={`px-3 py-1 text-xs rounded transition-colors ${lockerInputMode === 'manual' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
                    >
                      <i className="fas fa-keyboard mr-1"></i>
                      Manual
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={lockerKeyInput}
                  onChange={(e) => {
                    const input = e.target.value.trim().toUpperCase()
                    setLockerKeyInput(input)
                    
                    if (lockerInputMode === 'rfid') {
                      // RFID mode - find locker by rfid_code
                      const locker = lockers.find(l => l.rfid_code === input)
                      setSelectedLockerNumber(locker?.locker_number || '')
                    } else {
                      // Manual mode - try to extract locker number from various formats
                      let lockerNum = ''
                      
                      // Check if it already has L- prefix
                      if (input.match(/L-\d+/)) {
                        lockerNum = input.match(/L-\d+/)?.[0] || ''
                      } 
                      // If just a number, add L- prefix
                      else if (input.match(/^\d+$/)) {
                        lockerNum = `L-${input.padStart(2, '0')}`
                      }
                      // If format is like "L01" without dash
                      else if (input.match(/^L\d+$/)) {
                        const num = input.substring(1)
                        lockerNum = `L-${num.padStart(2, '0')}`
                      }
                      
                      setSelectedLockerNumber(lockerNum)
                    }
                  }}
                  placeholder={lockerInputMode === 'rfid' ? 'Scan locker RFID key...' : 'Enter locker number (e.g., L-01 or 1)...'}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                  disabled={!userData}
                />

                {lockerKeyInput && (() => {
                  const locker = lockers.find(l => l.locker_number === selectedLockerNumber)
                  const isAvailable = locker?.status === 'AVAILABLE'
                  
                  if (!locker || !selectedLockerNumber) {
                    return (
                      <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="text-sm text-red-700">
                          <i className="fas fa-times-circle mr-1"></i>
                          {lockerInputMode === 'rfid' 
                            ? 'Locker with this RFID not found' 
                            : `Locker ${selectedLockerNumber || 'not found'}`}
                        </div>
                      </div>
                    )
                  }
                  
                  if (!isAvailable) {
                    return (
                      <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div className="text-sm text-yellow-700">
                          <i className="fas fa-exclamation-circle mr-1"></i>
                          Locker <strong>{selectedLockerNumber}</strong> is currently <strong>{locker.status}</strong>
                        </div>
                      </div>
                    )
                  }
                  
                  return (
                    <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="text-sm">
                        <div className="flex items-center gap-2 text-green-700">
                          <i className="fas fa-check-circle"></i>
                          <strong>Locker:</strong> <span className="font-bold">{selectedLockerNumber}</span>
                          <span className="text-xs bg-green-100 px-2 py-0.5 rounded">Available</span>
                        </div>
                        <div className="text-gray-700 mt-2"><strong>User:</strong> {userData?.full_name}</div>
                        <div className="text-xs text-gray-600 mt-1">Duration: {systemSettings.grace_period_hours} hours (default)</div>
                      </div>
                    </div>
                  )
                })()}

                {lockerKeyInput && !selectedLockerNumber && lockerInputMode === 'manual' && (
                  <div className="mt-2 text-xs text-red-600">
                    <i className="fas fa-exclamation-triangle mr-1"></i>
                    Invalid locker format. Use L-01, L01, or just 1
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAssignModal(false)
                  setUserData(null)
                  setUserLookupInput('')
                  setSelectedLockerNumber('')
                  setLockerKeyInput('')
                }}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignLocker}
                disabled={!userData || !selectedLockerNumber || isSubmitting || !lockers.find(l => l.locker_number === selectedLockerNumber && l.status === 'AVAILABLE')}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors disabled:opacity-50"
                title={
                  !userData ? 'Please find user first' : 
                  !selectedLockerNumber ? 'Please enter locker number' : 
                  !lockers.find(l => l.locker_number === selectedLockerNumber) ? 'Locker not found' :
                  !lockers.find(l => l.locker_number === selectedLockerNumber && l.status === 'AVAILABLE') ? 'Locker not available' :
                  'Click to assign locker'
                }
              >
                {isSubmitting ? 'Assigning...' : 'Assign Locker'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extend Time Modal */}
      {showExtendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <i className="fas fa-clock text-orange-600"></i>
              Extend Locker Time
            </h3>

            <form onSubmit={handleExtendTime} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Find Locker
                  </label>
                  <div className="flex gap-1 bg-gray-100 rounded p-1">
                    <button
                      type="button"
                      onClick={() => setLockerInputMode('rfid')}
                      className={`px-3 py-1 text-xs rounded transition-colors ${lockerInputMode === 'rfid' ? 'bg-orange-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
                    >
                      <i className="fas fa-wifi mr-1"></i>
                      RFID
                    </button>
                    <button
                      type="button"
                      onClick={() => setLockerInputMode('manual')}
                      className={`px-3 py-1 text-xs rounded transition-colors ${lockerInputMode === 'manual' ? 'bg-orange-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
                    >
                      <i className="fas fa-keyboard mr-1"></i>
                      Manual
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={scannerInput}
                  onChange={(e) => {
                    setScannerInput(e.target.value)
                    syncLockerInputMode(e.target.value)
                  }}
                  placeholder={lockerInputMode === 'rfid' ? 'Scan locker RFID key...' : 'Enter locker number (e.g., L-01 or 1)...'}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 outline-none"
                  autoFocus
                />
              </div>

              {scannerInput && (() => {
                const locker = getLockerFromInput(scannerInput)
                const status = locker ? calculateLockerStatus(locker) : null
                
                if (!locker) {
                  return (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="text-sm text-red-700">
                        <i className="fas fa-times-circle mr-1"></i>
                        Locker not found
                      </div>
                    </div>
                  )
                }
                
                if (!locker.activeTransaction) {
                  return (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="text-sm text-yellow-700">
                        <i className="fas fa-exclamation-circle mr-1"></i>
                        Locker <strong>{locker.locker_number}</strong> is not currently occupied
                      </div>
                    </div>
                  )
                }
                
                return (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-sm space-y-2">
                      <div className="flex items-center gap-2 text-green-700 font-medium">
                        <i className="fas fa-check-circle"></i>
                        Locker {locker.locker_number}
                      </div>
                      <div className="text-gray-700">
                        <strong>User:</strong> {locker.activeTransaction.user.full_name}
                      </div>
                      <div className="text-gray-700">
                        <strong>ID:</strong> {locker.activeTransaction.user.account_id}
                      </div>
                      {status && (
                        <>
                          <div className="text-gray-700">
                            <strong>Time Used:</strong> <span className="font-mono">{status.timeUsedFormatted}</span>
                          </div>
                          {locker.activeTransaction?.penalty > 0 && (
                            <div className="text-orange-600 font-medium">
                              <i className="fas fa-exclamation-triangle mr-1"></i>
                              Fine: ₱{Number(locker.activeTransaction.penalty).toFixed(2)}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })()}

              <div className="space-y-2">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                  <i className="fas fa-info-circle mr-2"></i>
                  Extension will add {systemSettings.grace_period_hours} hours to the due time
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                  <div className="font-medium mb-1">
                    <i className="fas fa-coins mr-1"></i>
                    Penalty Information:
                  </div>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>First {systemSettings.grace_period_hours}h {systemSettings.grace_period_minutes || 0}m: <strong>FREE</strong></li>
                    <li>Once grace period is exceeded: <strong>₱{systemSettings.locker_fine_per_hour} immediately</strong> (any overrun counts as the first hour)</li>
                    <li>Every started hour after that: <strong>+₱{systemSettings.locker_fine_per_hour}</strong></li>
                    <li>Extending within grace period resets penalty to ₱0</li>
                    <li>Extending after grace period preserves existing penalty</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowExtendModal(false); setScannerInput('') }}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !scannerInput.trim()}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Processing...' : 'Extend Time'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Locker Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <i className="fas fa-undo text-red-600"></i>
              Return Locker
            </h3>

            <form onSubmit={handleReturnLocker} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Find Locker
                  </label>
                  <div className="flex gap-1 bg-gray-100 rounded p-1">
                    <button
                      type="button"
                      onClick={() => setLockerInputMode('rfid')}
                      className={`px-3 py-1 text-xs rounded transition-colors ${lockerInputMode === 'rfid' ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
                    >
                      <i className="fas fa-wifi mr-1"></i>
                      RFID
                    </button>
                    <button
                      type="button"
                      onClick={() => setLockerInputMode('manual')}
                      className={`px-3 py-1 text-xs rounded transition-colors ${lockerInputMode === 'manual' ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
                    >
                      <i className="fas fa-keyboard mr-1"></i>
                      Manual
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={scannerInput}
                  onChange={(e) => {
                    setScannerInput(e.target.value)
                    syncLockerInputMode(e.target.value)
                  }}
                  placeholder={lockerInputMode === 'rfid' ? 'Scan locker RFID key...' : 'Enter locker number (e.g., L-01 or 1)...'}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-red-500 outline-none"
                  autoFocus
                />
              </div>

              {scannerInput && (() => {
                const locker = getLockerFromInput(scannerInput)
                const status = locker ? calculateLockerStatus(locker) : null
                
                if (!locker) {
                  return (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="text-sm text-red-700">
                        <i className="fas fa-times-circle mr-1"></i>
                        Locker not found
                      </div>
                    </div>
                  )
                }
                
                if (!locker.activeTransaction) {
                  return (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="text-sm text-yellow-700">
                        <i className="fas fa-exclamation-circle mr-1"></i>
                        Locker <strong>{locker.locker_number}</strong> is already available
                      </div>
                    </div>
                  )
                }
                
                return (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-sm space-y-2">
                      <div className="flex items-center gap-2 text-green-700 font-medium">
                        <i className="fas fa-check-circle"></i>
                        Locker {locker.locker_number}
                      </div>
                      <div className="text-gray-700">
                        <strong>User:</strong> {locker.activeTransaction.user.full_name}
                      </div>
                      <div className="text-gray-700">
                        <strong>ID:</strong> {locker.activeTransaction.user.account_id}
                      </div>
                      {status && (
                        <>
                          <div className="text-gray-700">
                            <strong>Time Used:</strong> <span className="font-mono">{status.timeUsedFormatted}</span>
                          </div>
                          {status.dueTime && (
                            <div className="text-gray-600 text-xs">
                              <strong>Due:</strong> {new Date(status.dueTime).toLocaleTimeString()}
                            </div>
                          )}
                          {status.isOvertime && (
                            <div className="bg-red-100 border border-red-300 rounded p-2 text-red-700 font-medium">
                              <i className="fas fa-exclamation-triangle mr-1"></i>
                              Overdue! Penalty: ₱{status.fine.toFixed(2)}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })()}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowReturnModal(false); setScannerInput('') }}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !scannerInput.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Processing...' : 'Process Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Locker Info Modal */}
      {showLockerInfoModal && selectedLockerForInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <i className={`fas fa-box ${selectedLockerForInfo.status === 'AVAILABLE' ? 'text-green-600' : 'text-red-600'}`}></i>
                Locker {selectedLockerForInfo.locker_number}
              </h3>
              <button
                onClick={() => {
                  setShowLockerInfoModal(false)
                  setSelectedLockerForInfo(null)
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <div className="space-y-4">
              {/* Status Badge */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Status:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedLockerForInfo.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' :
                  selectedLockerForInfo.status === 'OCCUPIED' ? 'bg-red-100 text-red-700' :
                  selectedLockerForInfo.status === 'DAMAGED' ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  <i className={`fas ${
                    selectedLockerForInfo.status === 'AVAILABLE' ? 'fa-check-circle' :
                    selectedLockerForInfo.status === 'OCCUPIED' ? 'fa-lock' :
                    'fa-exclamation-triangle'
                  } mr-1`}></i>
                  {selectedLockerForInfo.status}
                </span>
              </div>

              {/* Location */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Location:</span>
                <span className="text-sm font-medium">{selectedLockerForInfo.location}</span>
              </div>

              {/* RFID Code */}
              {selectedLockerForInfo.rfid_code && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">RFID Code:</span>
                  <span className="text-sm font-mono bg-blue-50 px-2 py-1 rounded border border-blue-200">
                    {selectedLockerForInfo.rfid_code}
                  </span>
                </div>
              )}

              {/* If occupied, show user details */}
              {selectedLockerForInfo.activeTransaction && (() => {
                const status = calculateLockerStatus(selectedLockerForInfo)
                const borrowTime = new Date(selectedLockerForInfo.activeTransaction.borrow_time)
                const dueTime = selectedLockerForInfo.activeTransaction.due_time 
                  ? new Date(selectedLockerForInfo.activeTransaction.due_time)
                  : null

                return (
                  <div className="border-t pt-4 space-y-3">
                    <h4 className="font-medium text-gray-800 flex items-center gap-2">
                      <i className="fas fa-user text-blue-600"></i>
                      Current User
                    </h4>

                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Name:</span>
                        <span className="text-sm font-medium">{selectedLockerForInfo.activeTransaction.user.full_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">ID:</span>
                        <span className="text-sm font-medium">{selectedLockerForInfo.activeTransaction.user.account_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">User Type:</span>
                        <span className="text-sm font-medium">{selectedLockerForInfo.activeTransaction.user.user_type}</span>
                      </div>
                    </div>

                    <div className="border-t pt-3 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Borrow Time:</span>
                        <span className="text-sm font-medium">{formatDateTime(borrowTime)}</span>
                      </div>
                      {dueTime && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Due Time:</span>
                          <span className="text-sm font-medium">{formatDateTime(dueTime)}</span>
                        </div>
                      )}
                      {status && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Time Used:</span>
                            <span className="text-sm font-mono font-medium">{status.timeUsedFormatted}</span>
                          </div>
                          {status.isOvertime && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Exceeded Time:</span>
                              <span className="text-sm font-mono font-medium text-red-600">{status.exceededFormatted}</span>
                            </div>
                          )}
                          {status.fine > 0 ? (
                            <div className="flex justify-between items-center bg-red-50 border border-red-200 rounded p-2">
                              <span className="text-sm text-red-700 font-medium">
                                <i className="fas fa-exclamation-triangle mr-1"></i>
                                Current Penalty:
                              </span>
                              <span className="text-sm font-bold text-red-700">₱{status.fine.toFixed(2)}</span>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center bg-green-50 border border-green-200 rounded p-2">
                              <span className="text-sm text-green-700 font-medium">
                                <i className="fas fa-check-circle mr-1"></i>
                                Penalty:
                              </span>
                              <span className="text-sm font-bold text-green-700">₱0.00</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Quick Actions */}
                    <div className="border-t pt-3">
                      <p className="text-xs text-gray-500 mb-2">Quick Actions:</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setShowLockerInfoModal(false)
                            setShowExtendModal(true)
                            setScannerInput(selectedLockerForInfo.locker_number)
                          }}
                          className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded text-sm transition-colors"
                        >
                          <i className="fas fa-clock mr-1"></i>
                          Extend Time
                        </button>
                        <button
                          onClick={() => {
                            setShowLockerInfoModal(false)
                            setShowReturnModal(true)
                            setScannerInput(selectedLockerForInfo.locker_number)
                          }}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm transition-colors"
                        >
                          <i className="fas fa-undo mr-1"></i>
                          Return Locker
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* If available */}
              {!selectedLockerForInfo.activeTransaction && (
                <div className="border-t pt-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <i className="fas fa-check-circle text-green-600 text-2xl mb-2"></i>
                    <p className="text-sm text-green-700">This locker is available for assignment</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowLockerInfoModal(false)
                      setShowAssignModal(true)
                      setLockerKeyInput(selectedLockerForInfo.locker_number)
                      setSelectedLockerNumber(selectedLockerForInfo.locker_number)
                    }}
                    className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
                  >
                    <i className="fas fa-plus mr-2"></i>
                    Assign This Locker
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t">
              <button
                onClick={() => {
                  setShowLockerInfoModal(false)
                  setSelectedLockerForInfo(null)
                }}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StaffView
