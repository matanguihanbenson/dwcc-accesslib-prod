import jsPDF from 'jspdf'
import { PaperSize } from './types'

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export const TIME_SLOTS_SHORT = [
  '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 NN',
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'
]

export const TIME_SLOTS_EXTENDED = [
  '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 NN',
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'
]

export function createPDFDocument(paperSize: PaperSize = 'short'): jsPDF {
  const paperFormats = {
    short: [215.9, 279.4],  // 8.5" x 11" in mm
    long: [215.9, 330.2],   // 8.5" x 13" in mm
    a4: [210, 297]          // A4 standard
  }

  return new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: paperFormats[paperSize]
  })
}

export function addReportHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  centerX: number
): void {
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Divine Word College of Calapan', centerX, 15, { align: 'center' })
  
  doc.setFontSize(9)
  doc.text('College Library', centerX, 21, { align: 'center' })
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(title, centerX, 27, { align: 'center' })
  doc.text(subtitle, centerX, 32, { align: 'center' })
}

export function insertMonthSeparators(
  dailyData: any[],
  monthNames: string[] = MONTH_NAMES
): { data: any[], monthRowIndices: number[] } {
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
      const monthName = `${monthNames[dayMonth]} ${dayYear}`
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

export function formatMonthYearTitle(month: number, year: number, monthNames: string[] = MONTH_NAMES): string {
  return `the month of ${monthNames[month - 1]}, ${year}`
}

export function addFooter(
  doc: jsPDF,
  finalY: number,
  pageHeight: number,
  pageWidth: number,
  summary: { totalEntries?: number; totalAssignments?: number; averagePerDay: number },
  preparedBy: string = ''
): void {
  // Check if footer will fit on current page, otherwise add new page
  if (finalY + 20 > pageHeight - 20) {
    doc.addPage()
    const newPageY = 20
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    
    const total = summary.totalEntries ?? summary.totalAssignments ?? 0
    doc.text(`Total Entries: ${total}`, 20, newPageY)
    doc.text(`Average Per Day: ${summary.averagePerDay}`, 20, newPageY + 5)

    if (preparedBy) {
      doc.text('Prepared by:', pageWidth - 70, newPageY)
      doc.setFont('helvetica', 'bold')
      doc.text(preparedBy, pageWidth - 70, newPageY + 6)
    }
  } else {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    
    const total = summary.totalEntries ?? summary.totalAssignments ?? 0
    doc.text(`Total Entries: ${total}`, 20, finalY)
    doc.text(`Average Per Day: ${summary.averagePerDay}`, 20, finalY + 5)

    if (preparedBy) {
      doc.text('Prepared by:', pageWidth - 70, finalY)
      doc.setFont('helvetica', 'bold')
      doc.text(preparedBy, pageWidth - 70, finalY + 6)
    }
  }
}
