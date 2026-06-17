import React from 'react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
  className?: string
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  className = ''
}) => {
  if (totalPages <= 1) return null

  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems)

  // Generate page numbers with smart ellipsis (1, 2, 3, ..., 48, 49, 50)
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxPagesToShow = 7 
    
    if (totalPages <= maxPagesToShow) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      // Show ellipsis if current page is far from start
      if (currentPage > 3) {
        pages.push('...')
      }

      // Show pages around current page
      const startPage = Math.max(2, currentPage - 1)
      const endPage = Math.min(totalPages - 1, currentPage + 1)

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i)
      }

      // Show ellipsis if current page is far from end
      if (currentPage < totalPages - 2) {
        pages.push('...')
      }

      // Always show last page
      pages.push(totalPages)
    }

    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${className}`}>
      {/* Items count */}
      <div className="text-sm text-gray-600">
        Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
        <span className="font-medium">{endIndex}</span> of{' '}
        <span className="font-medium">{totalItems}</span> items
      </div>

      {/* Pagination controls */}
      <div className="flex items-center space-x-2">
        {/* First button */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="First Page"
        >
          <i className="fas fa-angle-double-left"></i>
        </button>

        {/* Previous button */}
        <button
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>

        {/* Page numbers */}
        <div className="flex items-center space-x-1">
          {pageNumbers.map((pageNumber, index) => 
            typeof pageNumber === 'string' ? (
              <span key={`ellipsis-${index}`} className="px-2 text-gray-500">
                {pageNumber}
              </span>
            ) : (
              <button
                key={pageNumber}
                onClick={() => onPageChange(pageNumber)}
                className={`px-3 py-1 text-sm font-medium border rounded-md ${
                  currentPage === pageNumber
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {pageNumber}
              </button>
            )
          )}
        </div>

        {/* Next button */}
        <button
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>

        {/* Last button */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Last Page"
        >
          <i className="fas fa-angle-double-right"></i>
        </button>
      </div>
    </div>
  )
}

interface PaginationControlsProps {
  currentPage: number
  totalPages: number
  itemsPerPage: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (itemsPerPage: number) => void
  className?: string
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  className = ''
}) => {
  const itemsPerPageOptions = [10, 25, 50, 100]

  return (
    <div className={`flex flex-col sm:flex-row gap-4 ${className}`}>
      {/* Items per page selector */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Per Page:</label>
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {itemsPerPageOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
