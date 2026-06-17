'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SummaryCardProps {
  title: string
  value: string | number
  description?: string
  icon?: string
  valueColor?: string
}

export function SummaryCard({ title, value, description, icon, valueColor = 'text-blue-600' }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon && <i className={icon}></i>}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-4xl font-bold ${valueColor}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        {description && (
          <p className="text-sm text-gray-600 mt-2">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}
