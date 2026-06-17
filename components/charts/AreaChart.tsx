'use client'

import React from 'react'
import { AreaChart as RechartsAreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface AreaChartProps {
  data: Array<{ name: string; [key: string]: string | number }>
  areas: Array<{
    dataKey: string
    fill: string
    stroke?: string
    name?: string
  }>
  height?: number
  className?: string
  stacked?: boolean
}

function AreaChart({ 
  data, 
  areas, 
  height = 300, 
  className,
  stacked = false 
}: AreaChartProps): React.ReactElement {
  return (
    <div className={`w-full ${className || ''}`}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsAreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
          {areas.map((area, index) => (
            <Area
              key={index}
              type="monotone"
              dataKey={area.dataKey}
              stackId={stacked ? "1" : undefined}
              stroke={area.stroke || area.fill}
              fill={area.fill}
              fillOpacity={0.6}
              name={area.name || area.dataKey}
            />
          ))}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default AreaChart
