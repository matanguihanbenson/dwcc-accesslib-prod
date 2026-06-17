import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { EntranceExitReportData } from '../types'
import { MONTH_NAMES, addReportHeader } from '../utils'

export function generateEntranceExitStatistics(
  doc: jsPDF,
  data: EntranceExitReportData,
  preparedBy: string = '',
  dateRangeTitle?: string
): void {
  const { month, year, timeRangeData, summary } = data

  const pageWidth = doc.internal.pageSize.getWidth()
  const centerX = pageWidth / 2

  // Custom header for entrance/exit report
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('DIVINE WORD COLLEGE OF CALAPAN', centerX, 15, { align: 'center' })
  
  doc.setFontSize(9)
  doc.text('COLLEGE LIBRARY', centerX, 21, { align: 'center' })
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('ATTENDANCE REPORT', centerX, 27, { align: 'center' })
  
  doc.setFont('helvetica', 'bold')
  doc.text('ENTRANCE / EXIT CONTROL', centerX, 32, { align: 'center' })
  
  doc.setFont('helvetica', 'normal')
  doc.text(`for ${dateRangeTitle || `the month of ${MONTH_NAMES[month - 1]}, ${year}`}`, centerX, 37, { align: 'center' })

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

  // Calculate totals
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

  // Generate table
  autoTable(doc, {
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
      0: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 18, halign: 'center' },
      7: { cellWidth: 18, halign: 'center' },
      8: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }
    },
    margin: { left: 10, right: 10 },
    didParseCell: (data: any) => {
      if (data.row.index === tableData.length - 1 && data.row.section === 'body') {
        data.cell.styles.fillColor = [240, 240, 240]
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fontSize = 8
      }
    }
  })

  // Footer
  const finalY = (doc as any).lastAutoTable.finalY + 10

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`Total Entries: ${summary.totalEntries}`, 20, finalY)
  doc.text(`Peak Time Range: ${summary.peakTimeRange}`, 20, finalY + 5)
  doc.text(`Average Per Hour: ${summary.averagePerHour}`, 20, finalY + 10)

  if (preparedBy) {
    doc.text('Prepared by:', pageWidth - 70, finalY)
    doc.setFont('helvetica', 'bold')
    doc.text(preparedBy, pageWidth - 70, finalY + 6)
    doc.line(pageWidth - 70, finalY + 7, pageWidth - 20, finalY + 7)
  }
}
