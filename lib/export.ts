import * as XLSX from 'xlsx'

export interface ExportColumn {
  key: string
  header: string
  width?: number
  format?: (value: any) => string
}

export interface ExportOptions {
  filename?: string
  sheetName?: string
  columns: ExportColumn[]
  data: any[]
}

export class ExportService {
  static toExcel(options: ExportOptions) {
    const { filename = 'export', sheetName = 'Sheet1', columns, data } = options

    const headers = columns.map(col => col.header)
    const rows = data.map(item => 
      columns.map(col => {
        const value = item[col.key]
        return col.format ? col.format(value) : value
      })
    )

    const worksheetData = [headers, ...rows]
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

    columns.forEach((col, index) => {
      if (col.width) {
        if (!worksheet['!cols']) worksheet['!cols'] = []
        worksheet['!cols'][index] = { width: col.width }
      }
    })

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

    const timestamp = new Date().toISOString().slice(0, 10)
    const fullFilename = `${filename}_${timestamp}.xlsx`

    XLSX.writeFile(workbook, fullFilename)
  }

  static toCSV(options: ExportOptions) {
    const { filename = 'export', columns, data } = options

    const headers = columns.map(col => col.header).join(',')
    const rows = data.map(item => 
      columns.map(col => {
        const value = item[col.key]
        const formatted = col.format ? col.format(value) : value
        return `"${String(formatted).replace(/"/g, '""')}"`
      }).join(',')
    )

    const csv = [headers, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    
    const timestamp = new Date().toISOString().slice(0, 10)
    const fullFilename = `${filename}_${timestamp}.csv`
    link.setAttribute('download', fullFilename)
    
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  static print(title: string, content: string, styles?: string) {
    const printWindow = window.open('', '_blank')
    
    if (!printWindow) {
      throw new Error('Unable to open print window. Please check your popup blocker.')
    }

    const defaultStyles = `
      <style>
        body { 
          font-family: Arial, sans-serif; 
          margin: 20px; 
          color: #333;
        }
        h1 { 
          color: #2563eb; 
          border-bottom: 2px solid #2563eb; 
          padding-bottom: 10px; 
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 20px; 
        }
        th, td { 
          border: 1px solid #ddd; 
          padding: 8px; 
          text-align: left; 
        }
        th { 
          background-color: #f8fafc; 
          font-weight: bold; 
        }
        .header { 
          text-align: center; 
          margin-bottom: 20px; 
        }
        .footer { 
          margin-top: 30px; 
          text-align: center; 
          font-size: 12px; 
          color: #666; 
        }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
      </style>
    `

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          ${defaultStyles}
          ${styles || ''}
        </head>
        <body>
          <div class="header">
            <h1>${title}</h1>
            <p>Generated on: ${new Date().toLocaleString()}</p>
          </div>
          ${content}
          <div class="footer">
            <p>© ${new Date().getFullYear()} Divine Word College of Calapan - Library Management System</p>
          </div>
        </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.focus()
    
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
  }

  static generateTableHTML(columns: ExportColumn[], data: any[]): string {
    const headers = columns.map(col => `<th>${col.header}</th>`).join('')
    const rows = data.map(item => {
      const cells = columns.map(col => {
        const value = item[col.key]
        const formatted = col.format ? col.format(value) : value
        return `<td>${formatted || '-'}</td>`
      }).join('')
      return `<tr>${cells}</tr>`
    }).join('')

    return `
      <table>
        <thead>
          <tr>${headers}</tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `
  }

  static downloadJSON(data: any, filename: string = 'data') {
    const jsonString = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    
    const timestamp = new Date().toISOString().slice(0, 10)
    const fullFilename = `${filename}_${timestamp}.json`
    link.setAttribute('download', fullFilename)
    
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

export const exportData = ExportService
