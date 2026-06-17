/**
 * Main exports for PDF/Excel report generators
 * 
 * This file provides a single import point for report generation.
 * The generators are currently using the original implementations,
 * with the modular structure available in lib/pdf/ and lib/excel/ folders
 * for gradual migration.
 * 
 * @example
 * ```typescript
 * import { PDFReportGenerator, ExcelReportGenerator } from '@/lib/report-generators'
 * 
 * const pdfGen = new PDFReportGenerator('short')
 * const excelGen = new ExcelReportGenerator()
 * ```
 */

// Export original working generators
export { PDFReportGenerator } from './pdf-report-generator'
export { ExcelReportGenerator } from './excel-report-generator'

// Re-export types from original files
export type { PaperSize, ReportData, EntranceExitReportData, LockerStatisticsReportData } from './pdf-report-generator'
