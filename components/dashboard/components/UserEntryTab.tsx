'use client'

import React, { useMemo, useState } from 'react'
import { LineChart, BarChart, AreaChart } from '@/components/charts'
import { getTimePeriodData } from '@/services/chartService'

interface UserEntryData {
  totalToday: number
  totalThisWeek: number
  totalThisMonth: number
  totalThisYear: number
  uniqueUsersToday: number
  uniqueUsersWeek: number
  uniqueUsersMonth: number
  uniqueUsersYear: number
  peakHour: string
  trend: 'up' | 'down' | 'stable'
}

interface ChartPoint {
  name: string
  entries: number
  unique: number
  key?: string
}

interface ChartData {
  day: ChartPoint[]
  week: ChartPoint[]
  month: ChartPoint[]
  year: ChartPoint[]
}

interface EntranceOption {
  entrance_id: number
  name: string
  campus: 'COLLEGE' | 'BASIC_EDUCATION' | null
  is_active: boolean
}

interface UserEntryTabProps {
  userEntryData: UserEntryData
  chartData: ChartData
  // All entrances the user can pick from. `[]` is fine — the
  // select just shows the "All entrances" default and lets the
  // user know the list is loading.
  entrances: EntranceOption[]
  // Empty string = "All entrances". The parent owns this state
  // because the analytics payload is refetched on change, so
  // we treat it as a controlled select.
  selectedEntranceId: string
  onEntranceChange: (value: string) => void
}

type Period = 'day' | 'week' | 'month' | 'year'

const PERIOD_LABELS: Record<Period, string> = {
  day: 'Today',
  week: 'This Week',
  month: 'This Month',
  year: 'This Year'
}

const PERIOD_SUBTITLES: Record<Period, string> = {
  day: 'Hourly breakdown for the current day',
  week: 'Daily breakdown for the last 7 days',
  month: 'Daily breakdown for the last 30 days',
  year: 'Monthly breakdown for the last 12 months'
}

function UserEntryTab({
  userEntryData,
  chartData,
  entrances,
  selectedEntranceId,
  onEntranceChange
}: UserEntryTabProps): React.ReactElement {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('week')
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('area')

  // Summary metrics for the currently-selected period. Pulled
  // from the server's pre-computed per-period numbers so the
  // cards always show the same totals the trend chart is
  // built from, regardless of which period the user picked.
  const periodSummary = useMemo(() => {
    const series = getTimePeriodData(chartData, selectedPeriod)
    const totalEntries = series.reduce((sum, p) => sum + (p.entries || 0), 0)
    const uniquePerBucket = series.reduce((sum, p) => sum + (p.unique || 0), 0)
    let peakLabel = 'N/A'
    let peakValue = 0
    for (const p of series) {
      if (p.entries > peakValue) {
        peakValue = p.entries
        peakLabel = p.name
      }
    }
    let totalEntriesForPeriod = totalEntries
    let uniqueUsersForPeriod = uniquePerBucket
    let peakLabelForPeriod = peakLabel
    if (selectedPeriod === 'day') {
      totalEntriesForPeriod = userEntryData.totalToday
      uniqueUsersForPeriod = userEntryData.uniqueUsersToday
      peakLabelForPeriod = userEntryData.peakHour
      peakValue = totalEntries
    } else if (selectedPeriod === 'week') {
      totalEntriesForPeriod = userEntryData.totalThisWeek
      uniqueUsersForPeriod = userEntryData.uniqueUsersWeek
    } else if (selectedPeriod === 'month') {
      totalEntriesForPeriod = userEntryData.totalThisMonth
      uniqueUsersForPeriod = userEntryData.uniqueUsersMonth
    } else {
      totalEntriesForPeriod = userEntryData.totalThisYear
      uniqueUsersForPeriod = userEntryData.uniqueUsersYear
    }
    return {
      totalEntries: totalEntriesForPeriod,
      uniqueUsers: uniqueUsersForPeriod,
      peakLabel: peakLabelForPeriod,
      peakValue,
      periodLabel: PERIOD_LABELS[selectedPeriod]
    }
  }, [chartData, selectedPeriod, userEntryData])

  const currentChartData = getTimePeriodData(chartData, selectedPeriod)

  const periodChipClass = (value: Period) =>
    `px-2.5 py-1 text-xs rounded-md border transition-colors ${
      selectedPeriod === value
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
    }`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-gray-800">User Entry Analytics</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label
              htmlFor="user-entry-entrance"
              className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide"
            >
              Library:
            </label>
            <select
              id="user-entry-entrance"
              value={selectedEntranceId}
              onChange={(e) => onEntranceChange(e.target.value)}
              className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="">All entrances</option>
              {entrances.map((e) => (
                <option key={e.entrance_id} value={String(e.entrance_id)}>
                  {e.name}
                  {e.campus ? ` (${e.campus === 'COLLEGE' ? 'College' : 'Basic Ed'})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mr-1">Period:</span>
            {(['day', 'week', 'month', 'year'] as Period[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSelectedPeriod(value)}
                className={periodChipClass(value)}
              >
                {PERIOD_LABELS[value]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Entries</p>
              <p className="text-2xl font-bold text-blue-800">{periodSummary.totalEntries.toLocaleString()}</p>
              <p className="text-xs text-blue-600">{periodSummary.periodLabel}</p>
            </div>
            <i className="fas fa-door-open text-blue-500 text-xl"></i>
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Unique Users</p>
              <p className="text-2xl font-bold text-green-800">{periodSummary.uniqueUsers.toLocaleString()}</p>
              <p className="text-xs text-green-600">{periodSummary.periodLabel}</p>
            </div>
            <i className="fas fa-users text-green-500 text-xl"></i>
          </div>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Peak</p>
              <p className="text-2xl font-bold text-purple-800">
                {periodSummary.peakLabel}
              </p>
              <p className="text-xs text-purple-600">
                {periodSummary.peakValue.toLocaleString()} entries · {periodSummary.periodLabel}
              </p>
            </div>
            <i className="fas fa-chart-line text-purple-500 text-xl"></i>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h4 className="text-sm font-semibold text-gray-800">Entry Trends Chart</h4>
            <p className="text-xs text-gray-500 mt-0.5">{PERIOD_SUBTITLES[selectedPeriod]}</p>
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
