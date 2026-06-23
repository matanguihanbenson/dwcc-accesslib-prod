import * as XLSX from 'xlsx'

export interface ReportData {
  month: number
  year: number
  dailyData: Array<{
    date: string
    dayOfWeek: string
    dayOfMonth: number
    hours: Record<number, number>
    total: number
  }>
  hourlyTotals: Record<number, number>
  userTypeStats: Record<string, number>
  gradeLevelStats: Record<string, number>
  summary: {
    totalEntries: number
    totalDays: number
    averagePerDay: number
    maxOccupancy?: number
    averageOccupancy?: number
    totalUniqueUsers?: number
  }
}

export class ExcelReportGenerator {
  private readonly monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  /**
   * Library label shown in the report header. Defaults to
   * "College Library" so existing callers without a campus see
   * the same header they always have. Override with the
   * constructor argument or `setLibraryName()`.
   */
  private libraryName: string

  constructor(libraryName: string = 'College Library') {
    this.libraryName = libraryName
  }

  /** Override the library-name label on the report header. */
  setLibraryName(name: string): void {
    this.libraryName = name
  }

  /** Helper for the standard "Divine Word College of Calapan - <library>" header. */
  private libraryHeader(): string {
    return `Divine Word College of Calapan - ${this.libraryName}`
  }

