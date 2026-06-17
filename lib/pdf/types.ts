export type PaperSize = 'short' | 'long' | 'a4'

export interface ReportData {
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
  hourlyAverages?: Record<number, number>
  peakHours?: Array<{ hour: number; count: number }>
  userTypeStats: Record<string, number>
  gradeLevelStats: Record<string, number>
  summary: {
    totalEntries: number
    totalDays: number
    averagePerDay: number
    maxOccupancy?: number
    averageOccupancy?: number
    peakHour?: number
    totalUniqueUsers?: number
  }
}

export interface EntranceExitReportData {
  month: number
  year: number
  timeRangeData: Array<{
    timeRange: string
    admin: number
    faculty: number
    employee: number
    guest: number
    alumni: number
    basicEducation: number
    collegeStudents: number
    total: number
  }>
  summary: {
    totalEntries: number
    peakTimeRange: string
    averagePerHour: number
  }
}

export interface LockerStatisticsReportData {
  month: number
  year: number
  dailyData: Array<{
    date: string
    dayOfWeek: string
    dayOfMonth: number
    hours: Record<number, number>
    total: number
    uniqueCount?: number
    holiday?: { name: string; description?: string | null }
  }>
  hourlyTotals: Record<number, number>
  hourlyAverages?: Record<number, number>
  peakHours?: Array<{ hour: number; count: number }>
  userTypeStats: Record<string, number>
  summary: {
    totalAssignments: number
    totalDays: number
    averagePerDay: number
    maxOccupancy?: number
    averageOccupancy?: number
    peakHour?: number
    totalUniqueUsers?: number
  }
}
