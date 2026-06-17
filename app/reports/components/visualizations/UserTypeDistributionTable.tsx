'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface UserTypeDistributionTableProps {
  userTypeStats: Record<string, number>
  totalEntries: number
  title?: string
}

export function UserTypeDistributionTable({ 
  userTypeStats, 
  totalEntries,
  title = 'User Type Distribution'
}: UserTypeDistributionTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  User Type
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Count
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Percentage
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(userTypeStats).map(([type, count]) => (
                <tr key={type} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{type}</td>
                  <td className="px-6 py-4 text-sm text-center text-gray-900">{count}</td>
                  <td className="px-6 py-4 text-sm text-center text-gray-900">
                    {((count / totalEntries) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
