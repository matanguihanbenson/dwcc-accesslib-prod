'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { notify } from '@/lib/notification'
import type { Holiday } from '@/types'

export default function HolidaysPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [authReady, setAuthReady] = useState(false)

  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(false)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString())
  const [showModal, setShowModal] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    end_date: '',
    description: '',
    is_recurring: false,
    start_time: '',
    end_time: ''
  })

  // Auth check
  useEffect(() => {
    if (status === 'loading') return

    if (status === 'authenticated' && session?.user) {
      const userRole = (session.user as any).role
      if (!['SUPER_ADMIN', 'ADMIN'].includes(userRole)) {
        router.push('/dashboard')
        return
      }
      setAuthReady(true)
    } else {
      router.push('/login')
    }
  }, [session, status, router])

  useEffect(() => {
    if (authReady) {
      fetchHolidays()
    }
  }, [authReady, filterYear])

  const fetchHolidays = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/holidays?year=${filterYear}&active_only=true`, {
        credentials: 'include'
      })

      if (response.ok) {
        const result = await response.json()
        setHolidays(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching holidays:', error)
      await notify.error('Error', 'Failed to load holidays')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.date) {
      await notify.error('Validation Error', 'Name and date are required')
      return
    }

    // Validate time format if provided
    if (formData.start_time && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(formData.start_time)) {
      await notify.error('Validation Error', 'Start time must be in HH:MM format (e.g., 08:00)')
      return
    }

    if (formData.end_time && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(formData.end_time)) {
      await notify.error('Validation Error', 'End time must be in HH:MM format (e.g., 17:00)')
      return
    }

    try {
      const url = editingHoliday 
        ? `/api/holidays/${editingHoliday.holiday_id}`
        : '/api/holidays'
      
      const method = editingHoliday ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (response.ok) {
        await notify.success('Success', result.message || 'Holiday saved successfully')
        setShowModal(false)
        resetForm()
        fetchHolidays()
      } else {
        await notify.error('Error', result.error || 'Failed to save holiday')
      }
    } catch (error) {
      console.error('Error saving holiday:', error)
      await notify.error('Error', 'Network error occurred')
    }
  }

  const handleEdit = (holiday: Holiday) => {
    setEditingHoliday(holiday)
    setFormData({
      name: holiday.name,
      date: new Date(holiday.date).toISOString().split('T')[0],
      end_date: holiday.end_date ? new Date(holiday.end_date).toISOString().split('T')[0] : '',
      description: holiday.description || '',
      is_recurring: holiday.is_recurring,
      start_time: holiday.start_time || '',
      end_time: holiday.end_time || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/holidays/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (response.ok) {
        await notify.success('Success', 'Holiday deleted successfully')
        setDeleteConfirm(null)
        fetchHolidays()
      } else {
        const result = await response.json()
        await notify.error('Error', result.error || 'Failed to delete holiday')
      }
    } catch (error) {
      console.error('Error deleting holiday:', error)
      await notify.error('Error', 'Network error occurred')
    }
  }

  const handleApplyRecurring = async () => {
    const year = parseInt(filterYear)
    
    if (window.confirm(`Apply all recurring holidays to year ${year}? This will create new holiday entries for each recurring holiday.`)) {
      try {
        const response = await fetch('/api/holidays/recurring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ year })
        })

        const result = await response.json()

        if (response.ok) {
          await notify.success('Success', result.message || 'Recurring holidays applied')
          fetchHolidays()
        } else {
          await notify.error('Error', result.error || 'Failed to apply recurring holidays')
        }
      } catch (error) {
        console.error('Error applying recurring holidays:', error)
        await notify.error('Error', 'Network error occurred')
      }
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      date: '',
      end_date: '',
      description: '',
      is_recurring: false,
      start_time: '',
      end_time: ''
    })
    setEditingHoliday(null)
  }

  const handleModalClose = () => {
    setShowModal(false)
    resetForm()
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

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    })
  }

  const formatTime = (time: string) => {
    if (!time) return null
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  const isPastDate = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return new Date(date) < today
  }

  return (
    <>
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-800">Holiday Management</h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage library holidays and closures
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={handleApplyRecurring}
                className="bg-primary-50 hover:bg-primary-200 text-primary-600 py-5 px-4"
              >
                <i className="fas fa-sync mr-2"></i>
                Apply Recurring to {filterYear}
              </Button>
              <Button
                onClick={() => {
                  resetForm()
                  setShowModal(true)
                }}
                className="bg-primary-600 hover:bg-blue-700 px-4 py-5 text-white"
              >
                <i className="fas fa-plus mr-2"></i>
                Add Holiday
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="py-4">
        {/* Filter */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Year
                </label>
                <Input
                  type="number"
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  min="2000"
                  max="2100"
                  className="w-48"
                />
              </div>
              <div className="text-sm text-gray-600 mt-6">
                Showing {holidays.length} holiday(s) for {filterYear}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Holidays Table */}
        <Card>
          <CardHeader>
            <CardTitle>Holidays</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <div className="text-sm text-gray-600">Loading holidays...</div>
              </div>
            ) : holidays.length === 0 ? (
              <div className="text-center py-12">
                <i className="fas fa-calendar-times text-6xl text-gray-300 mb-4"></i>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Holidays</h3>
                <p className="text-gray-600 mb-6">
                  No holidays found for {filterYear}. Add a new holiday to get started.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Holiday Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Hours
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Description
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {holidays.map((holiday) => (
                      <tr key={holiday.holiday_id} className={isPastDate(holiday.date) ? 'bg-gray-50' : ''}>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <i className="fas fa-calendar-times text-red-500 mr-3"></i>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {holiday.name}
                              </div>
                              {isPastDate(holiday.date) && (
                                <div className="text-xs text-gray-500">
                                  <i className="fas fa-history mr-1"></i>
                                  Past date
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatDate(holiday.date)}
                            {holiday.end_date && new Date(holiday.end_date).getTime() !== new Date(holiday.date).getTime() && (
                              <div className="text-xs text-gray-600 mt-1">
                                <i className="fas fa-arrow-right mr-1"></i>
                                {formatDate(holiday.end_date)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {holiday.start_time || holiday.end_time ? (
                            <div className="text-sm text-gray-900">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                <i className="fas fa-clock mr-1"></i>
                                {holiday.start_time && formatTime(holiday.start_time)} - {holiday.end_time && formatTime(holiday.end_time)}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <i className="fas fa-ban mr-1"></i>
                              Full Day Closed
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {holiday.is_recurring ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              <i className="fas fa-sync mr-1"></i>
                              Recurring
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              One-time
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-700 max-w-xs truncate">
                            {holiday.description || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {deleteConfirm === holiday.holiday_id ? (
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleDelete(holiday.holiday_id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end space-x-3">
                              <button
                                onClick={() => handleEdit(holiday)}
                                className="bg-primary-600 hover:bg-primary-700 text-white px-3 rounded-md py-2"
                                title="Edit"
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(holiday.holiday_id)}
                                className="border-2 rounded-md !border-red-600 px-3 hover:text-red-600 py-2"
                                title="Delete"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                              {/*  , */}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}
                </h2>
                <button
                  onClick={handleModalClose}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Holiday Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Christmas Day, Independence Day"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                    {formData.date && isPastDate(new Date(formData.date)) && (
                      <p className="mt-1 text-sm text-yellow-600">
                        <i className="fas fa-exclamation-triangle mr-1"></i>
                        Warning: This date is in the past
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date (Optional)
                    </label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      min={formData.date}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Leave empty for single-day holiday
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Optional description or notes"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time (Optional)
                    </label>
                    <Input
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      placeholder="HH:MM"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Leave empty for full-day closure
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Time (Optional)
                    </label>
                    <Input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      placeholder="HH:MM"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Partial closure hours
                    </p>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_recurring"
                    checked={formData.is_recurring}
                    onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <label htmlFor="is_recurring" className="ml-2 block text-sm text-gray-700">
                    Recurring Holiday (applies yearly)
                  </label>
                </div>

                {formData.is_recurring && (
                  <div className="bg-purple-50 border border-purple-200 rounded-md p-4">
                    <div className="flex">
                      <i className="fas fa-info-circle text-purple-600 mt-0.5 mr-3"></i>
                      <div className="text-sm text-purple-700">
                        <p className="font-medium mb-1">Recurring Holiday</p>
                        <p>
                          This holiday will be available to apply to future years automatically. 
                          Use &quot;Apply Recurring to Year&quot; button to create copies for specific years.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleModalClose}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {editingHoliday ? 'Update Holiday' : 'Add Holiday'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
