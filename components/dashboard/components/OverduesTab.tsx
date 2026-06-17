'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PieChart } from '@/components/charts'
import { transformOverdueDataForChart } from '@/services/chartService'
import SendOverdueNotificationModal from '@/components/modals/SendOverdueNotificationModal'

interface OverdueData {
  totalOverdue: number
  overdueBooks: number
  overdueLockers: number
  totalFines: number
  oldestOverdue: string
  averageOverdueDays: number
}

interface OverduesTabProps {
  overdueData: OverdueData
  userEmail?: string | null
}

function OverduesTab({ overdueData, userEmail }: OverduesTabProps): React.ReactElement {
  const router = useRouter()
  const chartData = transformOverdueDataForChart(overdueData)
  const [showNotificationModal, setShowNotificationModal] = useState(false)
  const [overdueItems, setOverdueItems] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Fetch overdue items for notifications
  const fetchOverdueItems = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/overdue?type=all', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      if (response.ok) {
        const data = await response.json()
        setOverdueItems(data)
      }
    } catch (error) {
      console.error('Error fetching overdue items:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSendNotifications = async () => {
    await fetchOverdueItems()
    setShowNotificationModal(true)
  }

  const handleViewOverdueList = () => {
    router.push('/overdue')
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Overdue Items Analytics</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">Total Overdue</p>
              <p className="text-2xl font-bold text-red-800">{overdueData.totalOverdue}</p>
            </div>
            <i className="fas fa-exclamation-triangle text-red-500 text-xl"></i>
          </div>
        </div>

        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">Overdue Books</p>
              <p className="text-2xl font-bold text-orange-800">{overdueData.overdueBooks}</p>
            </div>
            <i className="fas fa-book text-orange-500 text-xl"></i>
          </div>
        </div>

        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-600">Overdue Lockers</p>
              <p className="text-2xl font-bold text-yellow-800">{overdueData.overdueLockers}</p>
            </div>
            <i className="fas fa-archive text-yellow-500 text-xl"></i>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <h4 className="text-base font-semibold text-gray-800 mb-4">Overdue Statistics</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Total Fines</span>
              <span className="text-sm font-semibold text-gray-900">₱{overdueData.totalFines.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Oldest Overdue</span>
              <span className="text-sm font-semibold text-gray-900">
                {overdueData.oldestOverdue === 'None' || overdueData.oldestOverdue === 'N/A' || overdueData.oldestOverdue === 'Loading...'
                  ? '—' 
                  : overdueData.oldestOverdue}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">Average Days Overdue</span>
              <span className="text-sm font-semibold text-gray-900">{overdueData.averageOverdueDays} days</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-800 mb-4">Overdue Actions</h4>
          <div className="space-y-2">
            <button 
              onClick={handleSendNotifications}
              disabled={loading || overdueData.totalOverdue === 0}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Loading...
                </>
              ) : (
                <>
                  <i className="fas fa-envelope"></i>
                  Send Overdue Notifications
                </>
              )}
            </button>
            <button 
              onClick={() => router.push('/reports')}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 px-3 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <i className="fas fa-file-alt"></i>
              Generate Fine Reports
            </button>
            <button 
              onClick={handleViewOverdueList}
              className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-3 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <i className="fas fa-list"></i>
              View Overdue List
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-800 mb-4">Overdue Items Breakdown</h4>
        <div className="flex flex-col md:flex-row items-center">
          <div className="w-full md:w-1/2">
            <PieChart
              data={chartData}
              height={250}
              showLegend={false}
              outerRadius={80}
            />
          </div>
          <div className="w-full md:w-1/2 mt-4 md:mt-0 md:ml-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded border border-amber-200">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-amber-500 rounded"></div>
                  <span className="font-medium text-amber-800">Overdue Books</span>
                </div>
                <span className="text-xl font-bold text-amber-800">{overdueData.overdueBooks}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 rounded border border-red-200">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span className="font-medium text-red-800">Overdue Lockers</span>
                </div>
                <span className="text-xl font-bold text-red-800">{overdueData.overdueLockers}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Modal */}
      {overdueItems && (
        <SendOverdueNotificationModal
          isOpen={showNotificationModal}
          onClose={() => setShowNotificationModal(false)}
          overdueBooks={overdueItems.overdue_books || []}
          overdueLockers={overdueItems.overdue_lockers || []}
          userEmail={userEmail}
        />
      )}
    </div>
  )
}

export default OverduesTab
