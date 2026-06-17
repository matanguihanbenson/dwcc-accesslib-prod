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

  constructor(paperSize: PaperSize = 'short') {
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
    this.doc.text('College Library', centerX, 21, { align: 'center' })
    
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
    this.doc.text('College Library', centerX, 21, { align: 'center' })
    
    this.doc.setFontSize(8)
    this.doc.setFont('helvetica', 'normal')
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

    // Column widths optimized for portrait
    const dateColWidth = 23  // Time & Date column (increased for \"Month Day\" format)
    const timeSlotWidth = 9.5 // Each time slot column (13 slots, reduced to fit)
    const totalColWidth = 13 // Total column
    const uniqueColWidth = 13 // UNIQUE column
    
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
    this.doc.text('College Library', centerX, 21, { align: 'center' })
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
    this.doc.text('College Library', centerX, 31, { align: 'center' })
    
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
    this.doc.text('College Library', centerX, 21, { align: 'center' })
    
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

    // Column widths optimized for portrait
    const dateColWidth = 21  // Time & Date column (increased for "Mon DD" format)
    const timeSlotWidth = 9.7 // Each time slot column (13 slots, reduced to fit)
    const totalColWidth = 13 // Total column
    const uniqueColWidth = 13 // UNIQUE column

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
    this.doc.text('COLLEGE LIBRARY', centerX, 21, { align: 'center' })
    
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
    this.doc.text('College Library', centerX, 21, { align: 'center' })
    
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

    // Column widths
    const dateColWidth = 18
    const timeSlotWidth = 10
    const totalColWidth = 13
    const uniqueColWidth = 13
    
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
              } else if (isHoliday && !isMultiDay && colIndex === 1) {
                data.cell.styles.fillColor = [255, 200, 200]
                data.cell.colSpan = 15
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
      },
      willDrawCell: (data: any) => {
        const rowIndex = data.row.index
        const colIndex = data.column.index
        const rowData = dailyData[rowIndex]
        
        if (rowData && rowIndex < dailyData.length) {
          const isHoliday = rowData.holiday !== null && rowData.holiday !== undefined
          const dayOfWeek = rowData.dayOfWeek || ''
          const isSunday = dayOfWeek.toLowerCase() === 'sunday'
          const cell = data.cell
          
          if (colIndex >= 1 && colIndex <= 15) {
            const holidayMeta = (tableData[rowIndex] as any)?._holidayMeta
            
            if (isHoliday && holidayMeta?.isMultiDay && colIndex === 1 && holidayMeta.isFirstDay) {
              const pdf = this.doc
              const pageWidth = pdf.internal.pageSize.getWidth()
              const totalDays = holidayMeta.totalDays
              const cellHeight = cell.height
              const totalHeight = cellHeight * totalDays
              const cellY = cell.y + (totalHeight / 2)
              
              pdf.setTextColor(139, 0, 0)
              pdf.setFont('helvetica', 'bold')
              pdf.text(rowData.holiday?.name || '', pageWidth / 2, cellY, {
                align: 'center',
              })
              
              return false
            } else if (isSunday && colIndex === 1) {
              const pdf = this.doc
              const pageWidth = pdf.internal.pageSize.getWidth()
              const cellY = cell.y + cell.height / 2 + 1.5
              
              pdf.setTextColor(0, 0, 0)
              pdf.setFont('helvetica', 'bold')
              pdf.text('SUNDAY', pageWidth / 2, cellY, {
                align: 'center',
              })
              
              return false
            } else if (isHoliday && !holidayMeta?.isMultiDay && colIndex === 1) {
              const pdf = this.doc
              const pageWidth = pdf.internal.pageSize.getWidth()
              const cellY = cell.y + cell.height / 2 + 1.5
              
              pdf.setTextColor(139, 0, 0)
              pdf.setFont('helvetica', 'bold')
              pdf.text(rowData.holiday?.name || '', pageWidth / 2, cellY, {
                align: 'center',
              })
              
              return false
            }
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

  generateLockerConcurrentStatistics(data: LockerStatisticsReportData, preparedBy: string = '', dateRangeTitle?: string): void {
    const { month, year, dailyData, hourlyTotals, summary } = data

    // Header
    this.doc.setFontSize(11)
    this.doc.setFont('helvetica', 'bold')
    const pageWidth = this.doc.internal.pageSize.getWidth()
    const centerX = pageWidth / 2
    
    this.doc.text('Divine Word College of Calapan', centerX, 15, { align: 'center' })
    
    this.doc.setFontSize(9)
    this.doc.text('College Library', centerX, 21, { align: 'center' })
    
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
    const timeSlotWidth = 10
    const totalColWidth = 13
    const uniqueColWidth = 13
    
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
   */
  generateIndividualUserReport(data: any, preparedBy: string, dateRangeTitle: string): void {
    const pageWidth = this.doc.internal.pageSize.getWidth()
    const pageHeight = this.doc.internal.pageSize.getHeight()
    const centerX = pageWidth / 2
    
    // Header
    this.doc.setFontSize(11)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Divine Word College of Calapan', centerX, 15, { align: 'center' })
    
    this.doc.setFontSize(9)
    this.doc.text('College Library', centerX, 21, { align: 'center' })
    
    this.doc.setFontSize(8)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text('Individual User Statistics', centerX, 27, { align: 'center' })
    this.doc.text(`for ${dateRangeTitle}`, centerX, 32, { align: 'center' })
    
    let yPosition = 45
    
    // User Information Section
    this.doc.setFontSize(12)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('User Information', 20, yPosition)
    yPosition += 8
    
    this.doc.setFontSize(10)
    this.doc.setFont('helvetica', 'normal')
    this.doc.text(`ID Number: ${data.user.account_id}`, 20, yPosition)
    yPosition += 6
    this.doc.text(`Full Name: ${data.user.full_name}`, 20, yPosition)
    yPosition += 6
    this.doc.text(`User Type: ${data.user.user_type}`, 20, yPosition)
    yPosition += 6
    
    if (data.user.department) {
      this.doc.text(`Department: ${data.user.department}`, 20, yPosition)
      yPosition += 6
    }
    
    if (data.user.program) {
      this.doc.text(`Program: ${data.user.program}`, 20, yPosition)
      yPosition += 6
    }
    
    yPosition += 5
    
    // Summary Statistics Section
    this.doc.setFontSize(12)
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Summary Statistics', 20, yPosition)
    yPosition += 8
    
    this.doc.setFontSize(10)
    this.doc.setFont('helvetica', 'normal')
    
    const summaryData = [
      ['Metric', 'Value'],
      ['Total Books Borrowed', (data.borrowing?.summary?.total_borrowed || 0).toString()],
      ['Currently Borrowed', (data.borrowing?.summary?.currently_borrowed || 0).toString()],
      ['Total Visits', (data.visits?.summary?.total_visits || 0).toString()],
      ['Avg Duration (minutes)', (data.visits?.summary?.avg_duration_minutes || 0).toString()],
      ['Total Penalties', `PHP ${(data.penalties?.summary?.total_penalties || 0).toFixed(2)}`],
      ['Total Balance', `PHP ${(data.penalties?.summary?.total_balance || 0).toFixed(2)}`],
      ['Total Locker Rentals', (data.locker_usage?.summary?.total_rentals || 0).toString()],
      ['Current Rental Status', data.locker_usage?.summary?.current_rental ? 'Active rental' : 'No active rental']
    ]
    
    autoTable(this.doc, {
      startY: yPosition,
      head: [summaryData[0]],
      body: summaryData.slice(1),
      theme: 'striped',
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 'auto', fontStyle: 'bold', halign: 'left' },
        1: { cellWidth: 'auto', halign: 'right' }
      },
      margin: { left: 20, right: 20 }
    })
    
    yPosition = (this.doc as any).lastAutoTable.finalY + 10
    
    // Borrowing History Section
    if (data.borrowing?.history && data.borrowing.history.length > 0) {
      if (yPosition > pageHeight - 80) {
        this.doc.addPage()
        yPosition = 20
      }
      
      this.doc.setFontSize(12)
      this.doc.setFont('helvetica', 'bold')
      this.doc.text('Borrowing History', 20, yPosition)
      yPosition += 8
      
      const borrowingTableData = data.borrowing.history.map((item: any) => [
        item.book.title,
        new Date(item.borrow_date).toLocaleDateString(),
        new Date(item.due_date).toLocaleDateString(),
        item.return_date ? new Date(item.return_date).toLocaleDateString() : 'Not returned',
        item.status
      ])
      
      autoTable(this.doc, {
        startY: yPosition,
        head: [['Book Title', 'Borrow Date', 'Due Date', 'Return Date', 'Status']],
        body: borrowingTableData,
        theme: 'grid',
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9
        },
        bodyStyles: {
          fontSize: 8
        },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 30 },
          2: { cellWidth: 30 },
          3: { cellWidth: 30 },
          4: { cellWidth: 25 }
        },
        margin: { left: 20, right: 20 }
      })
      
      yPosition = (this.doc as any).lastAutoTable.finalY + 10
    }
    
    // Penalties History Section
    if (data.penalties?.history && data.penalties.history.length > 0) {
      if (yPosition > pageHeight - 80) {
        this.doc.addPage()
        yPosition = 20
      }
      
      this.doc.setFontSize(12)
      this.doc.setFont('helvetica', 'bold')
      this.doc.text('Penalty History', 20, yPosition)
      yPosition += 8
      
      const penaltyTableData = data.penalties.history.map((penalty: any) => [
        new Date(penalty.created_at).toLocaleDateString(),
        penalty.penalty_type,
        `PHP ${penalty.amount.toFixed(2)}`,
        `PHP ${penalty.amount_paid.toFixed(2)}`,
        `PHP ${penalty.balance.toFixed(2)}`,
        penalty.reason || 'N/A',
        penalty.status
      ])
      
      autoTable(this.doc, {
        startY: yPosition,
        head: [['Date', 'Type', 'Amount', 'Paid', 'Balance', 'Reason', 'Status']],
        body: penaltyTableData,
        theme: 'grid',
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8
        },
        bodyStyles: {
          fontSize: 7
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 25 },
          2: { cellWidth: 25, halign: 'right' },
          3: { cellWidth: 25, halign: 'right' },
          4: { cellWidth: 25, halign: 'right' },
          5: { cellWidth: 30 },
          6: { cellWidth: 20 }
        },
        margin: { left: 20, right: 20 }
      })
      
      yPosition = (this.doc as any).lastAutoTable.finalY + 10
    }
    
    // Visit History Section
    if (data.visits?.history && data.visits.history.length > 0) {
      if (yPosition > pageHeight - 80) {
        this.doc.addPage()
        yPosition = 20
      }
      
      this.doc.setFontSize(12)
      this.doc.setFont('helvetica', 'bold')
      this.doc.text('Visit History', 20, yPosition)
      yPosition += 8
      
      const visitTableData = data.visits.history.map((visit: any) => [
        new Date(visit.entry_time).toLocaleString(),
        visit.exit_time ? new Date(visit.exit_time).toLocaleString() : 'Still Inside',
        visit.duration || 'N/A',
        visit.purpose || 'General'
      ])
      
      autoTable(this.doc, {
        startY: yPosition,
        head: [['Entry Time', 'Exit Time', 'Duration', 'Purpose']],
        body: visitTableData,
        theme: 'grid',
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9
        },
        bodyStyles: {
          fontSize: 8
        },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 50 },
          2: { cellWidth: 30 },
          3: { cellWidth: 45 }
        },
        margin: { left: 20, right: 20 }
      })
      
      yPosition = (this.doc as any).lastAutoTable.finalY + 10
    }
    
    // Locker Usage History Section
    if (data.locker_usage?.history && data.locker_usage.history.length > 0) {
      if (yPosition > pageHeight - 80) {
        this.doc.addPage()
        yPosition = 20
      }
      
      this.doc.setFontSize(12)
      this.doc.setFont('helvetica', 'bold')
      this.doc.text('Locker Usage History', 20, yPosition)
      yPosition += 8
      
      const lockerTableData = data.locker_usage.history.map((rental: any) => [
        rental.locker.locker_number,
        new Date(rental.start_date).toLocaleDateString(),
        rental.end_date ? new Date(rental.end_date).toLocaleDateString() : 'Active',
        rental.status,
        rental.locker.rental_fee ? `PHP ${rental.locker.rental_fee.toFixed(2)}` : 'N/A'
      ])
      
      autoTable(this.doc, {
        startY: yPosition,
        head: [['Locker Number', 'Start Date', 'End Date', 'Status', 'Fee']],
        body: lockerTableData,
        theme: 'grid',
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9
        },
        bodyStyles: {
          fontSize: 8
        },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 35 },
          2: { cellWidth: 35 },
          3: { cellWidth: 35 },
          4: { cellWidth: 35, halign: 'right' }
        },
        margin: { left: 20, right: 20 }
      })
    }
    
    // Add footer with prepared by
    const finalY = (this.doc as any).lastAutoTable?.finalY || yPosition
    const footerY = finalY + 15
    
    if (footerY + 15 > pageHeight - 20) {
      this.doc.addPage()
      const newPageY = 20
      if (preparedBy) {
        this.doc.setFontSize(9)
        this.doc.setFont('helvetica', 'normal')
        this.doc.text('Prepared by:', 20, newPageY)
        this.doc.setFont('helvetica', 'bold')
        this.doc.text(preparedBy, 20, newPageY + 7)
        this.doc.setFont('helvetica', 'normal')
        this.doc.line(20, newPageY + 9, 70, newPageY + 9)
      }
    } else {
      if (preparedBy) {
        this.doc.setFontSize(9)
        this.doc.setFont('helvetica', 'normal')
        this.doc.text('Prepared by:', 20, footerY)
        this.doc.setFont('helvetica', 'bold')
        this.doc.text(preparedBy, 20, footerY + 7)
        this.doc.setFont('helvetica', 'normal')
        this.doc.line(20, footerY + 9, 70, footerY + 9)
      }
    }
  }

  save(filename: string): void {
    this.doc.save(filename)
  }

  output(type: 'blob' | 'bloburl' | 'dataurlstring' = 'blob'): any {
    return this.doc.output(type)
  }
}
