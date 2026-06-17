import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ReportData } from '../types'
import { TIME_SLOTS_SHORT, MONTH_NAMES, addReportHeader, insertMonthSeparators, addFooter } from '../utils'

export function generateMonthlyStatistics(
  doc: jsPDF,
  data: ReportData,
  preparedBy: string = '',
  dateRangeTitle?: string
): void {
  const { month, year, dailyData, hourlyTotals, summary } = data

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const centerX = pageWidth / 2

  // Add header
  addReportHeader(
    doc,
    "User's Statistics",
    `for ${dateRangeTitle || `the month of ${MONTH_NAMES[month - 1]}, ${year}`}`,
    centerX
  )

  // Insert month separators if date range spans multiple months
  const { data: processedData } = insertMonthSeparators(dailyData)

  // Prepare table data
  const tableData: any[] = []
  let grandTotal = 0

  processedData.forEach((day: any) => {
    // Handle month separator rows
    if (day.isMonthSeparator) {
      tableData.push([day.monthName, '', '', '', '', '', '', '', '', '', '', '', '', ''])
      return
    }

    const isHoliday = day.holiday !== null
    const row: any[] = [
      day.dayOfMonth.toString(),
      isHoliday ? day.holiday.name : (day.dayOfWeek === 'Sunday' ? 'Sunday' : '')
    ]

    // Add hourly data (7 AM = hour 7, to 5 PM = hour 17)
    for (let hour = 7; hour <= 17; hour++) {
      const count = day.hours[hour] || 0
      row.push(isHoliday ? '' : (count || ''))
    }

    row.push(isHoliday ? '' : day.total.toString())
    if (!isHoliday) {
      grandTotal += day.total
    }
    tableData.push(row)
  })

  // Add totals row
  const totalsRow: any[] = ['TOTAL', '']
  for (let hour = 7; hour <= 17; hour++) {
    totalsRow.push(hourlyTotals[hour] || '')
  }
  totalsRow.push(grandTotal.toString())
  tableData.push(totalsRow)

  // Column widths
  const dateColWidth = 10
  const dayColWidth = 20
  const totalColWidth = 12
  const timeSlotWidth = 11

  // Generate table
  autoTable(doc, {
    startY: 38,
    head: [['Time & Date', '', ...TIME_SLOTS_SHORT, 'Total']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 5.5,
      cellPadding: 1.2,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 5
    },
    headStyles: {
      fillColor: [200, 200, 200],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 5.5
    },
    columnStyles: {
      0: { cellWidth: dateColWidth, halign: 'center' },
      1: { cellWidth: dayColWidth, halign: 'left', fontSize: 5.5 },
      2: { cellWidth: timeSlotWidth },
      3: { cellWidth: timeSlotWidth },
      4: { cellWidth: timeSlotWidth },
      5: { cellWidth: timeSlotWidth },
      6: { cellWidth: timeSlotWidth },
      7: { cellWidth: timeSlotWidth },
      8: { cellWidth: timeSlotWidth },
      9: { cellWidth: timeSlotWidth },
      10: { cellWidth: timeSlotWidth },
      11: { cellWidth: timeSlotWidth },
      12: { cellWidth: timeSlotWidth },
      13: { cellWidth: totalColWidth }
    },
    didDrawPage: (data) => {
      data.settings.startY = data.pageNumber === 1 ? 38 : 20
    },
    didParseCell: (data) => {
      const rowIndex = data.row.index
      const colIndex = data.column.index
      
      if (data.row.section === 'head') return
      
      // Month separator rows
      const isMonthSeparator = tableData[rowIndex][0] && typeof tableData[rowIndex][0] === 'string' && tableData[rowIndex][1] === ''
      
      if (isMonthSeparator && colIndex === 0) {
        data.cell.colSpan = 14
        data.cell.styles.fillColor = [100, 100, 100]
        data.cell.styles.textColor = [255, 255, 255]
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.halign = 'center'
        data.cell.styles.fontSize = 7
        data.cell.styles.minCellHeight = 6
        return
      } else if (isMonthSeparator && colIndex > 0) {
        data.cell.text = []
        return
      }
      
      // Holiday/Sunday rows
      if (rowIndex < tableData.length - 1) {
        const dayLabel = tableData[rowIndex][1]
        const isHoliday = typeof dayLabel === 'string' && dayLabel !== '' && dayLabel !== 'Sunday'
        const isSunday = dayLabel === 'Sunday'
        
        if (isHoliday) {
          data.cell.styles.fillColor = [255, 200, 200]
          data.cell.styles.textColor = [139, 0, 0]
          data.cell.styles.fontStyle = 'italic'
          
          if (colIndex >= 2 && colIndex <= 12) {
            if (colIndex === 2) {
              data.cell.text = [dayLabel]
              data.cell.colSpan = 11
              data.cell.styles.halign = 'center'
              data.cell.styles.valign = 'middle'
              data.cell.styles.minCellHeight = 7
            } else {
              data.cell.text = []
            }
          }
          
          if (colIndex === 1) {
            data.cell.text = ['Holiday']
            data.cell.styles.halign = 'center'
          }
        } else if (isSunday) {
          data.cell.styles.fillColor = [255, 255, 200]
        }
      }
      
      // Totals row
      if (rowIndex === tableData.length - 1) {
        data.cell.styles.fillColor = [220, 220, 220]
        data.cell.styles.fontStyle = 'bold'
      }
    }
  })

  // Add footer
  const finalY = (doc as any).lastAutoTable.finalY + 10
  addFooter(doc, finalY, pageHeight, pageWidth, summary, preparedBy)
}
