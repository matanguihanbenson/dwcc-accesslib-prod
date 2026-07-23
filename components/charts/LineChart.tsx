'use client'

import React from 'react'
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface LineChartProps {
  data: Array<{ name: string; [key: string]: string | number }>
  lines: Array<{
    dataKey: string
    stroke: string
    name?: string
  }>
  height?: number
  className?: string
  /** Optional message shown when every data point is 0. */
  emptyMessage?: string
}

function LineChart({
  data,
  lines,
  height = 300,
  className,
  emptyMessage
}: LineChartProps): React.ReactElement {
  // Detect the all-zeros case so we can render a
  // useful message instead of a flat line that
  // looks like a rendering bug. The check is
  // value-driven: if every numeric column is 0 or
  // undefined across the whole series, we show the
  // empty state.
  const numericKeys = Object.keys(data[0] || {}).filter(
    (k) => k !== 'name' && k !== 'key'
  )
  const hasData = data.some((row) =>
    numericKeys.some((k) => Number(row[k]) > 0)
  )

  if (!hasData && emptyMessage) {
    return (
      <div
        className={`w-full flex flex-col items-center justify-center text-gray-500 ${className || ''}`}
        style={{ height }}
      >
        <i className="fas fa-chart-line text-3xl text-gray-300 mb-2"></i>
        <p className="text-sm font-medium text-gray-700">No data for this period</p>
        <p className="text-xs text-gray-500 mt-1 max-w-xs text-center">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className={`w-full ${className || ''}`}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart data={data} margin={{ top: 20, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={{ stroke: '#e5e7eb' }}
            axisLine={{ stroke: '#e5e7eb' }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={{ stroke: '#e5e7eb' }}
            axisLine={{ stroke: '#e5e7eb' }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              fontSize: '12px'
            }}
            cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
            iconType="line"
          />
          {lines.map((line, index) => (
            <Line
              key={index}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.stroke}
              strokeWidth={2}
              dot={{ fill: line.stroke, strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, stroke: line.stroke, strokeWidth: 2 }}
              name={line.name || line.dataKey}
              connectNulls
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default LineChart
