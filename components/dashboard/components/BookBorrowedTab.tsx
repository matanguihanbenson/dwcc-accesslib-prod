'use client'

import React from 'react'
import { BarChart, LineChart } from '@/components/charts'
import { transformBookDataForChart } from '@/services/chartService'

interface BookBorrowedData {
  borrowedToday: number
  borrowedThisWeek: number
  borrowedThisMonth: number
  popularBook: string
  averageBorrowDuration: string
  returnRate: number
}

interface BookBorrowedTabProps {
  bookBorrowedData: BookBorrowedData
}

function BookBorrowedTab({ bookBorrowedData }: BookBorrowedTabProps): React.ReactElement {
  const chartData = transformBookDataForChart(bookBorrowedData)
  
  // Create trend data for the line chart
  const trendData = [
    { name: 'Week 1', borrowed: Math.max(0, bookBorrowedData.borrowedThisMonth * 0.2), returned: Math.max(0, bookBorrowedData.borrowedThisMonth * 0.18) },
    { name: 'Week 2', borrowed: Math.max(0, bookBorrowedData.borrowedThisMonth * 0.25), returned: Math.max(0, bookBorrowedData.borrowedThisMonth * 0.22) },
    { name: 'Week 3', borrowed: Math.max(0, bookBorrowedData.borrowedThisMonth * 0.28), returned: Math.max(0, bookBorrowedData.borrowedThisMonth * 0.26) },
    { name: 'Week 4', borrowed: Math.max(0, bookBorrowedData.borrowedThisMonth * 0.27), returned: Math.max(0, bookBorrowedData.borrowedThisMonth * 0.24) }
  ]

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Book Borrowing Analytics</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Today</p>
              <p className="text-2xl font-bold text-green-800">{bookBorrowedData.borrowedToday}</p>
            </div>
            <i className="fas fa-book text-green-500 text-xl"></i>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">This Week</p>
              <p className="text-2xl font-bold text-blue-800">{bookBorrowedData.borrowedThisWeek}</p>
            </div>
            <i className="fas fa-calendar-week text-blue-500 text-xl"></i>
          </div>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">This Month</p>
              <p className="text-2xl font-bold text-purple-800">{bookBorrowedData.borrowedThisMonth}</p>
            </div>
            <i className="fas fa-calendar-alt text-purple-500 text-xl"></i>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
          <h4 className="text-base font-semibold text-gray-800 mb-4">Borrowing Statistics</h4>
          <div className="space-y-3">
            <div className="flex items-start justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Most Popular Book</span>
              <span className="text-sm font-semibold text-gray-900 text-right max-w-[60%]">
                {bookBorrowedData.popularBook === 'N/A' || bookBorrowedData.popularBook === 'Loading...' || bookBorrowedData.popularBook.includes('No data')
                  ? '—' 
                  : bookBorrowedData.popularBook}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Average Duration</span>
              <span className="text-sm font-semibold text-gray-900">
                {bookBorrowedData.averageBorrowDuration === 'N/A' || bookBorrowedData.averageBorrowDuration === 'Loading...'
                  ? '—' 
                  : bookBorrowedData.averageBorrowDuration}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">Return Rate</span>
              <span className="text-sm font-semibold text-gray-900">{bookBorrowedData.returnRate}%</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-800 mb-4">Period Comparison</h4>
          <div className="h-64">
            <BarChart
              data={chartData}
              bars={[
                { dataKey: 'value', fill: '#10B981', name: 'Books Borrowed' }
              ]}
              height={220}
            />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-800 mb-4">Monthly Trends</h4>
          <div className="h-64">
            <LineChart
              data={trendData}
              lines={[
                { dataKey: 'borrowed', stroke: '#3B82F6', name: 'Borrowed' },
                { dataKey: 'returned', stroke: '#10B981', name: 'Returned' }
              ]}
              height={220}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default BookBorrowedTab
