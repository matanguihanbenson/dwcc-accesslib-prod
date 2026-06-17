'use client'

import React from 'react'
import { PieChart } from '@/components/charts'
import { transformLockerDataForChart, calculatePercentage } from '@/services/chartService'

interface LockerUsageData {
  totalLockers: number
  occupiedLockers: number
  availableLockers: number
  averageUsageTime: string
  mostUsedLocker: string
  utilizationRate: number
}

interface LockerUsageTabProps {
  lockerUsageData: LockerUsageData
}

function LockerUsageTab({ lockerUsageData }: LockerUsageTabProps): React.ReactElement {
  const chartData = transformLockerDataForChart(lockerUsageData)

  const occupiedPercentage = calculatePercentage(lockerUsageData.occupiedLockers, lockerUsageData.totalLockers)
  const availablePercentage = calculatePercentage(lockerUsageData.availableLockers, lockerUsageData.totalLockers)

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Locker Usage Analytics</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">Total Lockers</p>
              <p className="text-2xl font-bold text-orange-800">{lockerUsageData.totalLockers}</p>
            </div>
            <i className="fas fa-archive text-orange-500 text-xl"></i>
          </div>
        </div>

        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">Occupied</p>
              <p className="text-2xl font-bold text-red-800">{lockerUsageData.occupiedLockers}</p>
            </div>
            <i className="fas fa-lock text-red-500 text-xl"></i>
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Available</p>
              <p className="text-2xl font-bold text-green-800">{lockerUsageData.availableLockers}</p>
            </div>
            <i className="fas fa-unlock text-green-500 text-xl"></i>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <h4 className="text-base font-semibold text-gray-800 mb-4">Usage Statistics</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Average Usage Time</span>
              <span className="text-sm font-semibold text-gray-900">
                {lockerUsageData.averageUsageTime === 'N/A' || lockerUsageData.averageUsageTime === 'Loading...' 
                  ? '—' 
                  : lockerUsageData.averageUsageTime}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Most Used Locker</span>
              <span className="text-sm font-semibold text-gray-900">
                {lockerUsageData.mostUsedLocker === 'N/A' || lockerUsageData.mostUsedLocker === 'Loading...' || lockerUsageData.mostUsedLocker.includes('#N/A')
                  ? '—' 
                  : lockerUsageData.mostUsedLocker}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">Utilization Rate</span>
              <span className="text-sm font-semibold text-gray-900">{lockerUsageData.utilizationRate}%</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-800 mb-4">Utilization Chart</h4>
          <div className="h-64">
            <PieChart
              data={chartData}
              height={200}
              outerRadius={70}
            />
          </div>
          
          <div className="mt-2 flex justify-center space-x-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span>Occupied ({occupiedPercentage}%)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>Available ({availablePercentage}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LockerUsageTab
