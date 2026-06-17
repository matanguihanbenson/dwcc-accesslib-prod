import * as XLSX from 'xlsx'

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export const TIME_SLOTS = [
  '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 NN',
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'
]

/**
 * Adds month separator rows to daily data for multi-month ranges
 */
export function addMonthSeparators(
  dailyData: any[],
  monthNames: string[] = MONTH_NAMES
): { rows: any[][], monthRowIndices: number[] } {
  const rows: any[][] = []
  const monthRowIndices: number[] = []
  let currentMonth: number | null = null
  
  dailyData.forEach((day: any) => {
    const dayDate = new Date(day.date)
    const dayMonth = dayDate.getMonth()
    const dayYear = dayDate.getFullYear()
    
    // Insert month separator if month changed
    if (currentMonth !== dayMonth) {
      const monthName = `${monthNames[dayMonth]} ${dayYear}`
      monthRowIndices.push(rows.length)
      rows.push([monthName, '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
      currentMonth = dayMonth
    }
    
    const isHoliday = day.holiday !== null
    const dayLabel = isHoliday ? `Holiday: ${day.holiday.name}` : day.dayOfWeek
    const row: any[] = [day.dayOfMonth, dayLabel]
    
    for (let hour = 7; hour <= 19; hour++) {
      row.push(isHoliday ? '-' : (day.hours[hour] || 0))
    }
    row.push(isHoliday ? '-' : day.total)
    
    rows.push(row)
  })
  
  return { rows, monthRowIndices }
}

/**
 * Applies cell merges to Excel worksheet for month separator rows
 */
export function applyMonthMerges(
  worksheet: XLSX.WorkSheet,
  monthRowIndices: number[],
  startRow: number,
  numColumns: number
): void {
  if (!worksheet['!merges']) {
    worksheet['!merges'] = []
  }
  
  monthRowIndices.forEach((monthRowIdx) => {
    const actualRow = startRow + monthRowIdx
    worksheet['!merges']!.push({
      s: { r: actualRow, c: 0 },
      e: { r: actualRow, c: numColumns - 1 }
    })
  })
}

/**
 * Formats date range title for report headers
 */
export function formatReportTitle(
  month: number,
  year: number,
  dateRangeTitle?: string,
  monthNames: string[] = MONTH_NAMES
): string {
  return dateRangeTitle || `${monthNames[month - 1]}, ${year}`
}
