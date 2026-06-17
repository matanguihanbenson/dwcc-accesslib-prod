'use client'

import { Card, CardContent } from '@/components/ui/card'

interface NoDataStateProps {
  icon: string
  message: string
  title?: string
}

export function NoDataState({ icon, message, title }: NoDataStateProps) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-gray-500">
        <i className={`${icon} text-6xl text-gray-300 mb-4`}></i>
        {title && <h3 className="text-lg font-medium text-gray-700 mb-2">{title}</h3>}
        <p>{message}</p>
      </CardContent>
    </Card>
  )
}
