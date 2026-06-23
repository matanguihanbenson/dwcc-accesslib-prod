'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type DatePreset = 'today' | 'week' | 'month' | 'year' | 'custom' | 'date'

interface DatePresetSelectorProps {
  preset: DatePreset
  onPresetChange: (preset: DatePreset) => void
  dateFrom: string
  dateTo: string
  onDateFromChange: (date: string) => void
  onDateToChange: (date: string) => void
  showSpecificDate?: boolean
  specificDate?: string
  onSpecificDateChange?: (date: string) => void
  variant?: 'buttons' | 'tabs'
}
{/*  */}
export function DatePresetSelector({
  preset,
  onPresetChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  showSpecificDate = false,
  specificDate,
  onSpecificDateChange,
  variant = 'buttons'
}: DatePresetSelectorProps) {
  const presets: { value: DatePreset; label: string; icon: string }[] = [
    { value: 'today', label: 'Today', icon: 'fas fa-calendar-day' },
    { value: 'week', label: 'This Week', icon: 'fas fa-calendar-week' },
    { value: 'month', label: 'This Month', icon: 'fas fa-calendar-alt' },
    { value: 'year', label: 'This Year', icon: 'fas fa-calendar' },
    { value: 'custom', label: 'Custom Range', icon: 'fas fa-cog' }
  ]

  if (showSpecificDate) {
    presets.splice(1, 0, { value: 'date', label: 'Specific Date', icon: 'fas fa-calendar-check' })
  }

  const getHelperText = () => {
    switch (preset) {
      case 'today':
        return 'Showing statistics for today only'
      case 'week':
        return 'Showing statistics for the current week (Sunday to Saturday)'
      case 'month':
        return 'Showing statistics for the current month'
      case 'year':
        return 'Showing statistics for the current year'
      case 'date':
        return 'Showing statistics for a specific date'
      case 'custom':
        return 'Custom date range selected'
      default:
        return ''
    }
  }

  if (variant === 'tabs') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
          {presets.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onPresetChange(p.value)}
              className={`px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                preset === p.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <i className={`${p.icon} mr-1`}></i>
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                From Date
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  onDateFromChange(e.target.value)
                  onPresetChange('custom')
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                To Date
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  onDateToChange(e.target.value)
                  onPresetChange('custom')
                }}
              />
            </div>
          </div>
        )}

        {preset === 'date' && showSpecificDate && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Select Date
            </label>
            <Input
              type="date"
              value={specificDate || ''}
              onChange={(e) => {
                if (onSpecificDateChange) {
                  onSpecificDateChange(e.target.value)
                }
              }}
            />
          </div>
        )}

        <p className="text-xs text-gray-500">{getHelperText()}</p>
      </div>
    )
  }

  // Default 'buttons' variant
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Button
            key={p.value}
            variant="outline"
            size="sm"
            onClick={() => onPresetChange(p.value)}
            className={
              preset === p.value
                ? '!bg-blue-600 !text-white !border-blue-600 hover:!bg-blue-700 hover:!text-white'
                : ''
            }
          >
            {p.label}
          </Button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              From Date
            </label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                onDateFromChange(e.target.value)
                onPresetChange('custom')
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              To Date
            </label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                onDateToChange(e.target.value)
                onPresetChange('custom')
              }}
            />
          </div>
        </div>
      )}

      {preset === 'date' && showSpecificDate && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Select Date
          </label>
          <Input
            type="date"
            value={specificDate || ''}
            onChange={(e) => {
              if (onSpecificDateChange) {
                onSpecificDateChange(e.target.value)
              }
            }}
          />
        </div>
      )}

      <p className="text-xs text-gray-500">{getHelperText()}</p>
    </div>
  )
}
