'use client'

import React from 'react'
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface BarChartProps {
  data: Array<{ name: string; [key: string]: string | number }>
  bars: Array<{
    dataKey: string
    fill: string
    name?: string
  }>
  height?: number
  className?: string
}

function BarChart({ data, bars, height = 300, className }: BarChartProps): React.ReactElement {
  return (
    <div className={`w-full ${className || ''}`}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={{ stroke: '#e5e7eb' }}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={{ stroke: '#e5e7eb' }}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              fontSize: '12px'
            }}
          />
          {bars.map((bar, index) => (
            <Bar
              key={index}
              dataKey={bar.dataKey}
              fill={bar.fill}
              name={bar.name || bar.dataKey}
              radius={[2, 2, 0, 0]}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default BarChart
