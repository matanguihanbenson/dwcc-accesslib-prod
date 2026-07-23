'use client'

import React from 'react'
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface BarChartProps {
  data: Array<{ name: string; [key: string]: string | number }>
  bars: Array<{
    dataKey: string
    fill: string
    name?: string
  }>
  height?: number
  className?: string
  /** When true, the X axis is rotated to fit long category names. */
  rotateLabels?: boolean
  /** Optional message shown when every bar is 0. */
  emptyMessage?: string
}

function BarChart({
  data,
  bars,
  height = 300,
  className,
  rotateLabels = false,
  emptyMessage
}: BarChartProps): React.ReactElement {
  const numericKeys = Object.keys(data[0] || {}).filter(
    (k) => k !== 'name' && k !== 'key'
  )
  const hasData = data.length > 0 && data.some((row) =>
    numericKeys.some((k) => Number(row[k]) > 0)
  )

  if (!hasData && emptyMessage) {
    return (
      <div
        className={`w-full flex flex-col items-center justify-center text-gray-500 ${className || ''}`}
        style={{ height }}
      >
        <i className="fas fa-chart-bar text-3xl text-gray-300 mb-2"></i>
        <p className="text-sm font-medium text-gray-700">No data for this period</p>
        <p className="text-xs text-gray-500 mt-1 max-w-xs text-center">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className={`w-full ${className || ''}`}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data}
          margin={{ top: 20, right: 24, left: 8, bottom: rotateLabels ? 60 : 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="name"
            tick={(props: any) => {
              const { x, y, payload } = props
              if (rotateLabels) {
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text x={0} y={0} dy={16} textAnchor="end" fill="#6b7280" fontSize={11} transform="rotate(-30)">
                      {String(payload?.value ?? '').length > 16
                        ? String(payload?.value ?? '').substring(0, 16) + '…'
                        : payload?.value}
                    </text>
                  </g>
                )
              }
              return (
                <g transform={`translate(${x},${y})`}>
                  <text x={0} y={0} dy={16} textAnchor="middle" fill="#6b7280" fontSize={11}>
                    {payload?.value}
                  </text>
                </g>
              )
            }}
            tickLine={{ stroke: '#e5e7eb' }}
            axisLine={{ stroke: '#e5e7eb' }}
            interval={0}
            height={rotateLabels ? 70 : 30}
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
            cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
          />
          {bars.map((bar, index) => (
            <Bar
              key={index}
              dataKey={bar.dataKey}
              fill={bar.fill}
              name={bar.name || bar.dataKey}
              radius={[3, 3, 0, 0]}
              maxBarSize={60}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default BarChart
