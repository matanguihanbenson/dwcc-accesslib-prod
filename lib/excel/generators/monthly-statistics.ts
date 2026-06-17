import * as XLSX from 'xlsx'
import { ExcelReportData } from '../types'
import { TIME_SLOTS, addMonthSeparators, applyMonthMerges, formatReportTitle } from '../utils'

/**
 * Generates monthly statistics workbook with user statistics
 */
export function generateMonthlyStatistics(
  data: ExcelReportData,
  dateRangeTitle?: string
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new()
  const { month, year, dailyData, hourlyTotals, summary, userTypeStats, gradeLevelStats } = data

  // Monthly Statistics Sheet
  const monthlyData: any[][] = []
  
  // Header rows
  monthlyData.push(['Divine Word College of Calapan - College Library'])
  monthlyData.push([`User's Statistics for ${formatReportTitle(month, year, dateRangeTitle)}`])
  monthlyData.push([]) // Empty row

  // Table headers
  monthlyData.push(['Date', 'Day', ...TIME_SLOTS, 'Total'])

  // Daily data rows with month separators
  let grandTotal = 0
  const { rows, monthRowIndices } = addMonthSeparators(dailyData)
  
  rows.forEach(row => {
    monthlyData.push(row)
    // Sum non-holiday totals
    if (row[row.length - 1] !== '-' && row[row.length - 1] !== '') {
      grandTotal += typeof row[row.length - 1] === 'number' ? row[row.length - 1] : 0
    }
  })

  // Totals row
  const totalsRow: any[] = ['TOTAL', '']
  for (let hour = 7; hour <= 19; hour++) {
    totalsRow.push(hourlyTotals[hour] || 0)
  }
  totalsRow.push(grandTotal)
  monthlyData.push(totalsRow)

  // Summary
  monthlyData.push([]) // Empty row
  monthlyData.push(['Summary'])
  monthlyData.push(['Total Entries', summary.totalEntries])
  monthlyData.push(['Total Days', summary.totalDays])
  monthlyData.push(['Average Per Day', summary.averagePerDay])

  const monthlySheet = XLSX.utils.aoa_to_sheet(monthlyData)
  
  // Apply month separator merges
  applyMonthMerges(monthlySheet, monthRowIndices, 4, 15) // Start after headers (row 4)
  
  XLSX.utils.book_append_sheet(workbook, monthlySheet, 'Monthly Statistics')

  // User Type Statistics Sheet
  const userTypeData: any[][] = []
  userTypeData.push(['Divine Word College of Calapan - College Library'])
  userTypeData.push([`User Type Statistics for ${formatReportTitle(month, year, dateRangeTitle)}`])
  userTypeData.push([]) // Empty row
  userTypeData.push(['User Type', 'Count', 'Percentage'])

  Object.entries(userTypeStats).forEach(([type, count]) => {
    userTypeData.push([
      type,
      count,
      `${((count / summary.totalEntries) * 100).toFixed(1)}%`
    ])
  })

  const userTypeSheet = XLSX.utils.aoa_to_sheet(userTypeData)
  XLSX.utils.book_append_sheet(workbook, userTypeSheet, 'User Types')

  // Grade Level Statistics Sheet (if applicable)
  if (Object.keys(gradeLevelStats).length > 0) {
    const gradeLevelData: any[][] = []
    gradeLevelData.push(['Divine Word College of Calapan - College Library'])
    gradeLevelData.push([`Grade Level Statistics for ${formatReportTitle(month, year, dateRangeTitle)}`])
    gradeLevelData.push([]) // Empty row
    gradeLevelData.push(['Grade Level', 'Count', 'Percentage'])

    Object.entries(gradeLevelStats).forEach(([grade, count]) => {
      gradeLevelData.push([
        grade,
        count,
        `${((count / summary.totalEntries) * 100).toFixed(1)}%`
      ])
    })

    const gradeLevelSheet = XLSX.utils.aoa_to_sheet(gradeLevelData)
    XLSX.utils.book_append_sheet(workbook, gradeLevelSheet, 'Grade Levels')
  }

  return workbook
}