  generateMonthlyStatistics(data: ReportData, dateRangeTitle?: string): XLSX.WorkBook {
    const workbook = XLSX.utils.book_new()
    const { month, year, dailyData, hourlyTotals, summary, userTypeStats, gradeLevelStats } = data

    // Monthly Statistics Sheet
    const monthlyData: any[][] = []
    
    // Header rows
    monthlyData.push([this.libraryHeader()])
    monthlyData.push([`User's Statistics for ${dateRangeTitle || `${this.monthNames[month - 1]}, ${year}`}`])
    monthlyData.push([]) // Empty row

    // Table headers
    const timeSlots = [
      '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 NN',
      '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'
    ]
    monthlyData.push(['Date', 'Day', ...timeSlots, 'Total'])

    // Daily data rows with month separators
    let grandTotal = 0
    let currentMonth: number | null = null
    
    dailyData.forEach((day: any) => {
      // Insert month separator if month changed
      const dayDate = new Date(day.date)
      const dayMonth = dayDate.getMonth()
      const dayYear = dayDate.getFullYear()
      
      if (currentMonth !== dayMonth) {
        const monthName = `${this.monthNames[dayMonth]} ${dayYear}`
        monthlyData.push([monthName, '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
        currentMonth = dayMonth
      }
      
      const isHoliday = day.holiday !== null
      const dayLabel = isHoliday ? `Holiday: ${day.holiday.name}` : day.dayOfWeek
      const row: any[] = [day.dayOfMonth, dayLabel]
      for (let hour = 7; hour <= 19; hour++) {
        row.push(isHoliday ? '-' : (day.hours[hour] || 0))
      }
      row.push(isHoliday ? '-' : day.total)
      if (!isHoliday) {
        grandTotal += day.total
      }
      monthlyData.push(row)
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
    
    // Apply styling for month separator rows
    const range = XLSX.utils.decode_range(monthlySheet['!ref'] || 'A1')
    let rowIdx = 5 // Start after headers (row 0-4)
    currentMonth = null
    
    dailyData.forEach((day: any) => {
      const dayDate = new Date(day.date)
      const dayMonth = dayDate.getMonth()
      
      if (currentMonth !== dayMonth) {
        // This row is a month separator, merge cells
        const cellAddress = XLSX.utils.encode_cell({ r: rowIdx, c: 0 })
        if (!monthlySheet['!merges']) monthlySheet['!merges'] = []
        monthlySheet['!merges'].push({
          s: { r: rowIdx, c: 0 },
          e: { r: rowIdx, c: 14 }
        })
        rowIdx++
        currentMonth = dayMonth
      }
      rowIdx++
    })
    
    XLSX.utils.book_append_sheet(workbook, monthlySheet, 'Monthly Statistics')

    // User Type Statistics Sheet
    const userTypeData: any[][] = []
    userTypeData.push([this.libraryHeader()])
    userTypeData.push([`User Type Statistics for ${this.monthNames[month - 1]}, ${year}`])
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
      gradeLevelData.push([this.libraryHeader()])
      gradeLevelData.push([`Grade Level Statistics for ${this.monthNames[month - 1]}, ${year}`])
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

  generateEntryRecordsReport(
    records: any[],
    filters: {
      userFilter: string
      userName: string
      dateFrom: string
      dateTo: string
      recordCount: number
      activeCount: number
    }
  ): void {
    const workbook = XLSX.utils.book_new()

    // Entry Records Sheet
    const recordsData: any[][] = []
    
    // Header rows
    recordsData.push([this.libraryHeader()])
    recordsData.push(['ENTRY RECORDS REPORT'])
    recordsData.push([]) // Empty row
    
    // Filter information
    recordsData.push(['User Filter:', filters.userName])
    recordsData.push(['Date Range:', `${filters.dateFrom} to ${filters.dateTo}`])
    recordsData.push(['Total Records:', filters.recordCount])
    recordsData.push(['Active Entries:', filters.activeCount])
    recordsData.push(['Completed Visits:', filters.recordCount - filters.activeCount])
    recordsData.push([]) // Empty row
    
    // Table headers
    recordsData.push([
      'Entry Time',
      'Exit Time',
      'User Name',
      'ID Number',
      'User Type',
      'Purpose',
      'Duration',
      'Status'
    ])
    
    // Data rows
    records.forEach((record: any) => {
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

      recordsData.push([
        entryTime,
        exitTime,
        record.user?.full_name || 'Unknown',
        record.user?.account_id || 'N/A',
        record.user?.user_type || 'N/A',
        record.purpose || 'General',
        record.durationText,
        record.isActive ? 'Active' : 'Completed'
      ])
    })

    const recordsSheet = XLSX.utils.aoa_to_sheet(recordsData)
    
    // Apply column widths
    recordsSheet['!cols'] = [
      { wch: 18 },  // Entry Time
      { wch: 18 },  // Exit Time
      { wch: 25 },  // User Name
      { wch: 15 },  // ID Number
      { wch: 12 },  // User Type
      { wch: 20 },  // Purpose
      { wch: 18 },  // Duration
      { wch: 12 }   // Status
    ]

    // Conditional formatting for active entries (add light orange background)
    // Note: XLSX library has limited styling support, but we can mark rows
    
    XLSX.utils.book_append_sheet(workbook, recordsSheet, 'Entry Records')

    // Summary Sheet
    const summaryData: any[][] = []
    summaryData.push(['ENTRY RECORDS SUMMARY'])
    summaryData.push([]) // Empty row
    
    summaryData.push(['Export Date:', new Date().toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })])
    summaryData.push([]) // Empty row
    
    summaryData.push(['Filter Criteria'])
    summaryData.push(['User Filter', filters.userName])
    summaryData.push(['Date From', filters.dateFrom])
    summaryData.push(['Date To', filters.dateTo])
    summaryData.push([]) // Empty row
    
    summaryData.push(['Statistics'])
    summaryData.push(['Total Records', filters.recordCount])
    summaryData.push(['Active Entries', filters.activeCount])
    summaryData.push(['Completed Visits', filters.recordCount - filters.activeCount])
    summaryData.push(['Active Percentage', `${((filters.activeCount / filters.recordCount) * 100).toFixed(1)}%`])
    summaryData.push([]) // Empty row
    
    // User type breakdown
    const userTypeCounts: Record<string, number> = {}
    records.forEach((record: any) => {
      const type = record.user?.user_type || 'Unknown'
      userTypeCounts[type] = (userTypeCounts[type] || 0) + 1
    })
    
    summaryData.push(['User Type Breakdown'])
    summaryData.push(['User Type', 'Count', 'Percentage'])
    Object.entries(userTypeCounts).forEach(([type, count]) => {
      summaryData.push([
        type,
        count,
        `${((count / filters.recordCount) * 100).toFixed(1)}%`
      ])
    })
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    summarySheet['!cols'] = [
      { wch: 20 },
      { wch: 30 },
      { wch: 15 }
    ]
    
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

    // Auto-save the workbook
    // Note: The save method is called separately in the component
    this.workbook = workbook
  }

  private workbook: XLSX.WorkBook | null = null

  save(filename: string): void {
    if (this.workbook) {
      XLSX.writeFile(this.workbook, filename)
    }
  }

  saveWorkbook(workbook: XLSX.WorkBook, filename: string): void {
    XLSX.writeFile(workbook, filename)
  }

  // Users Concurrent (Per Hour) Report
  generateUsersConcurrentReport(data: ReportData, dateRangeTitle: string): XLSX.WorkBook {
    const workbook = XLSX.utils.book_new()
    const { dailyData, hourlyTotals, summary, userTypeStats } = data

    // Main Statistics Sheet
    const statsData: any[][] = []
    
    statsData.push([this.libraryHeader()])
    statsData.push([`User's Statistics (Concurrent) for ${dateRangeTitle}`])
    statsData.push([]) // Empty row
    statsData.push(['Shows the count of library users present per hour (concurrent occupancy)'])
    statsData.push([]) // Empty row

    // Table headers
    const timeSlots = [
      '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 NN',
      '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'
    ]
    statsData.push(['Date', 'Day', ...timeSlots, 'Total'])

    // Daily data rows
    let grandTotal = 0
    dailyData.forEach((day: any) => {
      const dayDate = new Date(day.date)
      const isHoliday = !!day.holiday
      const dayLabel = isHoliday ? 'Holiday' : (day.dayOfWeek ? day.dayOfWeek.substring(0, 3) : dayDate.toLocaleDateString('en-US', { weekday: 'short' }))
      const row: any[] = [
        dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dayLabel
      ]
      let dayTotal = 0
      for (let hour = 7; hour <= 19; hour++) {
        const hourCount = day.hours[hour] || 0
        row.push(isHoliday ? '-' : hourCount)
        if (!isHoliday) {
          dayTotal += hourCount
        }
      }
      row.push(isHoliday ? '-' : dayTotal)
      if (!isHoliday) {
        grandTotal += dayTotal
      }
      statsData.push(row)
    })

    // Totals row
    const totalsRow: any[] = ['TOTAL', '']
    for (let hour = 7; hour <= 19; hour++) {
      totalsRow.push(hourlyTotals[hour] || 0)
    }
    totalsRow.push(grandTotal)
    statsData.push(totalsRow)

    // Summary
    statsData.push([]) // Empty row
    statsData.push(['Summary'])
    const totalDays = dailyData.filter((day: any) => !day.holiday).length
    const totalVisits = summary.totalEntries || 0
    const avgPerDay = totalDays > 0 ? (totalVisits / totalDays).toFixed(2) : '0.00'
    statsData.push(['Total Visits', totalVisits])
    statsData.push(['Total Days', totalDays])
    statsData.push(['Average Per Day', avgPerDay])
    statsData.push(['Total Unique Users', summary.totalUniqueUsers || 0])
    if (summary.maxOccupancy) {
      statsData.push(['Max Occupancy', summary.maxOccupancy])
    }
    if (summary.averageOccupancy) {
      statsData.push(['Average Occupancy', summary.averageOccupancy])
    }

    const statsSheet = XLSX.utils.aoa_to_sheet(statsData)
    XLSX.utils.book_append_sheet(workbook, statsSheet, 'Concurrent Statistics')

    // User Type Statistics Sheet
    if (userTypeStats && Object.keys(userTypeStats).length > 0) {
      const userTypeData: any[][] = []
      userTypeData.push([this.libraryHeader()])
      userTypeData.push([`User Type Statistics for ${dateRangeTitle}`])
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
    }

    return workbook
  }

  // Users Per Transaction Report
  generateUsersPerTransactionReport(data: ReportData, dateRangeTitle: string): XLSX.WorkBook {
    const workbook = XLSX.utils.book_new()
    const { dailyData, hourlyTotals, summary, userTypeStats } = data

    // Main Statistics Sheet
    const statsData: any[][] = []
    
    statsData.push([this.libraryHeader()])
    statsData.push([`Users per Transaction Statistics for ${dateRangeTitle}`])
    statsData.push([]) // Empty row
    statsData.push(['Shows the number of entry/exit transactions per hour'])
    statsData.push([]) // Empty row

    // Table headers
    const timeSlots = [
      '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 NN',
      '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'
    ]
    statsData.push(['Date', 'Day', ...timeSlots, 'Total'])

    // Daily data rows
    let grandTotal = 0
    dailyData.forEach((day: any) => {
      const dayDate = new Date(day.date)
      const isHoliday = !!day.holiday
      const dayLabel = isHoliday ? 'Holiday' : (day.dayOfWeek ? day.dayOfWeek.substring(0, 3) : dayDate.toLocaleDateString('en-US', { weekday: 'short' }))
      const row: any[] = [
        dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dayLabel
      ]
      let dayTotal = 0
      for (let hour = 7; hour <= 19; hour++) {
        const hourCount = day.hours[hour] || 0
        row.push(isHoliday ? '-' : hourCount)
        if (!isHoliday) {
          dayTotal += hourCount
        }
      }
      row.push(isHoliday ? '-' : dayTotal)
      if (!isHoliday) {
        grandTotal += dayTotal
      }
      statsData.push(row)
    })

    // Totals row
    const totalsRow: any[] = ['TOTAL', '']
    for (let hour = 7; hour <= 19; hour++) {
      totalsRow.push(hourlyTotals[hour] || 0)
    }
    totalsRow.push(grandTotal)
    statsData.push(totalsRow)

    // Summary
    statsData.push([]) // Empty row
    statsData.push(['Summary'])
    const totalDays = dailyData.filter((day: any) => !day.holiday).length
    const totalEntries = summary.totalEntries || 0
    const avgPerDay = totalDays > 0 ? (totalEntries / totalDays).toFixed(2) : '0.00'
    statsData.push(['Total Transactions', totalEntries])
    statsData.push(['Total Days', totalDays])
    statsData.push(['Average Per Day', avgPerDay])
    if (summary.totalUniqueUsers) {
      statsData.push(['Total Unique Users', summary.totalUniqueUsers])
    }

    const statsSheet = XLSX.utils.aoa_to_sheet(statsData)
    XLSX.utils.book_append_sheet(workbook, statsSheet, 'Transaction Statistics')

    // User Type Statistics Sheet
    if (userTypeStats && Object.keys(userTypeStats).length > 0) {
      const userTypeData: any[][] = []
      userTypeData.push([this.libraryHeader()])
      userTypeData.push([`User Type Statistics for ${dateRangeTitle}`])
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
    }

    return workbook
  }

  generateStudentVisitsByDeptGrade(data: {
    byDepartment: Array<{ name: string; code?: string; count: number }>
    byGradeLevel: Array<{ name: string; education_level?: string; count: number }>
    totals?: { totalVisits: number }
  }, dateRangeTitle: string): XLSX.WorkBook {
    const workbook = XLSX.utils.book_new()

    const deptData: any[][] = []
    deptData.push([this.libraryHeader()])
    deptData.push([`Student Visits by Department for ${dateRangeTitle}`])
    deptData.push([])
    deptData.push(['Department', 'Code', 'Visits', 'Percentage'])

    const totalVisits = data.totals?.totalVisits || data.byDepartment.reduce((s, d) => s + (d.count || 0), 0)
    data.byDepartment.forEach(d => {
      const pct = totalVisits > 0 ? `${((d.count / totalVisits) * 100).toFixed(1)}%` : '0.0%'
      deptData.push([d.name, d.code || '', d.count, pct])
    })

    const deptSheet = XLSX.utils.aoa_to_sheet(deptData)
    XLSX.utils.book_append_sheet(workbook, deptSheet, 'By Department')

    const gradeData: any[][] = []
    gradeData.push([this.libraryHeader()])
    gradeData.push([`Student Visits by Grade Level for ${dateRangeTitle}`])
    gradeData.push([])
    gradeData.push(['Grade Level', 'Education Level', 'Visits', 'Percentage'])

    const totalGradeVisits = data.byGradeLevel.reduce((s, g) => s + (g.count || 0), 0)
    data.byGradeLevel.forEach(g => {
      const pct = totalGradeVisits > 0 ? `${((g.count / totalGradeVisits) * 100).toFixed(1)}%` : '0.0%'
      gradeData.push([g.name, g.education_level || '', g.count, pct])
    })

    const gradeSheet = XLSX.utils.aoa_to_sheet(gradeData)
    XLSX.utils.book_append_sheet(workbook, gradeSheet, 'By Grade Level')

    const summaryData: any[][] = []
    summaryData.push(['Summary'])
    summaryData.push(['Total Visits (logs)', totalVisits])
    summaryData.push(['Departments Counted', data.byDepartment.length])
    summaryData.push(['Grade Levels Counted', data.byGradeLevel.length])

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

    return workbook
  }

  // Entrance/Exit Control Report
  generateEntranceExitReport(data: any, dateRangeTitle: string): XLSX.WorkBook {
    const workbook = XLSX.utils.book_new()

    // Main Statistics Sheet
    const statsData: any[][] = []
    
    statsData.push([this.libraryHeader()])
    statsData.push([`Entrance/Exit Control for ${dateRangeTitle}`])
    statsData.push([]) // Empty row
    statsData.push(['Hourly entrance/exit statistics by user type'])
    statsData.push([]) // Empty row

    // Table headers
    statsData.push(['Time Range', 'Admin', 'Faculty', 'Employee', 'Guest', 'Alumni', 'Basic Education', 'College Students', 'Total'])

    // Time range data rows
    let grandTotal = 0
    data.timeRangeData.forEach((range: any) => {
      const row: any[] = [
        range.timeRange,
        range.admin || 0,
        range.faculty || 0,
        range.employee || 0,
        range.guest || 0,
        range.alumni || 0,
        range.basicEducation || 0,
        range.collegeStudents || 0,
        range.total || 0
      ]
      grandTotal += (range.total || 0)
      statsData.push(row)
    })

    // Totals row
    const totalsRow: any[] = ['TOTAL']
    const totals = data.timeRangeData.reduce((acc: any, range: any) => ({
      admin: acc.admin + (range.admin || 0),
      faculty: acc.faculty + (range.faculty || 0),
      employee: acc.employee + (range.employee || 0),
      guest: acc.guest + (range.guest || 0),
      alumni: acc.alumni + (range.alumni || 0),
      basicEducation: acc.basicEducation + (range.basicEducation || 0),
      collegeStudents: acc.collegeStudents + (range.collegeStudents || 0)
    }), { admin: 0, faculty: 0, employee: 0, guest: 0, alumni: 0, basicEducation: 0, collegeStudents: 0 })
    
    totalsRow.push(totals.admin, totals.faculty, totals.employee, totals.guest, totals.alumni, totals.basicEducation, totals.collegeStudents, grandTotal)
    statsData.push(totalsRow)

    // Summary
    statsData.push([]) // Empty row
    statsData.push(['Summary'])
    statsData.push(['Total Entries', data.summary.totalEntries])
    statsData.push(['Total Days', data.summary.totalDays])
    statsData.push(['Average Per Day', data.summary.averagePerDay])

    const statsSheet = XLSX.utils.aoa_to_sheet(statsData)
    XLSX.utils.book_append_sheet(workbook, statsSheet, 'Entrance Exit Statistics')

    return workbook
  }

  // Locker Concurrent Report
  generateLockerConcurrentReport(data: any, dateRangeTitle: string): XLSX.WorkBook {
    const workbook = XLSX.utils.book_new()

    // Main Statistics Sheet
    const statsData: any[][] = []
    
    statsData.push([this.libraryHeader()])
    statsData.push([`Locker Concurrent Statistics for ${dateRangeTitle}`])
    statsData.push([]) // Empty row
    statsData.push(['Shows the number of active locker rentals per hour'])
    statsData.push([]) // Empty row

    // Table headers
    const timeSlots = [
      '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 NN',
      '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'
    ]
    statsData.push(['Date', 'Day', ...timeSlots, 'Total'])

    // Daily data rows
    let grandTotal = 0
    data.dailyData.forEach((day: any) => {
      const dayDate = new Date(day.date)
      const isHoliday = !!day.holiday
      const dayLabel = isHoliday ? 'Holiday' : (day.dayOfWeek ? day.dayOfWeek.substring(0, 3) : dayDate.toLocaleDateString('en-US', { weekday: 'short' }))
      const row: any[] = [
        dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dayLabel
      ]
      let dayTotal = 0
      for (let hour = 7; hour <= 19; hour++) {
        const hourCount = day.hours[hour] || 0
        row.push(isHoliday ? '-' : hourCount)
        if (!isHoliday) {
          dayTotal += hourCount
        }
      }
      row.push(isHoliday ? '-' : dayTotal)
      if (!isHoliday) {
        grandTotal += dayTotal
      }
      statsData.push(row)
    })

    // Totals row
    const totalsRow: any[] = ['TOTAL', '']
    for (let hour = 7; hour <= 19; hour++) {
      totalsRow.push(data.hourlyTotals[hour] || 0)
    }
    totalsRow.push(grandTotal)
    statsData.push(totalsRow)

    // Summary
    statsData.push([]) // Empty row
    statsData.push(['Summary'])
    const totalDays = data.dailyData.filter((day: any) => !day.holiday).length
    const totalAssignments = data.summary.totalAssignments || 0
    const avgPerDay = totalDays > 0 ? (totalAssignments / totalDays).toFixed(2) : '0.00'
    statsData.push(['Total Active Rentals', totalAssignments])
    statsData.push(['Total Days', totalDays])
    statsData.push(['Average Per Day', avgPerDay])

    const statsSheet = XLSX.utils.aoa_to_sheet(statsData)
    XLSX.utils.book_append_sheet(workbook, statsSheet, 'Locker Concurrent')

    return workbook
  }

  // Locker Per Transaction Report
  generateLockerPerTransactionReport(data: any, dateRangeTitle: string): XLSX.WorkBook {
    const workbook = XLSX.utils.book_new()

    // Main Statistics Sheet
    const statsData: any[][] = []
    
    statsData.push([this.libraryHeader()])
    statsData.push([`Locker Usage Statistics for ${dateRangeTitle}`])
    statsData.push([]) // Empty row
    statsData.push(['Shows the number of locker rental transactions per hour'])
    statsData.push([]) // Empty row

    // Table headers
    const timeSlots = [
      '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 NN',
      '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'
    ]
    statsData.push(['Date', 'Day', ...timeSlots, 'Total'])

    // Daily data rows
    let grandTotal = 0
    data.dailyData.forEach((day: any) => {
      const dayDate = new Date(day.date)
      const isHoliday = !!day.holiday
      const dayLabel = isHoliday ? 'Holiday' : (day.dayOfWeek ? day.dayOfWeek.substring(0, 3) : dayDate.toLocaleDateString('en-US', { weekday: 'short' }))
      const row: any[] = [
        dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dayLabel
      ]
      let dayTotal = 0
      for (let hour = 7; hour <= 19; hour++) {
        const hourCount = day.hours[hour] || 0
        row.push(isHoliday ? '-' : hourCount)
        if (!isHoliday) {
          dayTotal += hourCount
        }
      }
      row.push(isHoliday ? '-' : dayTotal)
      if (!isHoliday) {
        grandTotal += dayTotal
      }
      statsData.push(row)
    })

    // Totals row
    const totalsRow: any[] = ['TOTAL', '']
    for (let hour = 7; hour <= 19; hour++) {
      totalsRow.push(data.hourlyTotals[hour] || 0)
    }
    totalsRow.push(grandTotal)
    statsData.push(totalsRow)

    // Summary
    statsData.push([]) // Empty row
    statsData.push(['Summary'])
    const totalDays = data.dailyData.filter((day: any) => !day.holiday).length
    const totalTransactions = data.summary.totalTransactions || 0
    const avgPerDay = totalDays > 0 ? (totalTransactions / totalDays).toFixed(2) : '0.00'
    statsData.push(['Total Transactions', totalTransactions])
    statsData.push(['Total Days', totalDays])
    statsData.push(['Average Per Day', avgPerDay])

    const statsSheet = XLSX.utils.aoa_to_sheet(statsData)
    XLSX.utils.book_append_sheet(workbook, statsSheet, 'Locker Usage')

    return workbook
  }

  // Individual User Report
  generateIndividualUserReport(data: any, dateRangeTitle: string): XLSX.WorkBook {
    const workbook = XLSX.utils.book_new()

    // User Information Sheet
    const userInfoData: any[][] = []
    userInfoData.push([this.libraryHeader()])
    userInfoData.push([`Individual User Statistics for ${dateRangeTitle}`])
    userInfoData.push([]) // Empty row
    
    userInfoData.push(['User Information'])
    userInfoData.push(['ID Number', data.user.account_id])
    userInfoData.push(['Full Name', data.user.full_name])
    userInfoData.push(['User Type', data.user.user_type])
    if (data.user.department) {
      userInfoData.push(['Department', data.user.department])
    }
    if (data.user.program) {
      userInfoData.push(['Program', data.user.program])
    }
    userInfoData.push([]) // Empty row

    // Summary Statistics
    userInfoData.push(['Summary Statistics'])
    userInfoData.push(['Total Books Borrowed', data.borrowing?.summary?.total_borrowed || 0])
    userInfoData.push(['Currently Borrowed', data.borrowing?.summary?.currently_borrowed || 0])
    userInfoData.push(['Total Visits', data.visits?.summary?.total_visits || 0])
    userInfoData.push(['Avg Duration (minutes)', data.visits?.summary?.avg_duration_minutes || 0])
    userInfoData.push(['Total Penalties', `₱${(data.penalties?.summary?.total_penalties || 0).toFixed(2)}`])
    userInfoData.push(['Total Balance', `₱${(data.penalties?.summary?.total_balance || 0).toFixed(2)}`])
    userInfoData.push(['Total Locker Rentals', data.locker_usage?.summary?.total_rentals || 0])
    userInfoData.push(['Current Rental Status', data.locker_usage?.summary?.current_rental ? 'Active rental' : 'No active rental'])

    const userInfoSheet = XLSX.utils.aoa_to_sheet(userInfoData)
    XLSX.utils.book_append_sheet(workbook, userInfoSheet, 'User Information')

    // Borrowing History Sheet
    if (data.borrowing?.history && data.borrowing.history.length > 0) {
      const borrowingData: any[][] = []
      borrowingData.push(['Borrowing History'])
      borrowingData.push([]) // Empty row
      borrowingData.push(['Book Title', 'Borrow Date', 'Due Date', 'Return Date', 'Status'])

      data.borrowing.history.forEach((item: any) => {
        borrowingData.push([
          item.book.title,
          new Date(item.borrow_date).toLocaleDateString(),
          new Date(item.due_date).toLocaleDateString(),
          item.return_date ? new Date(item.return_date).toLocaleDateString() : 'Not returned',
          item.status
        ])
      })

      const borrowingSheet = XLSX.utils.aoa_to_sheet(borrowingData)
      XLSX.utils.book_append_sheet(workbook, borrowingSheet, 'Borrowing History')
    }

    // Visit History Sheet
    if (data.visits?.history && data.visits.history.length > 0) {
      const visitsData: any[][] = []
      visitsData.push(['Visit History'])
      visitsData.push([]) // Empty row
      visitsData.push(['Entry Time', 'Exit Time', 'Duration', 'Purpose'])

      data.visits.history.forEach((visit: any) => {
        visitsData.push([
          new Date(visit.entry_time).toLocaleString(),
          visit.exit_time ? new Date(visit.exit_time).toLocaleString() : 'Still Inside',
          visit.duration || 'N/A',
          visit.purpose || 'General'
        ])
      })

      const visitsSheet = XLSX.utils.aoa_to_sheet(visitsData)
      XLSX.utils.book_append_sheet(workbook, visitsSheet, 'Visit History')
    }

    // Penalties Sheet
    if (data.penalties?.history && data.penalties.history.length > 0) {
      const penaltiesData: any[][] = []
      penaltiesData.push(['Penalty History'])
      penaltiesData.push([]) // Empty row
      penaltiesData.push(['Date', 'Type', 'Amount', 'Paid', 'Balance', 'Reason', 'Status'])

      data.penalties.history.forEach((penalty: any) => {
        penaltiesData.push([
          new Date(penalty.created_at).toLocaleDateString(),
          penalty.penalty_type,
          `₱${penalty.amount.toFixed(2)}`,
          `₱${penalty.amount_paid.toFixed(2)}`,
          `₱${penalty.balance.toFixed(2)}`,
          penalty.reason || 'N/A',
          penalty.status
        ])
      })

      const penaltiesSheet = XLSX.utils.aoa_to_sheet(penaltiesData)
      XLSX.utils.book_append_sheet(workbook, penaltiesSheet, 'Penalty History')
    }

    // Locker Usage Sheet
    if (data.locker_usage?.history && data.locker_usage.history.length > 0) {
      const lockersData: any[][] = []
      lockersData.push(['Locker Usage History'])
      lockersData.push([]) // Empty row
      lockersData.push(['Locker Number', 'Start Date', 'End Date', 'Status', 'Fee'])

      data.locker_usage.history.forEach((rental: any) => {
        lockersData.push([
          rental.locker.locker_number,
          new Date(rental.start_date).toLocaleDateString(),
          rental.end_date ? new Date(rental.end_date).toLocaleDateString() : 'Active',
          rental.status,
          rental.locker.rental_fee ? `₱${rental.locker.rental_fee.toFixed(2)}` : 'N/A'
        ])
      })

      const lockersSheet = XLSX.utils.aoa_to_sheet(lockersData)
      XLSX.utils.book_append_sheet(workbook, lockersSheet, 'Locker Usage')
    }

    return workbook
  }

  /**
   * Summary of Fines — per-borrower breakdown. Same shape as
   * `generateFinesSummaryReport` in the PDF generator.
   *
   * Renders two sheets:
   *   1. "Fines Summary" — one row per borrower with per-type
   *      and combined totals. Columns adapt to the report
   *      `type` (combined / book / locker).
   *   2. "Grand Totals"  — overall summary.
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
    dateRangeTitle: string
  ): XLSX.WorkBook {
    const workbook = XLSX.utils.book_new()
    const type = data.type || 'combined'
    const showBook = type !== 'locker'
    const showLocker = type !== 'book'
    const typeLabel =
      type === 'book'
        ? 'Book Fines Only'
        : type === 'locker'
          ? 'Locker Fines Only'
          : 'Combined (Book + Locker)'

    const main: any[][] = []
    main.push([this.libraryHeader()])
    main.push([`Summary of Fines — ${typeLabel}`])
    main.push([`For ${dateRangeTitle}`])
    main.push([])

    const head: string[] = ['#', 'Borrower', 'ID Number', 'User Type']
    if (showBook) head.push('Book Penalty', 'Book Paid', 'Book Remaining', '# Book')
    if (showLocker)
      head.push('Locker Penalty', 'Locker Paid', 'Locker Remaining', '# Locker')
    if (type === 'combined') {
      head.push('Total Penalty', 'Total Paid', 'Total Remaining')
    }
    main.push(head)

    if (data.rows.length === 0) {
      main.push(['—', 'No borrowers with fines in this range', '', '', '', '', '', '', '', '', '', '', ''].slice(0, head.length))
    } else {
      data.rows.forEach((r, i) => {
        const u = r.user || {}
        const row: any[] = [i + 1, u.full_name || 'Unknown', u.account_id || '—', u.user_type || '—']
        if (showBook) {
          row.push(
            Number(r.book.total),
            Number(r.book.paid),
            Number(r.book.remaining),
            r.book.count
          )
        }
        if (showLocker) {
          row.push(
            Number(r.locker.total),
            Number(r.locker.paid),
            Number(r.locker.remaining),
            r.locker.count
          )
        }
        if (type === 'combined') {
          row.push(
            Number(r.combined.total),
            Number(r.combined.paid),
            Number(r.combined.remaining)
          )
        }
        main.push(row)
      })
    }

    const mainSheet = XLSX.utils.aoa_to_sheet(main)
    // Set column widths for readability. Compute the # of columns dynamically.
    const totalCols = head.length
    const colWidths: any[] = []
    colWidths[0] = { wch: 4 } // #
    colWidths[1] = { wch: 30 } // Borrower
    colWidths[2] = { wch: 18 } // ID
    colWidths[3] = { wch: 14 } // Type
    for (let i = 4; i < totalCols; i++) colWidths[i] = { wch: 16 }
    mainSheet['!cols'] = colWidths
    XLSX.utils.book_append_sheet(workbook, mainSheet, 'Fines Summary')

    // Grand Totals sheet
    const grand = data.grand || {
      total: data.rows.reduce((s, r) => s + r.combined.total, 0),
      paid: data.rows.reduce((s, r) => s + r.combined.paid, 0),
      remaining: data.rows.reduce((s, r) => s + r.combined.remaining, 0),
      borrower_count: data.rows.length,
      settlement_count: data.rows.reduce((s, r) => s + r.combined.count, 0)
    }
    const totals: any[][] = [
      [this.libraryHeader()],
      [`Summary of Fines — Grand Totals (${typeLabel})`],
      [`For ${dateRangeTitle}`],
      [],
      ['Metric', 'Value'],
      ['Total Penalty', Number(grand.total)],
      ['Total Paid', Number(grand.paid)],
      ['Remaining Unpaid', Number(grand.remaining)],
      ['Borrowers with Fines', grand.borrower_count],
      ['Total Settlements', grand.settlement_count]
    ]
    const totalsSheet = XLSX.utils.aoa_to_sheet(totals)
    totalsSheet['!cols'] = [{ wch: 28 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(workbook, totalsSheet, 'Grand Totals')

    return workbook
  }
}
