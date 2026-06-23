import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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

export class PDFReportGenerator {
  private doc: jsPDF
  private readonly monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  /**
   * The library name shown on the report header (under "Divine Word
   * College of Calapan"). Defaults to "College Library" so existing
   * callers without a campus see the same header they always have.
   * Set via the constructor (or `setLibraryName()`) to switch to
   * "Basic Education Library" or any other label.
   */
  private libraryName: string

  constructor(paperSize: PaperSize = 'short', libraryName: string = 'College Library') {
    // Convert paper size to dimensions
    const paperFormats = {
      short: [215.9, 279.4],  // 8.5" x 11" in mm
      long: [215.9, 330.2],   // 8.5" x 13" in mm
      a4: [210, 297]          // A4 standard
    }

    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: paperFormats[paperSize]
    })
    this.libraryName = libraryName
  }

  /** Override the library-name label on the report header. */
  setLibraryName(name: string): void {
    this.libraryName = name
  }

  // Helper to group daily data by month and insert month separators
  private insertMonthSeparators(dailyData: any[]): { data: any[], monthRowIndices: number[] } {
    if (dailyData.length === 0) return { data: [], monthRowIndices: [] }
    
    const result: any[] = []
    const monthRowIndices: number[] = []
    let currentMonth: number | null = null
    
    dailyData.forEach((day) => {
      const dayDate = new Date(day.date)
      const dayMonth = dayDate.getMonth()
      const dayYear = dayDate.getFullYear()
      
      // If month changed, insert a separator row
      if (currentMonth !== dayMonth) {
        const monthName = `${this.monthNames[dayMonth]} ${dayYear}`
        monthRowIndices.push(result.length)
        result.push({
          isMonthSeparator: true,
          monthName: monthName,
          month: dayMonth,
          year: dayYear
        })
        currentMonth = dayMonth
      }
      
      result.push(day)
    })
    
    return { data: result, monthRowIndices }
  }

  generateMonthlyStatistics(data: ReportData, preparedBy: string = '', dateRangeTitle?: string): void {
    const { month, year, dailyData, hourlyTotals, summary } = data

    // Header - optimized for portrait
    this.doc.setFontSize(11)
    this.doc.setFont('helvetica', 'bold')
    const pageWidth = this.doc.internal.pageSize.getWidth()
    const pageHeight = this.doc.internal.pageSize.getHeight()
    const centerX = pageWidth / 2
    
    this.doc.text('Divine Word College of Calapan', centerX, 15, { align: 'center' })
    
    this.doc.setFontSize(9)
    this.doc.text(this.libraryName, centerX, 21, { align: 'center' })
    
    this.doc.setFontSize(8)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text("User's Statistics", centerX, 27, { align: 'center' })
    this.doc.text(`for ${dateRangeTitle || `the month of ${this.monthNames[month - 1]}, ${year}`}`, centerX, 32, { align: 'center' })

    // Prepare time slots (7 AM to 5 PM) - abbreviated for portrait
    const timeSlots = [
      '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 NN',
      '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'
    ]

    // Prepare table data
    const tableData: any[] = []
    let grandTotal = 0

    dailyData.forEach((day: any) => {
      const isHoliday = day.holiday !== null
      // Format date with month abbreviation (e.g., "Jan 1")
      const dayDate = new Date(day.date)
      const monthAbbr = this.monthNames[dayDate.getMonth()].substring(0, 3)
      const dateDisplay = `${monthAbbr} ${day.dayOfMonth}`
      
      const row: any[] = [
        dateDisplay,
        isHoliday ? day.holiday.name : (day.dayOfWeek === 'Sunday' ? 'Sunday' : '')
      ]

      // Add hourly data (7 AM = hour 7, to 5 PM = hour 17)
      for (let hour = 7; hour <= 17; hour++) {
        const count = day.hours[hour] || 0
        row.push(isHoliday ? '' : count)
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
      totalsRow.push(hourlyTotals[hour] || 0)
    }
    totalsRow.push(grandTotal.toString())
    tableData.push(totalsRow)

    // Calculate dynamic column widths for portrait orientation
    const dateColWidth = 15 // Increased for "Mon DD" format
    const dayColWidth = 20
    const totalColWidth = 12
    const timeSlotWidth = 10.5 // Slightly reduced to fit

    // Generate table with portrait optimization and holiday cell merging
    autoTable(this.doc, {
      startY: 38,
      head: [[
        'Time & Date',
        '',
        ...timeSlots,
        'Total'
      ]],
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
        // Apply different top margins: 52mm on page 1, 20mm on subsequent pages
        if (data.pageNumber === 1) {
          data.settings.startY = 38
        } else {
          data.settings.startY = 20
        }
      },
      didParseCell: (data) => {
        const rowIndex = data.row.index
        const colIndex = data.column.index
        
        // Skip header row
        if (data.row.section === 'head') return
        
        // Check if this is a holiday row
        if (rowIndex < tableData.length - 1) {
          const dayLabel = tableData[rowIndex][1]
          const isHoliday = typeof dayLabel === 'string' && dayLabel !== '' && dayLabel !== 'Sunday'
          const isSunday = dayLabel === 'Sunday'
          
          if (isHoliday) {
            // Apply holiday styling to all cells
            data.cell.styles.fillColor = [255, 200, 200] // Light red for holidays
            data.cell.styles.textColor = [139, 0, 0] // Dark red text
            data.cell.styles.fontStyle = 'italic'
            
            // For time slot columns (2-12), merge them and show holiday name centered
            if (colIndex >= 2 && colIndex <= 12) {
              if (colIndex === 2) {
                // First time slot column shows the holiday name
                data.cell.text = [dayLabel]
                data.cell.colSpan = 11 // Merge all 11 time slot columns
                data.cell.styles.halign = 'center'
                data.cell.styles.valign = 'middle'
                data.cell.styles.minCellHeight = 7
              } else {
                // Hide other time slot columns (they're merged)
                data.cell.text = []
              }
            }
            
            // Clear the day column for holidays (moved to merged cells)
            if (colIndex === 1) {
              data.cell.text = ['Holiday']
              data.cell.styles.halign = 'center'
            }
          } else if (isSunday) {
            data.cell.styles.fillColor = [255, 255, 200] // Yellow for Sunday
          }
        }
        
        // Highlight totals row
        if (rowIndex === tableData.length - 1) {
          data.cell.styles.fillColor = [220, 220, 220]
          data.cell.styles.fontStyle = 'bold'
        }
      }
    })

    // Footer with page break handling
    const finalY = (this.doc as any).lastAutoTable.finalY + 10
    
    // Check if footer will fit on current page, otherwise add new page
    if (finalY + 20 > pageHeight - 20) {
      this.doc.addPage()
      const newPageY = 20
      this.doc.setFontSize(8)
      this.doc.setFont('helvetica', 'normal')
      this.doc.text(`Total Entries: ${summary.totalEntries}`, 20, newPageY)
      this.doc.text(`Average Per Day: ${summary.averagePerDay}`, 20, newPageY + 5)

      if (preparedBy) {
        this.doc.text('Prepared by:', pageWidth - 70, newPageY)
        this.doc.setFont('helvetica', 'bold')
        this.doc.text(preparedBy, pageWidth - 70, newPageY + 6)
      }
    } else {
      this.doc.setFontSize(8)
      this.doc.setFont('helvetica', 'normal')
      this.doc.text(`Total Entries: ${summary.totalEntries}`, 20, finalY)
      this.doc.text(`Average Per Day: ${summary.averagePerDay}`, 20, finalY + 5)

      if (preparedBy) {
        this.doc.text('Prepared by:', pageWidth - 70, finalY)
        this.doc.setFont('helvetica', 'bold')
        this.doc.text(preparedBy, pageWidth - 70, finalY + 6)
      }
    }
  }

  generateUsersPerHourStatistics(data: ReportData, preparedBy: string = '', dateRangeTitle?: string): void {
    const { month, year, dailyData, hourlyTotals, summary } = data

    // Header - optimized for portrait
    this.doc.setFontSize(11)
    this.doc.setFont('helvetica', 'bold')
    const pageWidth = this.doc.internal.pageSize.getWidth()
    const pageHeight = this.doc.internal.pageSize.getHeight()
    const centerX = pageWidth / 2
    
    this.doc.text('Divine Word College of Calapan', centerX, 15, { align: 'center' })
    
    this.doc.setFontSize(9)
    this.doc.text(this.libraryName, centerX, 21, { align: 'center' })
    
    this.doc.setFontSize(8)
    this.doc.setFont('helvetica', 'normalnormal')
    this.doc.text("User's Statistics", centerX, 27, { align: 'center' })
    this.doc.text(`for ${dateRangeTitle || `the month of ${this.monthNames[month - 1]}, ${year}`}`, centerX, 32, { align: 'center' })

    // Prepare time slots (7 AM to 7 PM)
    const timeSlots = [
      '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 NN',
      '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'
    ]

    // Prepare table data with multi-day holiday tracking
    const tableData: any[] = []
    const columnTotals: number[] = new Array(13).fill(0)
    const uniqueTotalsPerDay: number[] = []
    
    // Track multi-day holidays
    const multiDayHolidays = new Map<string, number[]>() // holidayName -> array of day indices
    
    // First pass: identify multi-day holidays
    dailyData.forEach((day: any, index: number) => {
      const isHoliday = day.holiday !== null && day.holiday !== undefined
      if (isHoliday) {
        const holidayName = day.holiday.name
        if (!multiDayHolidays.has(holidayName)) {
          multiDayHolidays.set(holidayName, [])
        }
        multiDayHolidays.get(holidayName)!.push(index)
      }
    })

    dailyData.forEach((day: any, index: number) => {
      const isHoliday = day.holiday !== null && day.holiday !== undefined
      const dayOfWeek = day.dayOfWeek || ''
      const isSunday = dayOfWeek.toLowerCase() === 'sunday'
      
      // Format date with month abbreviation (e.g., \"Jan 1\")
      const dayDate = new Date(day.date)
      const monthAbbr = this.monthNames[dayDate.getMonth()].substring(0, 3)
      const dateDisplay = `${monthAbbr} ${day.dayOfMonth}`
      
      const row: any[] = [dateDisplay]

      let dayTotal = 0
      let dayUnique = 0
      // Add hourly data (7 AM = hour 7, to 7 PM = hour 19)
      for (let hour = 7; hour <= 19; hour++) {
        const count = day.hours[hour] || 0
        if (isHoliday || isSunday) {
          row.push('')
        } else {
          row.push(count)
          dayTotal += count
          columnTotals[hour - 7] += count
        }
      }

      if (isHoliday || isSunday) {
        row.push('') // Total column
        row.push('') // UNIQUE column
      } else {
        // Total visits (sum of all hourly counts for the day)
        row.push(dayTotal)

        // Unique people for the day, using uniqueCount from API when available
        dayUnique = typeof day.uniqueCount === 'number' ? day.uniqueCount : dayTotal
        row.push(dayUnique)
        uniqueTotalsPerDay.push(dayUnique)
      }
      
      // Store metadata for multi-day holiday detection
      if (isHoliday) {
        const holidayName = day.holiday.name
        const dayIndices = multiDayHolidays.get(holidayName)!
        const isFirstDayOfHoliday = dayIndices[0] === index
        const isMultiDay = dayIndices.length > 1
        ;(row as any)._holidayMeta = {
          isFirstDay: isFirstDayOfHoliday,
          isMultiDay: isMultiDay,
          totalDays: dayIndices.length
        }
      }
      
      tableData.push(row)
    })

    // Add TOTAL row
    const totalsRow: any[] = ['TOTAL']
    let grandTotal = 0
    columnTotals.forEach(total => {
      totalsRow.push(total)
      grandTotal += total
    })

    // Grand total for TOTAL column (sum of per-day totals)
    totalsRow.push(grandTotal)

    // Grand total for UNIQUE column (sum of per-day unique counts)
    const grandUniqueTotal = uniqueTotalsPerDay.reduce((sum, v) => sum + v, 0)
    totalsRow.push(grandUniqueTotal)
    tableData.push(totalsRow)

    // Column widths optimized for portrait. The date column was
    // shrunk to 20 (was 23) to free up horizontal space for the
    // UNIQUE column to be wide enough that the header text doesn't
    // wrap to "UNIQU / E".
    const dateColWidth = 20
    const timeSlotWidth = 9.5 // Each time slot column (13 slots)
    const totalColWidth = 13
    const uniqueColWidth = 18 // UNIQUE column (widened to fit 'UNIQUE' without wrap)
    
    const columnWidths = [
      dateColWidth,
      ...Array(11).fill(timeSlotWidth),
      totalColWidth
    ]

    // Generate table
    autoTable(this.doc, {
      startY: 38,
      head: [['Time & Date', ...timeSlots, 'Total', 'UNIQUE']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 2,
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.3,
        lineColor: [0, 0, 0]
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 7,
        lineWidth: 0.5,
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: dateColWidth, halign: 'center', fontStyle: 'bold' },
        ...Object.fromEntries(
          Array.from({ length: 13 }, (_, i) => [i + 1, { cellWidth: timeSlotWidth, halign: 'center' }])
        ),
        14: { cellWidth: totalColWidth, halign: 'center', fontStyle: 'bold' },
        15: { cellWidth: uniqueColWidth, halign: 'center', fontStyle: 'bold' }
      },
      margin: { left: 12, right: 12 },
      didDrawPage: (data: any) => {
        // Add different top margin for subsequent pages
        if (data.pageNumber > 1) {
          data.settings.margin.top = 20
        } else {
          data.settings.margin.top = 52
        }
      },
      didDrawCell: (data: any) => {
        const rowIndex = data.row.index
        const colIndex = data.column.index
        const rowData = dailyData[rowIndex]

        // Skip header rows. Without this guard, a multi-day holiday
        // whose first day happens to be the first data row would
        // paint the holiday name over the header's "7:00 AM" cell.
        if (data.row.section !== 'body') return

        if (rowData && rowIndex < dailyData.length) {
          const isHoliday = rowData.holiday !== null && rowData.holiday !== undefined
          const holidayMeta = (tableData[rowIndex] as any)?._holidayMeta
          
          // Draw horizontal line in date column for multi-day holidays
          if (isHoliday && holidayMeta && holidayMeta.isMultiDay && colIndex === 0) {
            const nextRowData = dailyData[rowIndex + 1]
            const isNotLastDay = nextRowData && nextRowData.holiday && nextRowData.holiday?.name === rowData.holiday?.name
            
            if (isNotLastDay) {
              // Draw horizontal line at bottom of date cell
              const cell = data.cell
              this.doc.setDrawColor(0, 0, 0)
              this.doc.setLineWidth(0.3)
              this.doc.line(
                cell.x,
                cell.y + cell.height,
                cell.x + cell.width,
                cell.y + cell.height
              )
            }
          }
          
          // Vertically center holiday name for multi-day holidays
          if (isHoliday && holidayMeta && holidayMeta.isMultiDay && holidayMeta.isFirstDay && colIndex === 1) {
            const cell = data.cell
            const rowHeight = cell.height
            const totalDays = holidayMeta.totalDays
            const totalHeight = rowHeight * totalDays
            
            // Calculate center position
            const textY = cell.y + (totalHeight / 2) + 1.5 // Adjusted for better vertical centering
            
            // Draw centered text without background
            this.doc.setTextColor(0, 0, 0) // Black text
            this.doc.setFontSize(7)
            this.doc.setFont('helvetica', 'bold')
            this.doc.text(
              rowData.holiday?.name,
              cell.x + cell.width / 2,
              textY,
              { align: 'center', baseline: 'middle' }
            )
          }
        }
      },
      didParseCell: (data: any) => {
        const rowIndex = data.row.index
        const colIndex = data.column.index
        const rowData = dailyData[rowIndex]

        // Skip header rows. The "special day" merge (colSpan = 13) below
        // is a DATA-ROW feature -- without this guard the header cell at
        // column 1 inherits the first data row's day-of-week, which made
        // "7:00 AM" get replaced with "Sunday" whenever the first day of
        // the report was a Sunday.
        if (data.row.section !== 'body') return

        // Check if this is a special day (holiday or Sunday)
        if (rowData && rowIndex < dailyData.length) {
          const isHoliday = rowData.holiday !== null && rowData.holiday !== undefined
          const isSunday = rowData.dayOfWeek?.toLowerCase() === 'sunday'

          if (isHoliday || isSunday) {
            // Get multi-day holiday metadata from the row
            const holidayMeta = (tableData[rowIndex] as any)?._holidayMeta

            // For special days, merge all 13 time columns
            if (colIndex === 1) {
              data.cell.colSpan = 13
              data.cell.styles.halign = 'center'
              data.cell.styles.fontStyle = 'bold'

              if (isHoliday) {
                // Only show holiday name on first day of multi-day holiday
                if (!holidayMeta || holidayMeta.isFirstDay) {
                  data.cell.text = [rowData.holiday?.name || 'Holiday']
                } else {
                  // Subsequent days of multi-day holiday - show nothing but keep styling
                  data.cell.text = ['']
                }
              } else if (isSunday) {
                data.cell.text = ['Sunday']
              }
            } else if (colIndex > 1 && colIndex <= 14) {
              // Hide all time slot cells for special days (columns 2-14)
              data.cell.text = []
            }
            
            // Remove bottom border for non-last days of multi-day holidays
            if (isHoliday && holidayMeta && holidayMeta.isMultiDay && !holidayMeta.isFirstDay) {
              // This is a continuation row - remove top border
              data.cell.styles.lineWidth = { top: 0, right: 0.3, bottom: 0.3, left: 0.3 }
            } else if (isHoliday && holidayMeta && holidayMeta.isMultiDay && holidayMeta.isFirstDay) {
              // This is the first row of multi-day - remove bottom border
              data.cell.styles.lineWidth = { top: 0.3, right: 0.3, bottom: 0, left: 0.3 }
            }
            
            // For middle rows (not first, not last) remove both top and bottom
            if (isHoliday && holidayMeta && holidayMeta.isMultiDay) {
              const nextRowData = dailyData[rowIndex + 1]
              const isNotLastDay = nextRowData && nextRowData.holiday && nextRowData.holiday?.name === rowData.holiday?.name
              
              if (!holidayMeta.isFirstDay && isNotLastDay) {
                // Middle row
                data.cell.styles.lineWidth = { top: 0, right: 0.3, bottom: 0, left: 0.3 }
              } else if (!holidayMeta.isFirstDay && !isNotLastDay) {
                // Last row - show bottom border
                data.cell.styles.lineWidth = { top: 0, right: 0.3, bottom: 0.3, left: 0.3 }
              }
            }
          }
        }
        
        // Highlight TOTAL row
        if (rowIndex === tableData.length - 1) {
          data.cell.styles.fillColor = [240, 240, 240]
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fontSize = 8
        }
      }
    })

    // User Type Breakdown - positioned after the table
    const finalY = (this.doc as any).lastAutoTable.finalY + 8

    // Get user type stats
    const userTypeStats = data.userTypeStats || {}
    const totalUsers = (summary as any).totalUniqueUsers || Object.values(userTypeStats).reduce((sum: number, val) => sum + val, 0)

    // Left side - User Type Breakdown
    this.doc.setFontSize(8)
    this.doc.setFont('helvetica', 'normal')

    let currentY = finalY
    const leftX = 20

    Object.entries(userTypeStats).forEach(([type, count]) => {
      this.doc.text(`${type}`, leftX, currentY)
      this.doc.text(`${count}`, leftX + 40, currentY, { align: 'right' })
      currentY += 5
    })

    this.doc.setFont('helvetica', 'bold')
    this.doc.text('TOTAL', leftX, currentY)
    this.doc.text(`${totalUsers}`, leftX + 40, currentY, { align: 'right' })

    // Right side - Prepared by only, within page bounds
    const rightX = pageWidth - 70
    const preparedByY = finalY

    this.doc.setFontSize(8)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text('Prepared by:', rightX, preparedByY)

    this.doc.setFont('helvetica', 'bold')
    if (preparedBy) {
      this.doc.text(preparedBy, rightX, preparedByY + 8)
    }
  }

  generateStudentVisitsByDeptGrade(data: {
    byDepartment: Array<{ name: string; code?: string; count: number }>
    byGradeLevel: Array<{ name: string; education_level?: string; count: number }>
    totals?: { totalVisits: number }
  }, preparedBy: string = '', dateRangeTitle?: string): void {
    const pageWidth = this.doc.internal.pageSize.getWidth()
    const centerX = pageWidth / 2

    this.doc.setFontSize(11)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Divine Word College of Calapan', centerX, 15, { align: 'center' })
    this.doc.setFontSize(9)
    this.doc.text(this.libraryName, centerX, 21, { align: 'center' })
    this.doc.setFontSize(8)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text('Student Visits Report', centerX, 27, { align: 'center' })
    if (dateRangeTitle) {
      this.doc.text(`for ${dateRangeTitle}`, centerX, 32, { align: 'center' })
    }

    const totalVisits = data.totals?.totalVisits || data.byDepartment.reduce((s, d) => s + (d.count || 0), 0)

    const deptHead = [['Department', 'Code', 'Visits', 'Percentage']]
    const deptBody = data.byDepartment.map(d => [
      d.name,
      d.code || '',
      d.count,
      totalVisits > 0 ? `${((d.count / totalVisits) * 100).toFixed(1)}%` : '0.0%'
    ])

    autoTable(this.doc, {
      startY: 38,
      head: deptHead,
      body: deptBody,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.2 },
      headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold' },
    })

    const nextY = (this.doc as any).lastAutoTable.finalY + 8
    const gradeHead = [['Grade Level', 'Education Level', 'Visits', 'Percentage']]
    const totalGradeVisits = data.byGradeLevel.reduce((s, g) => s + (g.count || 0), 0)
    const gradeBody = data.byGradeLevel.map(g => [
      g.name,
      g.education_level || '',
      g.count,
      totalGradeVisits > 0 ? `${((g.count / totalGradeVisits) * 100).toFixed(1)}%` : '0.0%'
    ])

    autoTable(this.doc, {
      startY: nextY,
      head: gradeHead,
      body: gradeBody,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.2 },
      headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold' },
    })

    const finalY = (this.doc as any).lastAutoTable.finalY + 10
    this.doc.setFontSize(8)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(`Total Visits (logs): ${totalVisits}`, 20, finalY)
    if (preparedBy) {
      this.doc.text('Prepared by:', pageWidth - 70, finalY)
      this.doc.setFont('helvetica', 'bold')
      this.doc.text(preparedBy, pageWidth - 70, finalY + 6)
    }
  }

  generateUserTypeStatistics(data: ReportData, preparedBy: string = ''): void {
    const { month, year, userTypeStats, gradeLevelStats, summary } = data

    // New page for user statistics
    this.doc.addPage()

    const pageWidth = this.doc.internal.pageSize.getWidth()
    const pageHeight = this.doc.internal.pageSize.getHeight()
    const centerX = pageWidth / 2

    // Header - optimized for portrait
    this.doc.setFontSize(11)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Divine Word College of Calapan', centerX, 25, { align: 'center' })
    
    this.doc.setFontSize(9)
    this.doc.text(this.libraryName, centerX, 31, { align: 'center' })
    
    this.doc.setFontSize(8)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text("User Category Statistics", centerX, 37, { align: 'center' })
    this.doc.text(`for the month of ${this.monthNames[month - 1]}, ${year}`, centerX, 42, { align: 'center' })

    // User Type Table
    const totalForPercent = summary.totalUniqueUsers || summary.totalEntries || 0

    const userTypeData = Object.entries(userTypeStats).map(([type, count]) => {
      const percentage = totalForPercent > 0 ? ((count / totalForPercent) * 100).toFixed(1) + '%' : '0.0%'
      return [
        type,
        count.toString(),
        percentage
      ]
    })

    autoTable(this.doc, {
      startY: 50,
      head: [['User Type', 'Count', 'Percentage']],
      body: userTypeData,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [100, 150, 200],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { halign: 'center', cellWidth: 50 },
        2: { halign: 'center', cellWidth: 50 }
      }
    })

    // Grade Level Table (if applicable)
    if (Object.keys(gradeLevelStats).length > 0) {
      const gradeLevelData = Object.entries(gradeLevelStats).map(([grade, count]) => {
        const percentage = totalForPercent > 0 ? ((count / totalForPercent) * 100).toFixed(1) + '%' : '0.0%'
        return [
          grade,
          count.toString(),
          percentage
        ]
      })

      const startY = (this.doc as any).lastAutoTable.finalY + 15

      this.doc.setFontSize(10)
      this.doc.setFont('helvetica', 'bold')
      this.doc.text('Grade Level Distribution', 20, startY)

      autoTable(this.doc, {
        startY: startY + 5,
        head: [['Grade Level', 'Count', 'Percentage']],
        body: gradeLevelData,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 3
        },
        headStyles: {
          fillColor: [100, 200, 150],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { halign: 'center', cellWidth: 50 },
          2: { halign: 'center', cellWidth: 50 }
        }
      })
    }

    // Footer with page break handling
    const finalY = (this.doc as any).lastAutoTable.finalY + 10
    
    if (finalY + 15 > pageHeight - 20) {
      this.doc.addPage()
      const newPageY = 20
      if (preparedBy) {
        this.doc.setFontSize(8)
        this.doc.setFont('helvetica', 'normal')
        this.doc.text('Prepared by:', pageWidth - 70, newPageY)
        this.doc.setFont('helvetica', 'bold')
        this.doc.text(preparedBy, pageWidth - 70, newPageY + 6)
      }
    } else {
      if (preparedBy) {
        this.doc.setFontSize(8)
        this.doc.setFont('helvetica', 'normal')
        this.doc.text('Prepared by:', pageWidth - 70, finalY)
        this.doc.setFont('helvetica', 'bold')
        this.doc.text(preparedBy, pageWidth - 70, finalY + 6)
      }
    }
  }

  generateLockerUsageStatistics(data: LockerStatisticsReportData, preparedBy: string = '', dateRangeTitle?: string): void {
    const { month, year, dailyData, hourlyTotals, summary } = data

    // Header - optimized for portrait
    this.doc.setFontSize(11)
    this.doc.setFont('helvetica', 'bold')
    const pageWidth = this.doc.internal.pageSize.getWidth()
    const pageHeight = this.doc.internal.pageSize.getHeight()
    const centerX = pageWidth / 2
    
    this.doc.text('Divine Word College of Calapan', centerX, 15, { align: 'center' })
    
    this.doc.setFontSize(9)
    this.doc.text(this.libraryName, centerX, 21, { align: 'center' })
    
    this.doc.setFontSize(8)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text("Locker Users' Statistics", centerX, 27, { align: 'center' })
    this.doc.text(`for ${dateRangeTitle || `the month of ${this.monthNames[month - 1]}, ${year}`}`, centerX, 32, { align: 'center' })

    // Prepare time slots (7 AM to 7 PM)
    const timeSlots = [
      '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 NN',
      '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'
    ]

    // Prepare table data with multi-day holiday tracking
    const tableData: any[] = []
    const columnTotals: number[] = new Array(13).fill(0)
    const uniqueTotalsPerDay: number[] = []
    
    // Track multi-day holidays
    const multiDayHolidays = new Map<string, number[]>() // holidayName -> array of day indices
    
    // First pass: identify multi-day holidays
    dailyData.forEach((day: any, index: number) => {
      const isHoliday = day.holiday !== null && day.holiday !== undefined
      if (isHoliday) {
        const holidayName = day.holiday.name
        if (!multiDayHolidays.has(holidayName)) {
          multiDayHolidays.set(holidayName, [])
        }
        multiDayHolidays.get(holidayName)!.push(index)
      }
    })

    dailyData.forEach((day: any, index: number) => {
      const isHoliday = day.holiday !== null && day.holiday !== undefined
      const dayOfWeek = day.dayOfWeek || ''
      const isSunday = dayOfWeek.toLowerCase() === 'sunday'
      
      const row: any[] = [day.dayOfMonth.toString()]

      let dayTotal = 0
      let dayUnique = 0
      // Add hourly data (7 AM = hour 7, to 7 PM = hour 19)
      for (let hour = 7; hour <= 19; hour++) {
        const count = day.hours[hour] || 0
        if (isHoliday || isSunday) {
          row.push('')
        } else {
          row.push(count)
          dayTotal += count
          columnTotals[hour - 7] += count
        }
      }

      if (isHoliday || isSunday) {
        row.push('') // Total column
        row.push('') // UNIQUE column
      } else {
        // Total visits (sum of all hourly counts for the day)
        row.push(dayTotal)

        // Unique people for the day
        dayUnique = typeof day.uniqueCount === 'number' ? day.uniqueCount : dayTotal
        row.push(dayUnique)
        uniqueTotalsPerDay.push(dayUnique)
      }
      
      // Store metadata for multi-day holiday detection
      if (isHoliday) {
        const holidayName = day.holiday.name
        const dayIndices = multiDayHolidays.get(holidayName)!
        const isFirstDayOfHoliday = dayIndices[0] === index
        const isMultiDay = dayIndices.length > 1
        ;(row as any)._holidayMeta = {
          isFirstDay: isFirstDayOfHoliday,
          isMultiDay: isMultiDay,
          totalDays: dayIndices.length
        }
      }
      
      tableData.push(row)
    })

    // Add TOTAL row
    const totalsRow: any[] = ['TOTAL']
    let grandTotal = 0
    columnTotals.forEach(total => {
      totalsRow.push(total)
      grandTotal += total
    })

    // Grand total for TOTAL column (sum of per-day totals)
    totalsRow.push(grandTotal)

    // Grand total for UNIQUE column (sum of per-day unique counts)
    const grandUniqueTotal = uniqueTotalsPerDay.reduce((sum, v) => sum + v, 0)
    totalsRow.push(grandUniqueTotal)
    tableData.push(totalsRow)

    // Column widths optimized for portrait. UNIQUE column is wide
    // enough that the header text doesn't wrap to "UNIQU / E".
    const dateColWidth = 20
    const timeSlotWidth = 9.5
    const totalColWidth = 13
    const uniqueColWidth = 18

    // Generate table
    autoTable(this.doc, {
      startY: 38,
      head: [['Time & Date', ...timeSlots, 'Total', 'UNIQUE']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 2,
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.3,
        lineColor: [0, 0, 0]
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 7,
        lineWidth: 0.5,
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: dateColWidth, halign: 'center', fontStyle: 'bold' },
        ...Object.fromEntries(
          Array.from({ length: 13 }, (_, i) => [i + 1, { cellWidth: timeSlotWidth, halign: 'center' }])
        ),
        14: { cellWidth: totalColWidth, halign: 'center', fontStyle: 'bold' },
        15: { cellWidth: uniqueColWidth, halign: 'center', fontStyle: 'bold' }
      },
      margin: { left: 12, right: 12 },
      didDrawPage: (data: any) => {
        // Add different top margin for subsequent pages
        if (data.pageNumber > 1) {
          data.settings.margin.top = 20
        } else {
          data.settings.margin.top = 52
        }
      },
      didDrawCell: (data: any) => {
        const rowIndex = data.row.index
        const colIndex = data.column.index
        const rowData = dailyData[rowIndex]

        // Skip header rows. Without this guard, a multi-day holiday
        // whose first day happens to be the first data row would
        // paint the holiday name over the header's "7:00 AM" cell.
        if (data.row.section !== 'body') return

        if (rowData && rowIndex < dailyData.length) {
          const isHoliday = rowData.holiday !== null && rowData.holiday !== undefined
          const holidayMeta = (tableData[rowIndex] as any)?._holidayMeta
          
          // Draw horizontal line in date column for multi-day holidays
          if (isHoliday && holidayMeta && holidayMeta.isMultiDay && colIndex === 0) {
            const nextRowData = dailyData[rowIndex + 1]
            const isNotLastDay = nextRowData && nextRowData.holiday && nextRowData.holiday?.name === rowData.holiday?.name
            
            if (isNotLastDay) {
              // Draw horizontal line at bottom of date cell
              const cell = data.cell
              this.doc.setDrawColor(0, 0, 0)
              this.doc.setLineWidth(0.3)
              this.doc.line(
                cell.x,
                cell.y + cell.height,
                cell.x + cell.width,
                cell.y + cell.height
              )
            }
          }
          
          // Vertically center holiday name for multi-day holidays
          if (isHoliday && holidayMeta && holidayMeta.isMultiDay && holidayMeta.isFirstDay && colIndex === 1) {
            const cell = data.cell
            const rowHeight = cell.height
            const totalDays = holidayMeta.totalDays
            const totalHeight = rowHeight * totalDays
            
            // Calculate center position
            const textY = cell.y + (totalHeight / 2) + 1.5 // Adjusted for better vertical centering
            
            // Draw centered text without background
            this.doc.setTextColor(0, 0, 0) // Black text
            this.doc.setFontSize(7)
            this.doc.setFont('helvetica', 'bold')
            this.doc.text(
              rowData.holiday?.name,
              cell.x + cell.width / 2,
              textY,
              { align: 'center', baseline: 'middle' }
            )
          }
        }
      },
      didParseCell: (data: any) => {
        const rowIndex = data.row.index
        const colIndex = data.column.index
        const rowData = dailyData[rowIndex]

        // Skip header rows. The "special day" merge (colSpan = 13) below
        // is a DATA-ROW feature -- without this guard the header cell at
        // column 1 inherits the first data row's day-of-week, which made
        // "7:00 AM" get replaced with "Sunday" whenever the first day of
        // the report was a Sunday.
        if (data.row.section !== 'body') return

        // Check if this is a special day (holiday or Sunday)
        if (rowData && rowIndex < dailyData.length) {
          const isHoliday = rowData.holiday !== null && rowData.holiday !== undefined
          const isSunday = rowData.dayOfWeek?.toLowerCase() === 'sunday'

          if (isHoliday || isSunday) {
            // Get multi-day holiday metadata from the row
            const holidayMeta = (tableData[rowIndex] as any)?._holidayMeta

            // For special days, merge all 13 time columns
            if (colIndex === 1) {
              data.cell.colSpan = 13
              data.cell.styles.halign = 'center'
              data.cell.styles.fontStyle = 'bold'

              if (isHoliday) {
                // Only show holiday name on first day of multi-day holiday
                if (!holidayMeta || holidayMeta.isFirstDay) {
                  data.cell.text = [rowData.holiday?.name || 'Holiday']
                } else {
                  // Subsequent days of multi-day holiday - show nothing but keep styling
                  data.cell.text = ['']
                }
              } else if (isSunday) {
                data.cell.text = ['Sunday']
              }
            } else if (colIndex > 1 && colIndex <= 14) {
              // Hide all time slot cells for special days (columns 2-14)
              data.cell.text = []
            }
            
            // Remove bottom border for non-last days of multi-day holidays
            if (isHoliday && holidayMeta && holidayMeta.isMultiDay && !holidayMeta.isFirstDay) {
              // This is a continuation row - remove top border
              data.cell.styles.lineWidth = { top: 0, right: 0.3, bottom: 0.3, left: 0.3 }
            } else if (isHoliday && holidayMeta && holidayMeta.isMultiDay && holidayMeta.isFirstDay) {
              // This is the first row of multi-day - remove bottom border
              data.cell.styles.lineWidth = { top: 0.3, right: 0.3, bottom: 0, left: 0.3 }
            }
            
            // For middle rows (not first, not last) remove both top and bottom
            if (isHoliday && holidayMeta && holidayMeta.isMultiDay) {
              const nextRowData = dailyData[rowIndex + 1]
              const isNotLastDay = nextRowData && nextRowData.holiday && nextRowData.holiday?.name === rowData.holiday?.name
              
              if (!holidayMeta.isFirstDay && isNotLastDay) {
                // Middle row
                data.cell.styles.lineWidth = { top: 0, right: 0.3, bottom: 0, left: 0.3 }
              } else if (!holidayMeta.isFirstDay && !isNotLastDay) {
                // Last row - show bottom border
                data.cell.styles.lineWidth = { top: 0, right: 0.3, bottom: 0.3, left: 0.3 }
              }
            }
          }
        }
        
        // Highlight TOTAL row
        if (rowIndex === tableData.length - 1) {
          data.cell.styles.fillColor = [240, 240, 240]
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fontSize = 8
        }
      }
    })

    // User Type Breakdown - positioned after the table
    const finalY = (this.doc as any).lastAutoTable.finalY + 8

    // Get user type stats
    const userTypeStats = data.userTypeStats || {}
    const totalUsers = (summary as any).totalUniqueUsers || Object.values(userTypeStats).reduce((sum: number, val) => sum + val, 0)

    // Left side - User Type Breakdown
    this.doc.setFontSize(8)
    this.doc.setFont('helvetica', 'normal')

    let currentY = finalY
    const leftX = 20

    Object.entries(userTypeStats).forEach(([type, count]) => {
      this.doc.text(`${type}`, leftX, currentY)
      this.doc.text(`${count}`, leftX + 50, currentY, { align: 'right' })
      currentY += 5
    })

    this.doc.setFont('helvetica', 'bold')
    this.doc.text('TOTAL', leftX, currentY)
    this.doc.text(`${totalUsers}`, leftX + 50, currentY, { align: 'right' })

    // Right side - Prepared by only, within page bounds
    const rightX = pageWidth - 70
    const preparedByY = finalY

    this.doc.setFontSize(8)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text('Prepared by:', rightX, preparedByY)

    this.doc.setFont('helvetica', 'bold')
    if (preparedBy) {
      this.doc.text(preparedBy, rightX, preparedByY + 8)
    }
  }

  generateEntranceExitStatistics(data: EntranceExitReportData, preparedBy: string = '', dateRangeTitle?: string): void {
    const { month, year, timeRangeData, summary } = data

    // Header
    this.doc.setFontSize(11)
    this.doc.setFont('helvetica', 'bold')
    const pageWidth = this.doc.internal.pageSize.getWidth()
    const centerX = pageWidth / 2
    
    this.doc.text('DIVINE WORD COLLEGE OF CALAPAN', centerX, 15, { align: 'center' })
    
    this.doc.setFontSize(9)
    this.doc.text(this.libraryName, centerX, 21, { align: 'center' })
    
    this.doc.setFontSize(8)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text('ATTENDANCE REPORT', centerX, 27, { align: 'center' })
    
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('ENTRANCE / EXIT CONTROL', centerX, 32, { align: 'center' })
    
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(`for ${dateRangeTitle || `the month of ${this.monthNames[month - 1]}, ${year}`}`, centerX, 37, { align: 'center' })

    // Prepare table data
    const tableData = timeRangeData.map(range => [
      range.timeRange,
      range.admin || '',
      range.faculty || '',
      range.employee || '',
      range.guest || '',
      range.alumni || '',
      range.basicEducation || '',
      range.collegeStudents || '',
      range.total
    ])

    // Add totals row
    const totals = timeRangeData.reduce(
      (acc, range) => ({
        admin: acc.admin + range.admin,
        faculty: acc.faculty + range.faculty,
        employee: acc.employee + range.employee,
        guest: acc.guest + range.guest,
        alumni: acc.alumni + range.alumni,
        basicEducation: acc.basicEducation + range.basicEducation,
        collegeStudents: acc.collegeStudents + range.collegeStudents,
        total: acc.total + range.total,
      }),
      { admin: 0, faculty: 0, employee: 0, guest: 0, alumni: 0, basicEducation: 0, collegeStudents: 0, total: 0 }
    )

    tableData.push([
      'TOTAL',
      totals.admin,
      totals.faculty,
      totals.employee,
      totals.guest,
      totals.alumni,
      totals.basicEducation,
      totals.collegeStudents,
      totals.total
    ])

    // Column widths optimized for portrait with 7 user type columns
    const timeColWidth = 22
    const userTypeColWidth = 18
    const totalColWidth = 18

    // Generate table
    autoTable(this.doc, {
      startY: 43,
      head: [[
        'TIME',
        'ADMIN',
        'FACULTY',
        'EMPLOYEE',
        'GUEST',
        'ALUMNI',
        'BASIC\nEDUCATION\nSTUDENTS',
        'COLLEGE\nSTUDENTS',
        'TOTAL'
      ]],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 2,
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.3,
        lineColor: [0, 0, 0]
      },
      headStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 6.5,
        lineWidth: 0.5,
        halign: 'center',
        minCellHeight: 12
      },
      columnStyles: {
        0: { cellWidth: timeColWidth, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: userTypeColWidth, halign: 'center' },
        2: { cellWidth: userTypeColWidth, halign: 'center' },
        3: { cellWidth: userTypeColWidth, halign: 'center' },
        4: { cellWidth: userTypeColWidth, halign: 'center' },
        5: { cellWidth: userTypeColWidth, halign: 'center' },
        6: { cellWidth: userTypeColWidth, halign: 'center' },
        7: { cellWidth: userTypeColWidth, halign: 'center' },
        8: { cellWidth: totalColWidth, halign: 'center', fontStyle: 'bold' }
      },
      margin: { left: 10, right: 10 },
      didParseCell: (data: any) => {
        // Highlight TOTAL row
        if (data.row.index === tableData.length - 1 && data.row.section === 'body') {
          data.cell.styles.fillColor = [240, 240, 240]
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fontSize = 8
        }
      }
    })

    // Footer
    const finalY = (this.doc as any).lastAutoTable.finalY + 10

    this.doc.setFontSize(8)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(`Total Entries: ${summary.totalEntries}`, 20, finalY)
    this.doc.text(`Peak Time Range: ${summary.peakTimeRange}`, 20, finalY + 5)
    this.doc.text(`Average Per Hour: ${summary.averagePerHour}`, 20, finalY + 10)

    if (preparedBy) {
      this.doc.text('Prepared by:', pageWidth - 70, finalY)
      this.doc.setFont('helvetica', 'bold')
      this.doc.text(preparedBy, pageWidth - 70, finalY + 6)
    }
  }

  generateUsersPerTransactionStatistics(data: ReportData, preparedBy: string = '', dateRangeTitle?: string): void {
    const { month, year, dailyData, hourlyTotals, summary } = data

    // Header - optimized for portrait
    this.doc.setFontSize(11)
    this.doc.setFont('helvetica', 'bold')
    const pageWidth = this.doc.internal.pageSize.getWidth()
    const pageHeight = this.doc.internal.pageSize.getHeight()
    const centerX = pageWidth / 2
    
    this.doc.text('Divine Word College of Calapan', centerX, 15, { align: 'center' })
    
    this.doc.setFontSize(9)
    this.doc.text(this.libraryName, centerX, 21, { align: 'center' })
    
    this.doc.setFontSize(8)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text("User Entry Transactions Statistics", centerX, 27, { align: 'center' })
    this.doc.text(`for ${dateRangeTitle || `the month of ${this.monthNames[month - 1]}, ${year}`}`, centerX, 32, { align: 'center' })

    // Prepare time slots (7 AM to 7 PM)
    const timeSlots = [
      '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 NN',
      '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'
    ]

    // Prepare table data with multi-day holiday tracking
    const tableData: any[] = []
    const columnTotals: number[] = new Array(13).fill(0)
    const uniqueTotalsPerDay: number[] = []
    
    // Track multi-day holidays
    const multiDayHolidays = new Map<string, number[]>() // holidayName -> array of day indices
    
    // First pass: identify multi-day holidays
    dailyData.forEach((day: any, index: number) => {
      const isHoliday = day.holiday !== null && day.holiday !== undefined
      if (isHoliday) {
        const holidayName = day.holiday.name
        if (!multiDayHolidays.has(holidayName)) {
          multiDayHolidays.set(holidayName, [])
        }
        multiDayHolidays.get(holidayName)!.push(index)
      }
    })

    dailyData.forEach((day: any, index: number) => {
      const isHoliday = day.holiday !== null && day.holiday !== undefined
      const dayOfWeek = day.dayOfWeek || ''
      const isSunday = dayOfWeek.toLowerCase() === 'sunday'
      
      // Format date with month abbreviation (e.g., \"Jan 1\")
      const dayDate = new Date(day.date)
      const monthAbbr = this.monthNames[dayDate.getMonth()].substring(0, 3)
      const dateDisplay = `${monthAbbr} ${day.dayOfMonth}`
      
      const row: any[] = [dateDisplay]

      let dayTotal = 0
      let dayUnique = 0
      // Add hourly data (7 AM = hour 7, to 7 PM = hour 19)
      for (let hour = 7; hour <= 19; hour++) {
        const count = day.hours[hour] || 0
        if (isHoliday || isSunday) {
          row.push('')
        } else {
          row.push(count)
          dayTotal += count
          columnTotals[hour - 7] += count
        }
      }

      if (isHoliday || isSunday) {
        row.push('') // Total column
        row.push('') // UNIQUE column
      } else {
        // Total entries (sum of all hourly counts for the day)
        row.push(dayTotal)

        // Unique users for the day
        dayUnique = typeof day.uniqueCount === 'number' ? day.uniqueCount : dayTotal
        row.push(dayUnique)
        uniqueTotalsPerDay.push(dayUnique)
      }
      
      // Store metadata for multi-day holiday detection
      if (isHoliday) {
        const holidayName = day.holiday.name
        const dayIndices = multiDayHolidays.get(holidayName)!
        const isFirstDayOfHoliday = dayIndices[0] === index
        const isMultiDay = dayIndices.length > 1
        ;(row as any)._holidayMeta = {
          isFirstDay: isFirstDayOfHoliday,
          isMultiDay: isMultiDay,
          totalDays: dayIndices.length
        }
      }
      
      tableData.push(row)
    })

    // Add TOTAL row
    const totalsRow: any[] = ['TOTAL']
    let grandTotal = 0
    columnTotals.forEach(total => {
      totalsRow.push(total)
      grandTotal += total
    })
    totalsRow.push(grandTotal)
    
    // Total unique users
    const totalUnique = uniqueTotalsPerDay.reduce((sum, val) => sum + val, 0)
    totalsRow.push(totalUnique)
    
    tableData.push(totalsRow)

    // Add AVERAGE row
    const averagesRow: any[] = ['AVERAGE']
    const daysInMonth = dailyData.length
    columnTotals.forEach(total => {
      const average = Math.round(total / daysInMonth)
      averagesRow.push(average)
    })
    averagesRow.push(Math.round(grandTotal / daysInMonth))
    averagesRow.push(Math.round(totalUnique / daysInMonth))
    tableData.push(averagesRow)

    // Column widths. UNIQUE column is wide enough that the header
    // text doesn't wrap to "UNIQU / E".
    const dateColWidth = 18
    const timeSlotWidth = 9.5
    const totalColWidth = 13
    const uniqueColWidth = 18

    const columnWidths = [
      dateColWidth,
      ...Array(13).fill(timeSlotWidth),
      totalColWidth,
      uniqueColWidth
    ]

    // Generate table
    autoTable(this.doc, {
      startY: 38,
      head: [['Time & Date', ...timeSlots, 'Total', 'UNIQUE']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 2,
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.3,
        lineColor: [0, 0, 0]
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 7,
        lineWidth: 0.5,
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: dateColWidth, halign: 'center', fontStyle: 'bold' },
        ...Object.fromEntries(
          Array.from({ length: 13 }, (_, i) => [i + 1, { cellWidth: timeSlotWidth, halign: 'center' }])
        ),
        14: { cellWidth: totalColWidth, halign: 'center', fontStyle: 'bold' },
        15: { cellWidth: uniqueColWidth, halign: 'center', fontStyle: 'bold' }
      },
      margin: { left: 12, right: 12 },
      didDrawPage: (data: any) => {
        if (data.pageNumber > 1) {
          data.settings.margin.top = 20
        } else {
          data.settings.margin.top = 52
        }
      },
      didDrawCell: (data: any) => {
        const rowIndex = data.row.index
        const colIndex = data.column.index
        const rowData = dailyData[rowIndex]

        // Skip header rows. Without this guard, a multi-day holiday
        // whose first day happens to be the first data row would
        // paint the holiday name over the header's "7:00 AM" cell.
        if (data.row.section !== 'body') return

        if (rowData && rowIndex < dailyData.length) {
          const isHoliday = rowData.holiday !== null && rowData.holiday !== undefined
          const holidayMeta = (tableData[rowIndex] as any)?._holidayMeta
          
          // Draw horizontal line in date column for multi-day holidays
          if (isHoliday && holidayMeta && holidayMeta.isMultiDay && colIndex === 0) {
            const nextrowData = dailyData[rowIndex + 1]
            const isNotLastDay = nextrowData && nextrowData.holiday && nextrowData.holiday.name === rowData.holiday?.name
            
            if (isNotLastDay) {
              const cell = data.cell
              this.doc.setDrawColor(0, 0, 0)
              this.doc.setLineWidth(0.3)
              this.doc.line(
                cell.x,
                cell.y + cell.height,
                cell.x + cell.width,
                cell.y + cell.height
              )
            }
          }
          
          // Vertically center holiday name for multi-day holidays
          if (isHoliday && holidayMeta && holidayMeta.isMultiDay && holidayMeta.isFirstDay && colIndex === 1) {
            const cell = data.cell
            const rowHeight = cell.height
            const totalDays = holidayMeta.totalDays
            const totalHeight = rowHeight * totalDays
            
            const textY = cell.y + (totalHeight / 2) + 1.5
            
            this.doc.setTextColor(0, 0, 0)
            this.doc.setFontSize(7)
            this.doc.setFont('helvetica', 'bold')
            this.doc.text(
              rowData.holiday?.name || '',
              cell.x + cell.width / 2,
              textY,
              { align: 'center', baseline: 'middle' }
            )
          }
        }
      },
      didParseCell: (data: any) => {
        const rowIndex = data.row.index
        const colIndex = data.column.index
        const rowData = dailyData[rowIndex]

        // Skip header rows. The "special day" merge (colSpan = 15) below
        // is a DATA-ROW feature -- without this guard the header cell at
        // column 1 inherits the first data row's day-of-week, which made
        // "7:00 AM" get replaced with "SUNDAY" whenever the first day of
        // the report was a Sunday.
        if (data.row.section !== 'body') return

        if (rowData && rowIndex < dailyData.length) {
          const isHoliday = rowData.holiday !== null && rowData.holiday !== undefined
          const dayOfWeek = rowData.dayOfWeek || ''
          const isSunday = dayOfWeek.toLowerCase() === 'sunday'

          if (isHoliday || isSunday) {
            if (colIndex >= 1 && colIndex <= 15) {
              const holidayMeta = (tableData[rowIndex] as any)?._holidayMeta
              const isMultiDay = holidayMeta?.isMultiDay || false
              const isFirstDay = holidayMeta?.isFirstDay || false

              if (isHoliday && isMultiDay) {
                if (colIndex === 1 && isFirstDay) {
                  data.cell.styles.fillColor = [255, 200, 200]
                  data.cell.colSpan = 15
                } else if (colIndex > 1 || !isFirstDay) {
                  if (!isFirstDay) {
                    data.cell.styles.fillColor = [255, 200, 200]
                    if (colIndex === 1) {
                      data.cell.colSpan = 15
                    }
                  }
                }
              } else if (isSunday && colIndex === 1) {
                data.cell.styles.fillColor = [255, 255, 200]
                data.cell.colSpan = 15
                data.cell.text = ['SUNDAY']
              } else if (isHoliday && !isMultiDay && colIndex === 1) {
                data.cell.styles.fillColor = [255, 200, 200]
                data.cell.colSpan = 15
                data.cell.text = [rowData.holiday?.name ?? 'Holiday']
              }
            }
          }
        }

        const lastTwoRows = tableData.length - 2
        if (rowIndex >= lastTwoRows) {
          data.cell.styles.fontStyle = 'bold'
          if (rowIndex === tableData.length - 2) {
            data.cell.styles.fillColor = [255, 255, 255]
          } else {
            data.cell.styles.fillColor = [240, 240, 240]
          }
        }
      }
      // NOTE: the previous `willDrawCell` callback that drew "SUNDAY"
      // and `return false`-ed has been removed. It was redundant with
      // the didParseCell merge above and was the source of TWO bugs:
      //   1. It fired for the HEADER row too (no guard) and overwrote
      //      the "7:00 AM" header cell with "SUNDAY" (then returned
      //      false to suppress the default "7:00 AM" rendering).
      //   2. The `return false` for the date column of Sunday rows
      //      suppressed the cell's borders too, leaving the date
      //      column borderless on Sunday rows.
      // The didParseCell above already sets colSpan=15 + cell.text
      // for the merged Sunday/holiday cells, so the default renderer
      // draws them correctly with full borders.
    })

    if (preparedBy) {
      const finalY = (this.doc as any).lastAutoTable.finalY + 10
      this.doc.setFontSize(8)
      this.doc.setFont('helvetica', 'normal')
      this.doc.text('Prepared by:', pageWidth - 70, finalY)
      this.doc.setFont('helvetica', 'bold')
      this.doc.text(preparedBy, pageWidth - 70, finalY + 6)
    }
  }

  generateLockerConcurrentStatistics(data: LockerStatisticsReportData, preparedBy: string = '', dateRangeTitle?: string): void {
    const { month, year, dailyData, hourlyTotals, summary } = data

    // Header
    this.doc.setFontSize(11)
    this.doc.setFont('helvetica', 'bold')
    const pageWidth = this.doc.internal.pageSize.getWidth()
    const centerX = pageWidth / 2
    
    this.doc.text('Divine Word College of Calapan', centerX, 15, { align: 'center' })
    
    this.doc.setFontSize(9)
    this.doc.text(this.libraryName, centerX, 21, { align: 'center' })
    
    this.doc.setFontSize(8)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text("Locker Concurrent Usage Statistics", centerX, 27, { align: 'center' })
    this.doc.text(`for ${dateRangeTitle || `the month of ${this.monthNames[month - 1]}, ${year}`}`, centerX, 32, { align: 'center' })

    // Prepare time slots (7 AM to 7 PM)
    const timeSlots = [
      '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 NN',
      '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'
    ]

    // Prepare table data
    const tableData: any[] = []
    const columnTotals: number[] = new Array(13).fill(0)
    const uniqueTotalsPerDay: number[] = []
    
    // Track multi-day holidays
    const multiDayHolidays = new Map<string, { indices: number[], name: string }>()
    
    dailyData.forEach((day: any, index: number) => {
      const isHoliday = day.holiday !== null && day.holiday !== undefined
      if (isHoliday) {
        const holidayName = day.holiday.name
        if (!multiDayHolidays.has(holidayName)) {
          multiDayHolidays.set(holidayName, { indices: [], name: holidayName })
        }
        multiDayHolidays.get(holidayName)!.indices.push(index)
      }
    })

    dailyData.forEach((day: any, index: number) => {
      const isHoliday = day.holiday !== null && day.holiday !== undefined
      const dayOfWeek = day.dayOfWeek || ''
      const isSunday = dayOfWeek.toLowerCase() === 'sunday'
      
      // Format date with month abbreviation (e.g., \"Jan 1\")
      const dayDate = new Date(day.date)
      const monthAbbr = this.monthNames[dayDate.getMonth()].substring(0, 3)
      const dateDisplay = `${monthAbbr} ${day.dayOfMonth}`
      
      const row: any[] = [dateDisplay]

      let dayTotal = 0
      for (let hour = 7; hour <= 19; hour++) {
        const count = day.hours[hour] || 0
        if (isHoliday || isSunday) {
          row.push('')
        } else {
          row.push(count)
          dayTotal += count
          columnTotals[hour - 7] += count
        }
      }

      if (isHoliday || isSunday) {
        row.push('')
        row.push('')
      } else {
        row.push(dayTotal)
        const dayUnique = typeof day.uniqueCount === 'number' ? day.uniqueCount : 0
        row.push(dayUnique)
        uniqueTotalsPerDay.push(dayUnique)
      }
      
      // Attach multi-day holiday metadata
      if (isHoliday) {
        const holidayName = day.holiday.name
        const holidayInfo = multiDayHolidays.get(holidayName)!
        const isFirstDayOfHoliday = holidayInfo.indices[0] === index
        const isMultiDay = holidayInfo.indices.length > 1
        ;(row as any)._holidayMeta = {
          isFirstDay: isFirstDayOfHoliday,
          isMultiDay: isMultiDay,
          totalDays: holidayInfo.indices.length
        }
      }
      
      tableData.push(row)
    })

    // Add TOTAL row
    const totalsRow: any[] = ['TOTAL']
    let grandTotal = 0
    columnTotals.forEach(total => {
      totalsRow.push(total)
      grandTotal += total
    })
    totalsRow.push(grandTotal)
    totalsRow.push(uniqueTotalsPerDay.reduce((sum, val) => sum + val, 0))
    tableData.push(totalsRow)

    // Add AVERAGE row
    const averagesRow: any[] = ['AVERAGE']
    const daysInMonth = dailyData.length
    columnTotals.forEach(total => {
      averagesRow.push(Math.round(total / daysInMonth))
    })
    averagesRow.push(Math.round(grandTotal / daysInMonth))
    averagesRow.push(Math.round(uniqueTotalsPerDay.reduce((sum, val) => sum + val, 0) / daysInMonth))
    tableData.push(averagesRow)

    const dateColWidth = 18
    const timeSlotWidth = 9.5
    const totalColWidth = 13
    const uniqueColWidth = 18 // UNIQUE column (widened to fit 'UNIQUE' without wrap)

    const columnWidths = [
      dateColWidth,
      ...Array(13).fill(timeSlotWidth),
      totalColWidth,
      uniqueColWidth
    ]

    // Generate table
    autoTable(this.doc, {
      startY: 38,
      head: [['Time & Date', ...timeSlots, 'Total', 'UNIQUE']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 2,
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.3,
        lineColor: [0, 0, 0]
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 7,
        lineWidth: 0.5,
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: dateColWidth, halign: 'center', fontStyle: 'bold' },
        ...Object.fromEntries(
          Array.from({ length: 13 }, (_, i) => [i + 1, { cellWidth: timeSlotWidth, halign: 'center' }])
        ),
        14: { cellWidth: totalColWidth, halign: 'center', fontStyle: 'bold' },
        15: { cellWidth: uniqueColWidth, halign: 'center', fontStyle: 'bold' }
      },
      margin: { left: 12, right: 12 },
      didDrawPage: (data: any) => {
        if (data.pageNumber > 1) {
          data.settings.margin.top = 20
        } else {
          data.settings.margin.top = 52
        }
      },
      didDrawCell: (data: any) => {
        const rowIndex = data.row.index
        const colIndex = data.column.index
        const rowData = dailyData[rowIndex]

        // Skip header rows. Without this guard, a multi-day holiday
        // whose first day happens to be the first data row would
        // paint the holiday name over the header's "7:00 AM" cell.
        if (data.row.section !== 'body') return

        if (rowData && rowIndex < dailyData.length) {
          const isHoliday = rowData.holiday !== null && rowData.holiday !== undefined
          const holidayMeta = (tableData[rowIndex] as any)?._holidayMeta
          
          // Draw border between consecutive days of multi-day holiday (on date column)
          if (isHoliday && holidayMeta && holidayMeta.isMultiDay && colIndex === 0) {
            const nextrowData = dailyData[rowIndex + 1]
            const isNotLastDay = nextrowData && nextrowData.holiday && nextrowData.holiday.name === rowData.holiday?.name
            
            if (isNotLastDay) {
              const cell = data.cell
              this.doc.setDrawColor(0, 0, 0)
              this.doc.setLineWidth(0.3)
              this.doc.line(
                cell.x,
                cell.y + cell.height,
                cell.x + cell.width,
                cell.y + cell.height
              )
            }
          }
          
          // Remove borders between rows for multi-day holiday merged cells
          if (isHoliday && holidayMeta && holidayMeta.isMultiDay && colIndex >= 1 && colIndex <= 15) {
            const nextrowData = dailyData[rowIndex + 1]
            const isNotLastDay = nextrowData && nextrowData.holiday && nextrowData.holiday.name === rowData.holiday?.name
            
            if (isNotLastDay) {
              const cell = data.cell
              this.doc.setDrawColor(255, 255, 255)
              this.doc.setLineWidth(0.3)
              this.doc.line(
                cell.x,
                cell.y + cell.height,
                cell.x + cell.width,
                cell.y + cell.height
              )
            }
          }
        }
      },
      didParseCell: (data: any) => {
        const rowIndex = data.row.index
        const colIndex = data.column.index
        const rowData = dailyData[rowIndex]

        // Skip header rows. The "special day" merge (colSpan = 15) below
        // is a DATA-ROW feature -- without this guard the header cell at
        // column 1 inherits the first data row's day-of-week, which made
        // "7:00 AM" get replaced with "SUNDAY" whenever the first day of
        // the report was a Sunday.
        if (data.row.section !== 'body') return

        if (rowData && rowIndex < dailyData.length) {
          const isHoliday = rowData.holiday !== null && rowData.holiday !== undefined
          const dayOfWeek = rowData.dayOfWeek || ''
          const isSunday = dayOfWeek.toLowerCase() === 'sunday'

          if (isHoliday || isSunday) {
            if (colIndex >= 1 && colIndex <= 15) {
              const holidayMeta = (tableData[rowIndex] as any)?._holidayMeta
              const isMultiDay = holidayMeta?.isMultiDay || false
              const isFirstDay = holidayMeta?.isFirstDay || false

              if (isHoliday && isMultiDay) {
                if (colIndex === 1 && isFirstDay) {
                  data.cell.colSpan = 15
                  data.cell.styles.halign = 'center'
                  data.cell.styles.valign = 'middle'
                  data.cell.text = [rowData.holiday?.name ?? 'Holiday']
                } else if (colIndex > 1 || !isFirstDay) {
                  if (!isFirstDay && colIndex === 1) {
                    data.cell.colSpan = 15
                    data.cell.styles.halign = 'center'
                    data.cell.styles.valign = 'middle'
                  }
                }
              } else if (isSunday && colIndex === 1) {
                data.cell.styles.fillColor = [255, 255, 200]
                data.cell.colSpan = 15
                data.cell.styles.halign = 'center'
                data.cell.styles.valign = 'middle'
                data.cell.text = ['SUNDAY']
              } else if (isHoliday && !isMultiDay && colIndex === 1) {
                data.cell.colSpan = 15
                data.cell.styles.halign = 'center'
                data.cell.styles.valign = 'middle'
                data.cell.text = [rowData.holiday?.name ?? 'Holiday']
              }
            }
          }
        }

        const lastTwoRows = tableData.length - 2
        if (rowIndex >= lastTwoRows) {
          data.cell.styles.fontStyle = 'bold'
          if (rowIndex === tableData.length - 2) {
            data.cell.styles.fillColor = [255, 255, 255]
          } else {
            data.cell.styles.fillColor = [240, 240, 240]
          }
        }
      }
    })

    if (preparedBy) {
      const finalY = (this.doc as any).lastAutoTable.finalY + 10
      this.doc.setFontSize(8)
      this.doc.setFont('helvetica', 'normal')
      this.doc.text('Prepared by:', pageWidth - 70, finalY)
      this.doc.setFont('helvetica', 'bold')
      this.doc.text(preparedBy, pageWidth - 70, finalY + 6)
    }
  }

  generateEntryRecordsReport(
    records: any[],
    filters: {
      userFilter: string
      userName: string
      dateFrom: string
      dateTo: string
      recordCount: number
      activeCount: number
    },
    preparedBy: string
  ): void {
    const pageWidth = this.doc.internal.pageSize.getWidth()
    const pageHeight = this.doc.internal.pageSize.getHeight()
    let yPosition = 20

    // Header
    this.doc.setFontSize(18)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('ENTRY RECORDS REPORT', pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 10

    // Filter Summary
    this.doc.setFontSize(10)
    this.doc.setFont('helvetica', 'normal')
    
    const filterText = `User: ${filters.userName} | Date Range: ${filters.dateFrom} to ${filters.dateTo}`
    this.doc.text(filterText, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 6

    const summaryText = `Total Records: ${filters.recordCount} | Active: ${filters.activeCount} | Completed: ${filters.recordCount - filters.activeCount}`
    this.doc.text(summaryText, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 10

    // Prepare table data
    const tableData = records.map((record: any) => {
      const entryTime = new Date(record.entry_time).toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })

      const exitTime = record.exit_time
        ? new Date(record.exit_time).toLocaleString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          })
        : 'Still Inside'

      const userName = record.user?.full_name || 'Unknown'
      const accountId = record.user?.account_id || 'N/A'
      const userType = record.user?.user_type || 'N/A'
      const purpose = record.purpose || 'General'
      const duration = record.durationText
      const status = record.isActive ? 'Active' : 'Completed'

      return [entryTime, exitTime, `${userName}\n(${accountId})`, userType, purpose, duration, status]
    })

    // Generate table
    autoTable(this.doc, {
      startY: yPosition,
      head: [['Entry Time', 'Exit Time', 'User', 'Type', 'Purpose', 'Duration', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: 2
      },
      columnStyles: {
        0: { cellWidth: 28 },  // Entry Time
        1: { cellWidth: 28 },  // Exit Time
        2: { cellWidth: 35 },  // User
        3: { cellWidth: 20 },  // Type
        4: { cellWidth: 25 },  // Purpose
        5: { cellWidth: 22 },  // Duration
        6: { cellWidth: 20 }   // Status
      },
      didParseCell: (data: any) => {
        // Highlight active entries
        if (data.section === 'body') {
          const record = records[data.row.index]
          if (record.isActive) {
            data.cell.styles.fillColor = [255, 237, 213] // Light orange
            
            // Make Duration column text orange for active entries
            if (data.column.index === 5) {
              data.cell.styles.textColor = [230, 126, 34] // Orange
              data.cell.styles.fontStyle = 'bold'
            }
            
            // Make Status column text orange for active entries
            if (data.column.index === 6) {
              data.cell.styles.textColor = [230, 126, 34] // Orange
              data.cell.styles.fontStyle = 'bold'
            }
          }
        }
      },
      margin: { left: 10, right: 10 },
      didDrawPage: (data: any) => {
        // Footer on each page
        const pageCount = (this.doc as any).internal.getNumberOfPages()
        const currentPage = (this.doc as any).internal.getCurrentPageInfo().pageNumber
        
        this.doc.setFontSize(8)
        this.doc.setFont('helvetica', 'normal')
        this.doc.text(
          `Page ${currentPage} of ${pageCount}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        )
        
        // Export timestamp
        const exportTime = new Date().toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
        this.doc.text(`Exported: ${exportTime}`, 10, pageHeight - 10)
      }
    })

    // Final footer with signature
    const finalY = (this.doc as any).lastAutoTable.finalY + 15
    if (finalY < pageHeight - 30) {
      this.doc.setFontSize(9)
      this.doc.setFont('helvetica', 'normal')
      this.doc.text('Prepared by:', pageWidth - 70, finalY)
      this.doc.setFont('helvetica', 'bold')
      this.doc.text(preparedBy, pageWidth - 70, finalY + 6)
    }
  }

  /**
   * Generate Individual User Statistics Report
   *
   * Layout (geometric, uniform, consistent margins):
   *   Page 1 — header, profile card (avatar placeholder + identity fields),
   *            4-card overview (one per concern).
   *   Page 2 — concern-by-concern summary blocks (Borrowing, Penalties,
   *            Visits, Locker Rentals) using two-column metric tables.
   *   Page 3+ — full per-concern tables:
   *              1. Books Borrowed
   *              2. Recent Visits (latest 10)
   *              3. Penalty History
   *              4. Locker Rental History
   *   Footer — "Prepared by" on the last page.
   */
  generateIndividualUserReport(data: any, preparedBy: string, dateRangeTitle: string): void {
    const pageWidth = this.doc.internal.pageSize.getWidth()
    const pageHeight = this.doc.internal.pageSize.getHeight()
    const centerX = pageWidth / 2
    const marginX = 14
    const contentWidth = pageWidth - marginX * 2

    // Color palette — one accent per concern, used everywhere consistently.
    type RGB = [number, number, number]
    const C: Record<string, RGB> = {
      primary:    [37,  99, 235],   // blue-600
      primaryDk:  [30,  64, 175],   // blue-800
      borrowing:  [37,  99, 235],   // blue
      penalties:  [220, 38,  38],   // red-600
      visits:     [5,  150, 105],   // emerald-600
      lockers:    [217, 119,  6],   // amber-600
      slate900:   [15,  23,  42],
      slate700:   [51,  65,  85],
      slate500:   [100, 116, 139],
      slate300:   [203, 213, 225],
      slate100:   [241, 245, 249],
      slate50:    [248, 250, 252],
      white:      [255, 255, 255]
    }

    const formatDate = (d: any) => d ? new Date(d).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: '2-digit'
    }) : '—'
    const formatDateTime = (d: any) => d ? new Date(d).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true
    }) : '—'
    const peso = (n: number) => `PHP ${(Number(n) || 0).toFixed(2)}`

    // Derived counts used in tables & summaries.
    const borrowHistory = Array.isArray(data?.borrowing?.history) ? data.borrowing.history : []
    const visitLogs = Array.isArray(data?.visits?.logs) ? data.visits.logs : []
    const lockerAssignments = Array.isArray(data?.locker_usage?.assignments)
      ? data.locker_usage.assignments
      : []
    const penaltyBooks = Array.isArray(data?.penalties?.books) ? data.penalties.books : []
    const penaltyLockers = Array.isArray(data?.penalties?.lockers) ? data.penalties.lockers : []
    const allPenalties = [...penaltyBooks, ...penaltyLockers].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    const user = data?.user || {}

    // ===== Page 1: Header + Profile + Overview =====

    // Header band (geometric: solid block, centered text)
    this.doc.setFillColor(...C.primaryDk)
    this.doc.rect(0, 0, pageWidth, 38, 'F')
    this.doc.setTextColor(...C.white)
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(14)
    this.doc.text('Divine Word College of Calapan', centerX, 14, { align: 'center' })
    this.doc.setFontSize(10)
    this.doc.text(this.libraryName, centerX, 22, { align: 'center' })
    this.doc.setFontSize(11)
    this.doc.text('Individual User Statistics Report', centerX, 31, { align: 'center' })
    this.doc.setTextColor(...C.slate900)

    // Subtitle: date range + prepared by (right)
    let y = 46
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(13)
    this.doc.text('User Profile', marginX, y)
    y += 2
    // Divider under section title
    this.doc.setDrawColor(...C.primary)
    this.doc.setLineWidth(0.6)
    this.doc.line(marginX, y, marginX + contentWidth, y)
    y += 8

    // Profile card — split: avatar circle (left), key-value grid (right)
    const profileTop = y
    const cardPadding = 6
    const avatarSize = 22
    const avatarX = marginX + cardPadding
    const avatarY = profileTop + cardPadding

    // Avatar placeholder (filled circle with initials)
    const initials = (user.full_name || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s: string) => s[0]?.toUpperCase())
      .join('') || '?'
    this.doc.setFillColor(...C.primary)
    this.doc.circle(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 'F')
    this.doc.setTextColor(...C.white)
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(13)
    this.doc.text(initials, avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 4, { align: 'center' })

    // Identity grid (two columns of label/value pairs)
    const gridX = avatarX + avatarSize + 8
    const gridW = contentWidth - (gridX - marginX) - cardPadding
    const labelW = gridW * 0.32
    const valueW = gridW * 0.68
    const colWidths = [labelW, valueW]

    const buildIdentityRow = (label: string, value: string): [string, string] => [label, value]

    const identityRows: Array<[string, string]> = [
      buildIdentityRow('ID Number', user.account_id || '—'),
      buildIdentityRow('Full Name', user.full_name || '—'),
      buildIdentityRow('User Type', user.user_type || '—'),
      buildIdentityRow('Email', user.email || '—'),
    ]
    if (user.department) identityRows.push(buildIdentityRow('Department', user.department))
    if (user.program)    identityRows.push(buildIdentityRow('Program', user.program))
    if (user.grade_level) identityRows.push(buildIdentityRow('Grade Level', user.grade_level))
    if (user.section)    identityRows.push(buildIdentityRow('Section', user.section))
    if (user.office)     identityRows.push(buildIdentityRow('Office', user.office))
    identityRows.push(buildIdentityRow('Report Period', dateRangeTitle || '—'))

    autoTable(this.doc, {
      startY: profileTop + cardPadding,
      margin: { left: gridX, right: marginX + cardPadding },
      tableWidth: gridW,
      body: identityRows,
      theme: 'plain',
      styles: {
        fontSize: 9,
        cellPadding: { top: 1.5, bottom: 1.5, left: 4, right: 4 },
        lineColor: C.slate300,
        lineWidth: 0
      },
      columnStyles: {
        0: { cellWidth: labelW, fontStyle: 'bold', textColor: C.slate700, halign: 'left' },
        1: { cellWidth: valueW, textColor: C.slate900, halign: 'left' }
      },
      didDrawCell: (data) => {
        // Thin underline under each row for geometric separation
        if (data.section === 'body' && data.column.index === 1) {
          const cell = data.cell as any
          const doc = this.doc as any
          doc.setDrawColor(C.slate100[0], C.slate100[1], C.slate100[2])
          doc.setLineWidth(0.2)
          doc.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height)
        }
      }
    })

    y = (this.doc as any).lastAutoTable.finalY + 10

    // 4-card overview (Borrowing, Penalties, Visits, Lockers) — same metrics
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(13)
    this.doc.text('Overview', marginX, y)
    y += 2
    this.doc.setDrawColor(...C.primary)
    this.doc.setLineWidth(0.6)
    this.doc.line(marginX, y, marginX + contentWidth, y)
    y += 8

    const cardGap = 4
    const cardW = (contentWidth - cardGap * 3) / 4
    const cardH = 26
    const overviewCards = [
      {
        label: 'Books Borrowed',
        accent: C.borrowing,
        lines: [
          ['Total', borrowHistory.length],
          ['Active', borrowHistory.filter((b: any) => b.status === 'ACTIVE').length],
          ['Returned', borrowHistory.filter((b: any) => b.status === 'COMPLETED').length]
        ]
      },
      {
        label: 'Penalties',
        accent: C.penalties,
        lines: [
          ['Records', allPenalties.length],
          ['Total', peso(data?.penalties?.summary?.total_penalties || 0)],
          ['Balance', peso(data?.penalties?.summary?.total_balance || 0)]
        ]
      },
      {
        label: 'Visits',
        accent: C.visits,
        lines: [
          ['Total', data?.visits?.summary?.total_visits || visitLogs.length],
          ['Avg Duration', `${data?.visits?.summary?.avg_duration_minutes || 0} min`],
          ['Still Inside', visitLogs.filter((v: any) => !v.exit_time).length]
        ]
      },
      {
        label: 'Locker Rentals',
        accent: C.lockers,
        lines: [
          ['Total', data?.locker_usage?.summary?.total_rentals ?? lockerAssignments.length],
          ['Active', data?.locker_usage?.summary?.active_count ?? lockerAssignments.filter((l: any) => l.status === 'ACTIVE').length],
          ['Completed', data?.locker_usage?.summary?.completed_count ?? lockerAssignments.filter((l: any) => l.status === 'COMPLETED').length],
          ['Overdue', data?.locker_usage?.summary?.overdue_count ?? lockerAssignments.filter((l: any) => l.status === 'OVERDUE').length]
        ]
      }
    ]

    overviewCards.forEach((card, idx) => {
      const x = marginX + idx * (cardW + cardGap)
      // Card body
      this.doc.setFillColor(...C.slate50)
      this.doc.rect(x, y, cardW, cardH, 'F')
      // Accent strip on the left
      this.doc.setFillColor(card.accent[0], card.accent[1], card.accent[2])
      this.doc.rect(x, y, 2.2, cardH, 'F')
      // Card label
      this.doc.setFont('helvetica', 'bold')
      this.doc.setFontSize(9.5)
      this.doc.setTextColor(...C.slate700)
      this.doc.text(card.label, x + 5, y + 6)
      // Card metric lines (right-aligned value, label left-aligned)
      this.doc.setFont('helvetica', 'normal')
      this.doc.setFontSize(8.5)
      card.lines.forEach(([k, v], i) => {
        const lineY = y + 12 + i * 4.6
        this.doc.setTextColor(...C.slate500)
        this.doc.text(String(k), x + 5, lineY)
        this.doc.setFont('helvetica', 'bold')
        this.doc.setTextColor(...C.slate900)
        this.doc.text(String(v), x + cardW - 5, lineY, { align: 'right' })
        this.doc.setFont('helvetica', 'normal')
      })
    })
    y += cardH + 12

    // ===== Page 2: Concern-by-concern summary blocks =====
    this.doc.addPage()
    y = 18

    const drawSectionTitle = (title: string, accent: number[]) => {
      this.doc.setFont('helvetica', 'bold')
      this.doc.setFontSize(13)
      this.doc.setTextColor(...C.slate900)
      this.doc.text(title, marginX, y)
      // Accent square next to title for geometric consistency
      this.doc.setFillColor(accent[0], accent[1], accent[2])
      this.doc.rect(marginX + this.doc.getTextWidth(title) + 4, y - 3.2, 3, 3, 'F')
      y += 2
      this.doc.setDrawColor(...C.slate300)
      this.doc.setLineWidth(0.4)
      this.doc.line(marginX, y, marginX + contentWidth, y)
      y += 6
    }

    const drawTwoColMetricTable = (
      options: {
        rows: Array<[string, string]>
        totalsRow?: [string, string]
        highlightRows?: Array<{ index: number; accent?: [number,number,number]; label?: string }>
      }
    ) => {
      const { rows, totalsRow, highlightRows = [] } = options
      const bodyRows = totalsRow ? [...rows, totalsRow] : rows
      const totalsIndex = totalsRow ? rows.length : -1
      const highlightIndexMap = new Map<number, { accent: number[]; label?: string }>()
      highlightRows.forEach((h) => highlightIndexMap.set(h.index, {
        accent: h.accent || C.penalties,
        label: h.label
      }))

      autoTable(this.doc, {
        startY: y,
        margin: { left: marginX, right: marginX },
        tableWidth: contentWidth,
        body: bodyRows,
        theme: 'plain',
        styles: {
          fontSize: 9,
          cellPadding: { top: 2, bottom: 2, left: 4, right: 4 },
          lineColor: C.slate100,
          lineWidth: 0.2
        },
        columnStyles: {
          0: { cellWidth: contentWidth * 0.55, fontStyle: 'bold', textColor: C.slate700, halign: 'left' },
          1: { cellWidth: contentWidth * 0.45, textColor: C.slate900, halign: 'right', fontStyle: 'bold' }
        },
        didParseCell: (data) => {
          if (data.section !== 'body') return

          // Highlight a specific row (e.g., Outstanding balance) — bold red
          // accent so it pops next to the surrounding slate-700 rows.
          const highlight = highlightIndexMap.get(data.row.index)
          if (highlight) {
            data.cell.styles.fillColor = [254, 226, 226] // red-100
            data.cell.styles.textColor = highlight.accent as [number,number, number]
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.lineWidth = 0.4
            data.cell.styles.lineColor = highlight.accent as [number,number, number]
            data.cell.styles.cellPadding = { top: 3, bottom: 3, left: 4, right: 4 }
            return
          }

          // Totals row (appended at the end) — bold slate block.
          if (totalsIndex >= 0 && data.row.index === totalsIndex) {
            data.cell.styles.fillColor = C.slate100
            data.cell.styles.textColor = C.slate900
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.lineWidth = 0.6
            data.cell.styles.lineColor = C.slate700
            data.cell.styles.cellPadding = { top: 3, bottom: 3, left: 4, right: 4 }
          }
        }
      })
      y = (this.doc as any).lastAutoTable.finalY + 8
    }

    // --- Borrowing summary ---
    drawSectionTitle('Book Borrowing Summary', C.borrowing)
    drawTwoColMetricTable({
      rows: [
        ['Total books borrowed', String(borrowHistory.length)],
        ['Currently borrowed', String(borrowHistory.filter((b: any) => b.status === 'ACTIVE').length)],
        ['Returned', String(borrowHistory.filter((b: any) => b.status === 'COMPLETED').length)],
        ['Overdue', String(borrowHistory.filter((b: any) => b.status === 'OVERDUE').length)],
        ['Active penalties on books', peso(borrowHistory.reduce(
          (s: number, b: any) => s + (Number(b.penalty) || 0), 0
        ))]
      ]
    })

    // --- Penalties summary ---
    // Outstanding balance is moved above the totals and rendered with a
    // red accent so the reader's eye lands on the still-owed amount first.
    drawSectionTitle('Penalties Summary', C.penalties)
    drawTwoColMetricTable({
      rows: [
        ['Penalty records (total)', String(allPenalties.length)],
        ['Book penalty records', String(penaltyBooks.length)],
        ['Locker penalty records', String(penaltyLockers.length)],
        ['Outstanding balance', peso(data?.penalties?.summary?.total_balance || 0)],
        ['Total penalties assessed', peso(data?.penalties?.summary?.total_penalties || 0)],
        ['Total amount paid', peso(data?.penalties?.summary?.total_paid || 0)]
      ],
      // Highlight the Outstanding balance row (index 3) in red so the
      // still-owed amount stands out from the surrounding slate rows.
      highlightRows: [{ index: 3, accent: C.penalties }],
      totalsRow: ['TOTAL PENALTIES', peso(
        // Grand total = assessed penalties (which already includes active ongoing).
        (Number(data?.penalties?.summary?.total_penalties) || 0)
      )]
    })

    // --- Visits summary ---
    drawSectionTitle('Library Visits Summary', C.visits)
    drawTwoColMetricTable({
      rows: [
        ['Total visits', String(data?.visits?.summary?.total_visits || visitLogs.length)],
        ['Currently inside', String(visitLogs.filter((v: any) => !v.exit_time).length)],
        ['Completed visits', String(visitLogs.filter((v: any) => !!v.exit_time).length)],
        ['Average duration', `${data?.visits?.summary?.avg_duration_minutes || 0} min`]
      ]
    })

    // --- Locker rentals summary ---
    drawSectionTitle('Locker Rentals Summary', C.lockers)
    drawTwoColMetricTable({
      rows: [
        ['Total rentals', String(data?.locker_usage?.summary?.total_rentals ?? lockerAssignments.length)],
        ['Active rentals', String(data?.locker_usage?.summary?.active_count ?? lockerAssignments.filter((l: any) => l.status === 'ACTIVE').length)],
        ['Completed rentals', String(data?.locker_usage?.summary?.completed_count ?? lockerAssignments.filter((l: any) => l.status === 'COMPLETED').length)],
        ['Overdue rentals', String(data?.locker_usage?.summary?.overdue_count ?? lockerAssignments.filter((l: any) => l.status === 'OVERDUE').length)],
        ['Current rental', data?.locker_usage?.summary?.current_rental
          ? `Locker #${data.locker_usage.summary.current_rental.locker?.locker_number || '—'}`
          : 'No active rental']
      ]
    })

    // ===== Detail tables =====
    const ensureSpace = (needed: number) => {
      if (y + needed > pageHeight - 22) {
        this.doc.addPage()
        y = 18
      }
    }

    const drawTableHeader = (title: string, accent: number[]) => {
      ensureSpace(20)
      drawSectionTitle(title, accent)
    }

    const baseTableOpts = (headRow: string[]) => ({
      margin: { left: marginX, right: marginX },
      tableWidth: contentWidth,
      theme: 'grid',
      headStyles: {
        fillColor: C.slate900,
        textColor: C.white,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 8.5
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 2,
        textColor: C.slate900
      },
      alternateRowStyles: [{ fillColor: C.slate50 }],
      head: [headRow]
    } as any)

    // --- Books Borrowed table ---
    drawTableHeader('Books Borrowed', C.borrowing)
    if (borrowHistory.length === 0) {
      this.doc.setFont('helvetica', 'italic')
      this.doc.setFontSize(9)
      this.doc.setTextColor(...C.slate500)
      this.doc.text('No borrowing records in the selected period.', marginX, y)
      y += 12
    } else {
      const rows = borrowHistory.map((b: any) => [
        b.book_title || '—',
        b.isbn || '—',
        b.accession_number || '—',
        formatDate(b.borrow_date),
        formatDate(b.due_date),
        b.return_date ? formatDate(b.return_date) : '—',
        b.status,
        Number(b.penalty) > 0 ? peso(b.penalty) : '—'
      ])
      autoTable(this.doc, {
        startY: y,
        ...baseTableOpts(['Title', 'ISBN', 'Accession', 'Borrowed', 'Due', 'Returned', 'Status', 'Penalty']),
        body: rows,
        columnStyles: {
          0: { cellWidth: 'auto', halign: 'left',   fontStyle: 'bold' },
          1: { cellWidth: 22,  halign: 'left' },
          2: { cellWidth: 22,  halign: 'left' },
          3: { cellWidth: 20,  halign: 'center' },
          4: { cellWidth: 20,  halign: 'center' },
          5: { cellWidth: 20,  halign: 'center' },
          6: { cellWidth: 24,  halign: 'center', fontStyle: 'bold' },
          7: { cellWidth: 22,  halign: 'right' }
        },
        didParseCell: (data) => {
          if (data.section !== 'body') return
          const status = String(borrowHistory[data.row.index]?.status || '')
          if (data.column.index === 6) {
            if (status === 'OVERDUE') {
              data.cell.styles.textColor = C.penalties
              data.cell.styles.fillColor = [254, 226, 226]
            } else if (status === 'ACTIVE') {
              data.cell.styles.textColor = C.borrowing
              data.cell.styles.fillColor = [219, 234, 254]
            } else if (status === 'COMPLETED') {
              data.cell.styles.textColor = C.visits
            }
          }
        }
      })
      y = (this.doc as any).lastAutoTable.finalY + 10
    }

    // --- Recent Visits table (latest 10) ---
    drawTableHeader('Recent Library Visits (latest 10)', C.visits)
    if (visitLogs.length === 0) {
      this.doc.setFont('helvetica', 'italic')
      this.doc.setFontSize(9)
      this.doc.setTextColor(...C.slate500)
      this.doc.text('No visit records in the selected period.', marginX, y)
      y += 12
    } else {
      const recent = visitLogs.slice(0, 10)
      const rows = recent.map((v: any) => [
        formatDateTime(v.entry_time),
        v.exit_time ? formatDateTime(v.exit_time) : 'Still inside',
        v.duration_minutes != null ? `${v.duration_minutes} min` : 'In progress',
        v.purpose || 'General'
      ])
      autoTable(this.doc, {
        startY: y,
        ...baseTableOpts(['Entry Time', 'Exit Time', 'Duration', 'Purpose']),
        body: rows,
        columnStyles: {
          0: { cellWidth: 'auto', halign: 'left' },
          1: { cellWidth: 'auto', halign: 'left' },
          2: { cellWidth: 30,  halign: 'center', fontStyle: 'bold' },
          3: { cellWidth: 36,  halign: 'left' }
        }
      })
      y = (this.doc as any).lastAutoTable.finalY + 10
    }

    // --- Penalty History table ---
    drawTableHeader('Penalty History', C.penalties)
    if (allPenalties.length === 0) {
      this.doc.setFont('helvetica', 'italic')
      this.doc.setFontSize(9)
      this.doc.setTextColor(...C.slate500)
      this.doc.text('No penalty records in the selected period.', marginX, y)
      y += 12
    } else {
      const rows = allPenalties.map((p: any) => [
        formatDate(p.created_at),
        p.transaction_type || '—',
        peso(p.penalty_amount),
        peso(p.amount_paid),
        peso(p.remaining_balance),
        p.status || '—'
      ])

      // Totals row — aggregates Amount / Paid / Balance across every
      // penalty in the table so the reader sees the running balance
      // without having to scroll-and-sum the rows manually.
      const totalsAmount  = allPenalties.reduce((s: number, p: any) => s + (Number(p.penalty_amount)     || 0), 0)
      const totalsPaid    = allPenalties.reduce((s: number, p: any) => s + (Number(p.amount_paid)        || 0), 0)
      const totalsBalance = allPenalties.reduce((s: number, p: any) => s + (Number(p.remaining_balance)  || 0), 0)
      rows.push([
        'TOTAL',
        `${allPenalties.length} record${allPenalties.length === 1 ? '' : 's'}`,
        peso(totalsAmount),
        peso(totalsPaid),
        peso(totalsBalance),
        ''
      ])

      autoTable(this.doc, {
        startY: y,
        ...baseTableOpts(['Date', 'Type', 'Amount', 'Paid', 'Balance', 'Status']),
        body: rows,
        columnStyles: {
          0: { cellWidth: 24,  halign: 'center' },
          1: { cellWidth: 20,  halign: 'center', fontStyle: 'bold' },
          2: { cellWidth: 'auto', halign: 'right' },
          3: { cellWidth: 'auto', halign: 'right' },
          4: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold' },
          5: { cellWidth: 26,  halign: 'center' }
        },
        didParseCell: (data) => {
          if (data.section !== 'body') return

          // Style the appended totals row
          if (data.row.index === allPenalties.length) {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = C.slate100
            data.cell.styles.textColor = C.slate900
            data.cell.styles.lineWidth = 0.6
            data.cell.styles.lineColor = C.slate700
            if (data.column.index === 2 || data.column.index === 3 || data.column.index === 4) {
              data.cell.styles.halign = 'right'
            }
            return
          }

          const row = allPenalties[data.row.index]
          const status = String(row?.status || '')
          if (data.column.index === 1) {
            data.cell.styles.textColor = row?.transaction_type === 'BOOK' ? C.borrowing : C.lockers
          }
          if (data.column.index === 4 && Number(row?.remaining_balance) > 0) {
            data.cell.styles.textColor = C.penalties
            data.cell.styles.fillColor = [254, 226, 226]
          }
          if (data.column.index === 5) {
            if (status === 'PENDING' || status === 'PARTIAL') {
              data.cell.styles.textColor = C.penalties
            } else if (status === 'SETTLED') {
              data.cell.styles.textColor = C.visits
            }
          }
        }
      })
      y = (this.doc as any).lastAutoTable.finalY + 10
    }

    // --- Locker Rentals table ---
    drawTableHeader('Locker Rentals', C.lockers)
    if (lockerAssignments.length === 0) {
      this.doc.setFont('helvetica', 'italic')
      this.doc.setFontSize(9)
      this.doc.setTextColor(...C.slate500)
      this.doc.text('No locker rental records in the selected period.', marginX, y)
      y += 12
    } else {
      const rows = lockerAssignments.map((l: any) => [
        l.locker_number || '—',
        l.location || '—',
        formatDateTime(l.borrow_time),
        l.due_time ? formatDateTime(l.due_time) : '—',
        l.return_time ? formatDateTime(l.return_time) : 'Active',
        l.status,
        Number(l.penalty) > 0 ? peso(l.penalty) : '—'
      ])
      autoTable(this.doc, {
        startY: y,
        ...baseTableOpts(['Locker', 'Location', 'Borrowed', 'Due', 'Returned', 'Status', 'Penalty']),
        body: rows,
        columnStyles: {
          0: { cellWidth: 18,  halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 'auto', halign: 'left' },
          2: { cellWidth: 'auto', halign: 'left' },
          3: { cellWidth: 'auto', halign: 'left' },
          4: { cellWidth: 'auto', halign: 'left' },
          5: { cellWidth: 24,  halign: 'center', fontStyle: 'bold' },
          6: { cellWidth: 22,  halign: 'right' }
        },
        didParseCell: (data) => {
          if (data.section !== 'body') return
          const status = String(lockerAssignments[data.row.index]?.status || '')
          if (data.column.index === 5) {
            if (status === 'OVERDUE') {
              data.cell.styles.textColor = C.penalties
              data.cell.styles.fillColor = [254, 226, 226]
            } else if (status === 'ACTIVE') {
              data.cell.styles.textColor = C.lockers
              data.cell.styles.fillColor = [254, 243, 199]
            } else if (status === 'COMPLETED') {
              data.cell.styles.textColor = C.visits
            }
          }
        }
      })
      y = (this.doc as any).lastAutoTable.finalY + 10
    }

    // ===== Footer =====
    ensureSpace(20)
    y += 4
    this.doc.setDrawColor(...C.slate300)
    this.doc.setLineWidth(0.3)
    this.doc.line(marginX, y, marginX + contentWidth, y)
    y += 6

    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(9)
    this.doc.setTextColor(...C.slate500)
    this.doc.text('Prepared by:', marginX, y)
    this.doc.setFont('helvetica', 'bold')
    this.doc.setTextColor(...C.slate900)
    this.doc.text(preparedBy || 'Library Staff', marginX + 22, y)
    // Signature line
    this.doc.setDrawColor(...C.slate700)
    this.doc.setLineWidth(0.4)
    this.doc.line(marginX + 22, y + 1.5, marginX + 90, y + 1.5)
  }

  /**
   * Summary of Fines — per-borrower breakdown. Shape:
   *   {
   *     type: 'combined' | 'book' | 'locker',
   *     filters: { date_from, date_to, ... },
   *     grand: { total, paid, remaining, borrower_count, settlement_count },
   *     rows: [
   *       {
   *         user: { full_name, account_id, user_type, ... },
   *         book:     { total, paid, remaining, count },
   *         locker:   { total, paid, remaining, count },
   *         combined: { total, paid, remaining, count },
   *         settlements: [ ...transaction-level rows ]
   *       }
   *     ]
   *   }
   *
   * Renders a single table with one row per borrower. Columns
   * adapt to the report `type` so a book-only report doesn't
   * show empty locker columns (and vice-versa).
   */
  generateFinesSummaryReport(
    data: {
      type?: 'combined' | 'book' | 'locker'
      filters?: { date_from?: string | null; date_to?: string | null }
      grand?: { total: number; paid: number; remaining: number; borrower_count: number; settlement_count: number }
      rows: Array<{
        user: any
        book: { total: number; paid: number; remaining: number; count: number }
        locker: { total: number; paid: number; remaining: number; count: number }
        combined: { total: number; paid: number; remaining: number; count: number }
      }>
    },
    preparedBy: string = '',
    dateRangeTitle?: string
  ): void {
    const pageWidth = this.doc.internal.pageSize.getWidth()
    const centerX = pageWidth / 2
    const type = data.type || 'combined'
    const fmt = (n: number) =>
      `PHP ${(Number(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    // Header
    this.doc.setFontSize(11)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Divine Word College of Calapan', centerX, 15, { align: 'center' })
    this.doc.setFontSize(9)
    this.doc.text(this.libraryName, centerX, 21, { align: 'center' })
    this.doc.setFontSize(10)
    this.doc.text('Summary of Fines', centerX, 28, { align: 'center' })
    if (dateRangeTitle) {
      this.doc.setFontSize(8)
      this.doc.setFont('helvetica', 'normal')
      this.doc.text(`for ${dateRangeTitle}`, centerX, 33, { align: 'center' })
    }
    // Report-type pill
    this.doc.setFontSize(7)
    this.doc.setFont('helvetica', 'bold')
    const pillLabel =
      type === 'book'
        ? 'BOOK FINES ONLY'
        : type === 'locker'
          ? 'LOCKER FINES ONLY'
          : 'COMBINED (BOOK + LOCKER)'
    this.doc.setFillColor(220, 215, 240)
    const pillW = 70
    this.doc.roundedRect(centerX - pillW / 2, 36, pillW, 5, 1, 1, 'F')
    this.doc.setTextColor(60, 40, 110)
    this.doc.text(pillLabel, centerX, 39.5, { align: 'center' })
    this.doc.setTextColor(0, 0, 0)
    this.doc.setFont('helvetica', 'normal')

    // Column layout depends on the report type so we never show
    // empty columns.
    const showBook = type !== 'locker'
    const showLocker = type !== 'book'
    const head: string[] = ['#', 'Borrower', 'ID Number', 'Type']
    if (showBook) head.push('Book Penalty', 'Book Paid', 'Book Remaining', '# Book')
    if (showLocker) head.push('Locker Penalty', 'Locker Paid', 'Locker Remaining', '# Locker')
    if (type === 'combined') {
      head.push('Total Penalty', 'Total Paid', 'Total Remaining')
    }

    const body = data.rows.map((r, i) => {
      const u = r.user || {}
      const row: any[] = [
        i + 1,
        u.full_name || 'Unknown',
        u.account_id || '—',
        u.user_type || '—'
      ]
      if (showBook) {
        row.push(
          fmt(r.book.total),
          fmt(r.book.paid),
          fmt(r.book.remaining),
          r.book.count
        )
      }
      if (showLocker) {
        row.push(
          fmt(r.locker.total),
          fmt(r.locker.paid),
          fmt(r.locker.remaining),
          r.locker.count
        )
      }
      if (type === 'combined') {
        row.push(
          fmt(r.combined.total),
          fmt(r.combined.paid),
          fmt(r.combined.remaining)
        )
      }
      return row
    })

    autoTable(this.doc, {
      startY: 46,
      head: [head],
      body: body.length ? body : [['—', 'No borrowers with fines in this range', '', '', '', '', '', '', '', '', '', '', ''].slice(0, head.length)],
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.5, halign: 'left' },
      headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { halign: 'left' },
        2: { halign: 'left', cellWidth: 24 },
        3: { halign: 'center', cellWidth: 18 }
      },
      didParseCell: (data) => {
        // Right-align the currency columns.
        const isCurrency =
          (showBook &&
            [4, 5, 6].includes(data.column.index)) ||
          (showLocker &&
            [showBook ? 8 : 4, showBook ? 9 : 5, showBook ? 10 : 6].includes(
              data.column.index
            ))
        if (isCurrency && data.section === 'body') {
          data.cell.styles.halign = 'right'
        }
      }
    })

    // Summary line at the bottom of the table
    const finalY = (this.doc as any).lastAutoTable.finalY + 8
    const grand = data.grand || {
      total: data.rows.reduce((s, r) => s + r.combined.total, 0),
      paid: data.rows.reduce((s, r) => s + r.combined.paid, 0),
      remaining: data.rows.reduce((s, r) => s + r.combined.remaining, 0),
      borrower_count: data.rows.length,
      settlement_count: data.rows.reduce((s, r) => s + r.combined.count, 0)
    }
    this.doc.setFontSize(8)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Grand Totals', 20, finalY)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(
      `Total Penalty: ${fmt(grand.total)}    Total Paid: ${fmt(grand.paid)}    Remaining: ${fmt(grand.remaining)}    Borrowers: ${grand.borrower_count}    Settlements: ${grand.settlement_count}`,
      20,
      finalY + 6
    )

    // Signature
    if (preparedBy) {
      this.doc.setFontSize(8)
      this.doc.text('Prepared by:', pageWidth - 70, finalY)
      this.doc.setFont('helvetica', 'bold')
      this.doc.text(preparedBy, pageWidth - 70, finalY + 6)
    }
  }

  save(filename: string): void {
    this.doc.save(filename)
  }

  output(type: 'blob' | 'bloburl' | 'dataurlstring' = 'blob'): any {
    return this.doc.output(type)
  }
}
