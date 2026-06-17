import * as XLSX from 'xlsx'
import { EntryRecordFilters } from '../types'

/**
 * Generates entry records report workbook
 */
export function generateEntryRecordsReport(
  records: any[],
  filters: EntryRecordFilters
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new()

  // Entry Records Sheet
  const recordsData: any[][] = []
  
  // Header rows
  recordsData.push(['Divine Word College of Calapan - College Library'])
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
    'Duration (hrs)',
    'User ID',
    'User Name',
    'User Type',
    'Department/Program',
    'Status'
  ])

  // Records data
  records.forEach(record => {
    const duration = record.duration_hours !== null && record.duration_hours !== undefined
      ? record.duration_hours.toFixed(2)
      : '-'
    
    const exitTime = record.exit_time
      ? new Date(record.exit_time).toLocaleString()
      : '-'
    
    const status = record.exit_time ? 'Completed' : 'Active'
    
    const deptOrProgram = record.user.user_type === 'STUDENT'
      ? (record.user.program?.name || '-')
      : (record.user.department_ref?.name || record.user.office_ref?.name || '-')

    recordsData.push([
      new Date(record.entry_time).toLocaleString(),
      exitTime,
      duration,
      record.user.account_id || record.user.user_id,
      `${record.user.last_name}, ${record.user.first_name}${record.user.middle_name ? ' ' + record.user.middle_name : ''}`,
      record.user.user_type,
      deptOrProgram,
      status
    ])
  })

  const recordsSheet = XLSX.utils.aoa_to_sheet(recordsData)
  
  // Set column widths
  recordsSheet['!cols'] = [
    { wch: 20 }, // Entry Time
    { wch: 20 }, // Exit Time
    { wch: 15 }, // Duration
    { wch: 15 }, // User ID
    { wch: 30 }, // User Name
    { wch: 12 }, // User Type
    { wch: 25 }, // Department/Program
    { wch: 12 }  // Status
  ]

  XLSX.utils.book_append_sheet(workbook, recordsSheet, 'Entry Records')

  return workbook
}
