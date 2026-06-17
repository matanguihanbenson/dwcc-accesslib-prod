'use client'

import { Button } from '@/components/ui/button'

interface ExportButtonGroupProps {
  onExportPDF?: () => void
  onExportExcel?: () => void
  onExportCSV?: () => void
  disabled?: boolean
  variant?: 'default' | 'colored'
}

export function ExportButtonGroup({
  onExportPDF,
  onExportExcel,
  onExportCSV,
  disabled = false,
  variant = 'default'
}: ExportButtonGroupProps) {
  return (
    <div className="flex gap-2">
      {onExportCSV && (
        <Button
          variant="outline"
          size="sm"
          onClick={onExportCSV}
          disabled={disabled}
          className={variant === 'colored' ? 'bg-blue-50 hover:bg-blue-100 text-blue-700' : ''}
        >
          <i className="fas fa-file-csv mr-2"></i>
          Export CSV
        </Button>
      )}
      {onExportExcel && (
        <Button
          variant="outline"
          size="sm"
          onClick={onExportExcel}
          disabled={disabled}
          className={variant === 'colored' ? 'bg-green-50 hover:bg-green-100 text-green-700' : ''}
        >
          <i className="fas fa-file-excel mr-2"></i>
          Export Excel
        </Button>
      )}
      {onExportPDF && (
        <Button
          variant="outline"
          size="sm"
          onClick={onExportPDF}
          disabled={disabled}
          className={variant === 'colored' ? 'bg-red-50 hover:bg-red-100 text-red-700' : ''}
        >
          <i className="fas fa-file-pdf mr-2"></i>
          Export PDF
        </Button>
      )}
    </div>
  )
}
