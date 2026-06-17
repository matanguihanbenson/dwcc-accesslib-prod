export interface ExcelReportData {
  month: number
  year: number
  dailyData: Array<{
    date: string
    dayOfWeek: string
    dayOfMonth: number
    hours: Record<number, number>
    total: number
    holiday?: { name: string; description?: string | null }
  }>
  hourlyTotals: Record<number, number>
  userTypeStats: Record<string, number>
  gradeLevelStats: Record<string, number>
  summary: {
    totalEntries: number
    totalDays: number
    averagePerDay: number
  }
}

export interface EntryRecordFilters {
  userFilter: string
  userName: string
  dateFrom: string
  dateTo: string
  recordCount: number
  activeCount: number
}
