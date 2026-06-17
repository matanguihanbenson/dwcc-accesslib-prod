'use client'

import React from 'react'
import { ComposedChart as RechartsComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ChartElement {
  type: 'line' | 'area' | 'bar'
  dataKey: string
  color: string
  name?: string
  yAxisId?: string
}

interface ComposedChartProps {
  data: Array<{ name: string; [key: string]: string | number }>
  elements: ChartElement[]
  height?: number
  className?: string
  showLegend?: boolean
}

function ComposedChart({ 
  data, 
  elements, 
  height = 300, 
  className,
  showLegend = true 
}: ComposedChartProps): React.ReactElement {
  return (
    <div className={`w-full ${className || ''}`}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsComposedChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
          {showLegend && (
            <Legend 
              wrapperStyle={{ fontSize: '12px' }}
            />
          )}
          
          {elements.map((element, index) => {
            const commonProps = {
              key: index,
              dataKey: element.dataKey,
              name: element.name || element.dataKey,
              yAxisId: element.yAxisId
            }

            switch (element.type) {
              case 'line':
                return (
                  <Line
                    {...commonProps}
                    type="monotone"
                    stroke={element.color}
                    strokeWidth={2}
                    dot={{ fill: element.color, strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: element.color, strokeWidth: 2 }}
                  />
                )
              case 'area':
                return (
                  <Area
                    {...commonProps}
                    type="monotone"
                    fill={element.color}
                    stroke={element.color}
                    fillOpacity={0.6}
                  />
                )
              case 'bar':
                return (
                  <Bar
                    {...commonProps}
                    fill={element.color}
                    radius={[2, 2, 0, 0]}
                  />
                )
              default:
                return null
            }
          })}
        </RechartsComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export default ComposedChart
