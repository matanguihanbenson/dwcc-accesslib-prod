'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PeakHoursChartProps {
  hourlyTotals: Record<number, number>
  totalEntries: number
  maxBars?: number
}

export function PeakHoursChart({ hourlyTotals, totalEntries, maxBars = 5 }: PeakHoursChartProps) {
  const formatHourLabel = (hour: number): string => {
    if (hour < 12) return `${hour}:00 AM`
    if (hour === 12) return '12:00 NN'
    return `${hour - 12}:00 PM`
  }

  const sortedHours = Object.entries(hourlyTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxBars)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Peak Hours</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedHours.map(([hour, count]) => {
            const hourNum = parseInt(hour)
            const timeLabel = formatHourLabel(hourNum)
            const percentage = (count / totalEntries) * 100

            return (
              <div key={hour}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{timeLabel}</span>
                  <span className="text-gray-600">
                    {count} visits ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
