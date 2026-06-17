// Chart service utilities for transforming data for Recharts visualizations

interface ChartData {
  day: Array<{ name: string; entries: number; unique: number }>
  week: Array<{ name: string; entries: number; unique: number }>
  month: Array<{ name: string; entries: number; unique: number }>
  year: Array<{ name: string; entries: number; unique: number }>
}

interface BookBorrowedData {
  borrowedToday: number
  borrowedThisWeek: number
  borrowedThisMonth: number
  popularBook: string
  averageBorrowDuration: string
  returnRate: number
}

interface OverdueData {
  totalOverdue: number
  overdueBooks: number
  overdueLockers: number
  totalFines: number
  oldestOverdue: string
  averageOverdueDays: number
}

interface LockerUsageData {
  totalLockers: number
  occupiedLockers: number
  availableLockers: number
  averageUsageTime: string
  mostUsedLocker: string
  utilizationRate: number
}

// Get data for specific time period
export function getTimePeriodData(
  chartData: ChartData, 
  period: 'day' | 'week' | 'month' | 'year'
): Array<{ name: string; entries: number; unique: number }> {
  return chartData[period] || []
}

// Transform book borrowing data for chart visualization
export function transformBookDataForChart(data: BookBorrowedData) {
  return [
    {
      name: 'Today',
      value: data.borrowedToday,
      fill: '#3B82F6'
    },
    {
      name: 'This Week',
      value: data.borrowedThisWeek,
      fill: '#10B981'
    },
    {
      name: 'This Month',
      value: data.borrowedThisMonth,
      fill: '#8B5CF6'
    }
  ]
}

// Transform overdue data for pie chart
export function transformOverdueDataForChart(data: OverdueData) {
  if (data.totalOverdue === 0) {
    return [
      {
        name: 'No Overdue Items',
        value: 1,
        fill: '#10B981'
      }
    ]
  }

  return [
    {
      name: 'Overdue Books',
      value: data.overdueBooks,
      fill: '#EF4444'
    },
    {
      name: 'Overdue Lockers',
      value: data.overdueLockers,
      fill: '#F97316'
    }
  ]
}

// Transform locker usage data for pie chart
export function transformLockerDataForChart(data: LockerUsageData) {
  return [
    {
      name: 'Occupied',
      value: data.occupiedLockers,
      fill: '#EF4444'
    },
    {
      name: 'Available',
      value: data.availableLockers,
      fill: '#10B981'
    }
  ]
}

// Calculate percentage with safe division
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0
  return Math.round((value / total) * 100)
}

// Create chart data for different time periods
export function createTimeSeriesData(
  entries: number[],
  labels: string[],
  uniqueUsers?: number[]
): Array<{ name: string; entries: number; unique?: number }> {
  return labels.map((label, index) => ({
    name: label,
    entries: entries[index] || 0,
    ...(uniqueUsers && { unique: uniqueUsers[index] || 0 })
  }))
}

// Transform numeric data for area/line charts
export function transformTrendData(data: {
  labels: string[]
  datasets: Array<{
    label: string
    data: number[]
    color: string
  }>
}) {
  return data.labels.map((label, index) => {
    const point: any = { name: label }
    data.datasets.forEach(dataset => {
      point[dataset.label.toLowerCase().replace(/\s+/g, '_')] = dataset.data[index] || 0
    })
    return point
  })
}

// Color palettes for consistent chart styling
export const CHART_COLORS = {
  primary: '#3B82F6',
  secondary: '#10B981', 
  accent: '#8B5CF6',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#06B6D4',
  success: '#10B981',
  muted: '#6B7280'
}

export const PIE_CHART_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#8B5CF6', // Purple
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#84CC16'  // Lime
]
