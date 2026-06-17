'use client'

import React, { useState } from 'react'
import { LineChart, BarChart, AreaChart } from '@/components/charts'
import { getTimePeriodData } from '@/services/chartService'

interface UserEntryData {
  totalToday: number
  totalThisWeek: number
  totalThisMonth: number
  uniqueUsersToday: number
  uniqueUsersWeek: number
  uniqueUsersMonth: number
  peakHour: string
  trend: 'up' | 'down' | 'stable'
}

interface ChartData {
  day: Array<{ name: string; entries: number; unique: number }>
  week: Array<{ name: string; entries: number; unique: number }>
  month: Array<{ name: string; entries: number; unique: number }>
  year: Array<{ name: string; entries: number; unique: number }>
}

interface UserEntryTabProps {
  userEntryData: UserEntryData
  chartData: ChartData
}

function UserEntryTab({ userEntryData, chartData }: UserEntryTabProps): React.ReactElement {
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'year'>('week')
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('area')

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <i className="fas fa-arrow-up text-green-500"></i>
      case 'down':
        return <i className="fas fa-arrow-down text-red-500"></i>
      default:
        return <i className="fas fa-minus text-gray-500"></i>
    }
  }

  const currentChartData = getTimePeriodData(chartData, selectedPeriod)

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">User Entry Analytics</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Today</p>
              <p className="text-2xl font-bold text-blue-800">{userEntryData.totalToday}</p>
              <p className="text-xs text-blue-600">Unique: {userEntryData.uniqueUsersToday}</p>
            </div>
            <div className="text-blue-500">
              {getTrendIcon(userEntryData.trend)}
            </div>
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">This Week</p>
              <p className="text-2xl font-bold text-green-800">{userEntryData.totalThisWeek}</p>
              <p className="text-xs text-green-600">Unique: {userEntryData.uniqueUsersWeek}</p>
            </div>
            <i className="fas fa-calendar-week text-green-500 text-xl"></i>
          </div>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">This Month</p>
              <p className="text-2xl font-bold text-purple-800">{userEntryData.totalThisMonth}</p>
              <p className="text-xs text-purple-600">Unique: {userEntryData.uniqueUsersMonth}</p>
            </div>
            <i className="fas fa-calendar-alt text-purple-500 text-xl"></i>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-800 mb-2">Peak Usage</h4>
        <p className="text-gray-600">
          <i className="fas fa-clock mr-2"></i>
          Peak hour: <span className="font-medium">{userEntryData.peakHour}</span>
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-800">Entry Trends Chart</h4>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Period:</span>
              <select 
                value={selectedPeriod} 
                onChange={(e) => setSelectedPeriod(e.target.value as 'day' | 'week' | 'month' | 'year')}
                className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="day">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => setChartType('area')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  chartType === 'area' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                <i className="fas fa-chart-area mr-1"></i>Area
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  chartType === 'line' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                <i className="fas fa-chart-line mr-1"></i>Line
              </button>
              <button
                onClick={() => setChartType('bar')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  chartType === 'bar' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                <i className="fas fa-chart-bar mr-1"></i>Bar
              </button>
            </div>
          </div>
        </div>
        
        <div className="h-80">
          {chartType === 'area' ? (
            <AreaChart
              data={currentChartData}
              areas={[
                { dataKey: 'entries', fill: '#3B82F6', stroke: '#1D4ED8', name: 'Total Entries' },
                { dataKey: 'unique', fill: '#10B981', stroke: '#059669', name: 'Unique Users' }
              ]}
              height={300}
              stacked={false}
            />
          ) : chartType === 'line' ? (
            <LineChart
              data={currentChartData}
              lines={[
                { dataKey: 'entries', stroke: '#3B82F6', name: 'Total Entries' },
                { dataKey: 'unique', stroke: '#10B981', name: 'Unique Users' }
              ]}
              height={300}
            />
          ) : (
            <BarChart
              data={currentChartData}
              bars={[
                { dataKey: 'entries', fill: '#3B82F6', name: 'Total Entries' },
                { dataKey: 'unique', fill: '#10B981', name: 'Unique Users' }
              ]}
              height={300}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default UserEntryTab
