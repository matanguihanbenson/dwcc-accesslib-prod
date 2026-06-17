'use client'

import React from 'react'
import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface PieChartData {
  name: string
  value: number
  fill?: string
}

interface PieChartProps {
  data: PieChartData[]
  height?: number
  className?: string
  showLegend?: boolean
  innerRadius?: number
  outerRadius?: number
}

function PieChart({ 
  data, 
  height = 300, 
  className,
  showLegend = true,
  innerRadius = 0,
  outerRadius = 80
}: PieChartProps): React.ReactElement {
  const defaultColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316']

  return (
    <div className={`w-full ${className || ''}`}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.fill || defaultColors[index % defaultColors.length]} 
              />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              fontSize: '12px'
            }}
            formatter={(value: number) => [value, 'Count']}
          />
          {showLegend && (
            <Legend 
              verticalAlign="bottom" 
              height={36}
              wrapperStyle={{ fontSize: '12px' }}
            />
          )}
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  )
}

export default PieChart
