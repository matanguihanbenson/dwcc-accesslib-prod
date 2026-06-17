'use client'

import React, { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { PublicHeader, PublicFooter } from '@/components/layout'

interface Book {
  book_id: number
  title: string
  subtitle?: string
  book_author: string
  authors: string[]
  category: string
  section?: string
  status: string
  isbn?: string
  publisher?: string
  year_published?: number
  copies_available: number
  copies_total: number
  description?: string
  summary?: string
  material_type: string
  location?: string
  language?: string
}

interface BooksResponse {
  success: boolean
  books: Book[]
  categories: string[]
  sections: string[]
  materialTypes: string[]
  languages: string[]
  yearRange: {
    min: number
    max: number
  }
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasMore: boolean
  }
}

function BrowseContent() {
  const searchParams = useSearchParams()
  const [books, setBooks] = useState<Book[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [sections, setSections] = useState<string[]>([])
  const [materialTypes, setMaterialTypes] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [yearRange, setYearRange] = useState({ min: 1900, max: new Date().getFullYear() })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState(searchParams?.get('search') || '')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [selectedMaterialType, setSelectedMaterialType] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('')
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [sortBy, setSortBy] = useState('title')
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    fetchBooks()
  }, [searchTerm, selectedCategory, selectedSection, selectedMaterialType, selectedLanguage, yearFrom, yearTo, availableOnly, sortBy, currentPage])

  const fetchBooks = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      })
      
      if (searchTerm) params.append('search', searchTerm)
      if (selectedCategory) params.append('category', selectedCategory)
      if (selectedSection) params.append('section', selectedSection)
      if (selectedMaterialType) params.append('materialType', selectedMaterialType)
      if (selectedLanguage) params.append('language', selectedLanguage)
      if (yearFrom) params.append('yearFrom', yearFrom)
      if (yearTo) params.append('yearTo', yearTo)
      if (availableOnly) params.append('availableOnly', 'true')
      if (sortBy) params.append('sortBy', sortBy)
      
      const response = await fetch(`/api/public/books?${params.toString()}`)
      
      if (response.ok) {
        const data: BooksResponse = await response.json()
        setBooks(data.books)
        setCategories(data.categories)
        setSections(data.sections || [])
        setMaterialTypes(data.materialTypes || [])
        setLanguages(data.languages || [])
        setYearRange(data.yearRange || { min: 1900, max: new Date().getFullYear() })
        setTotalCount(data.pagination.totalCount)
        setTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchBooks()
  }

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category)
    setCurrentPage(1)
  }

  const clearAllFilters = () => {
    setSearchTerm('')
    setSelectedCategory('')
    setSelectedSection('')
    setSelectedMaterialType('')
    setSelectedLanguage('')
    setYearFrom('')
    setYearTo('')
    setAvailableOnly(false)
    setSortBy('title')
    setCurrentPage(1)
  }

  const activeFiltersCount = [
    selectedCategory,
    selectedSection,
    selectedMaterialType,
    selectedLanguage,
    yearFrom,
    yearTo,
    availableOnly
  ].filter(Boolean).length

  const handleBookClick = (bookId: number) => {
    window.location.href = `/books/${bookId}`
  }

  // Google-style pagination helper
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisible = 10
    
    if (totalPages <= maxVisible) {
      // Show all pages if total is less than max
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)
      
      if (currentPage > 3) {
        pages.push('...')
      }
      
      // Show pages around current page
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('...')
      }
      
      // Always show last page
      pages.push(totalPages)
    }
    
    return pages
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader showSubtitle={true} subtitle="Browse Books" />

      {/* Search Section */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <form onSubmit={handleSearch} className="max-w-3xl mx-auto">
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by title, author, publisher, ISBN..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors font-medium"
              >
                <i className="fas fa-search mr-2"></i>
                Search
              </button>
            </div>
          </form>

          {/* Advanced Filters Toggle */}
          <div className="text-center mt-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-sm text-green-600 hover:text-green-800 transition-colors font-medium"
            >
              <i className={`fas fa-${showFilters ? 'chevron-up' : 'chevron-down'} mr-2`}></i>
              {showFilters ? 'Hide' : 'Show'} Advanced Filters
              {activeFiltersCount > 0 && ` (${activeFiltersCount} active)`}
            </button>
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Category Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <i className="fas fa-folder text-green-600 mr-2"></i>
                    Category
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Section Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <i className="fas fa-bookmark text-blue-600 mr-2"></i>
                    Section
                  </label>
                  <select
                    value={selectedSection}
                    onChange={(e) => { setSelectedSection(e.target.value); setCurrentPage(1); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">All Sections</option>
                    {sections.map((sec) => (
                      <option key={sec} value={sec}>{sec}</option>
                    ))}
                  </select>
                </div>

                {/* Material Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <i className="fas fa-book text-purple-600 mr-2"></i>
                    Material Type
                  </label>
                  <select
                    value={selectedMaterialType}
                    onChange={(e) => { setSelectedMaterialType(e.target.value); setCurrentPage(1); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">All Types</option>
                    {materialTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Language Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <i className="fas fa-language text-orange-600 mr-2"></i>
                    Language
                  </label>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => { setSelectedLanguage(e.target.value); setCurrentPage(1); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">All Languages</option>
                    {languages.map((lang) => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                </div>

                {/* Year From */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <i className="fas fa-calendar text-indigo-600 mr-2"></i>
                    Year From
                  </label>
                  <input
                    type="number"
                    placeholder={`Min: ${yearRange.min}`}
                    value={yearFrom}
                    onChange={(e) => { setYearFrom(e.target.value); setCurrentPage(1); }}
                    min={yearRange.min}
                    max={yearRange.max}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                {/* Year To */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <i className="fas fa-calendar-check text-indigo-600 mr-2"></i>
                    Year To
                  </label>
                  <input
                    type="number"
                    placeholder={`Max: ${yearRange.max}`}
                    value={yearTo}
                    onChange={(e) => { setYearTo(e.target.value); setCurrentPage(1); }}
                    min={yearRange.min}
                    max={yearRange.max}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                {/* Sort By */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <i className="fas fa-sort text-gray-600 mr-2"></i>
                    Sort By
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="title">Title (A-Z)</option>
                    <option value="year_desc">Year (Newest First)</option>
                    <option value="year_asc">Year (Oldest First)</option>
                    <option value="recent">Recently Added</option>
                  </select>
                </div>

                {/* Availability Toggle */}
                <div className="flex items-end">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={availableOnly}
                      onChange={(e) => { setAvailableOnly(e.target.checked); setCurrentPage(1); }}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      <i className="fas fa-check-circle text-green-600 mr-2"></i>
                      Available Only
                    </span>
                  </label>
                </div>
              </div>

              {/* Clear Filters */}
              {activeFiltersCount > 0 && (
                <div className="mt-4 text-center">
                  <button
                    onClick={clearAllFilters}
                    className="px-4 py-2 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
                  >
                    <i className="fas fa-times mr-2"></i>
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Quick Category Chips */}
        {!showFilters && categories.length > 0 && (
          <div className="mb-6">
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => handleCategoryChange('')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === ''
                    ? 'bg-green-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-green-500 hover:text-green-600'
                }`}
              >
                All ({totalCount})
              </button>
              {categories.slice(0, 8).map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategoryChange(category)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedCategory === category
                      ? 'bg-green-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-300 hover:border-green-500 hover:text-green-600'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Books Grid */}
        <div>
          {/* Results Summary */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {loading ? (
                  'Loading...'
                ) : (
                  <>
                    Showing <span className="font-semibold text-gray-900">{books.length}</span> of{' '}
                    <span className="font-semibold text-gray-900">{totalCount}</span> books
                    {searchTerm && <span className="text-gray-500"> for "{searchTerm}"</span>}
                  </>
                )}
              </p>
              
              {/* Active Filters Badge */}
              {activeFiltersCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    <i className="fas fa-filter text-green-600 mr-1"></i>
                    {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} active
                  </span>
                  <button
                    onClick={clearAllFilters}
                    className="text-sm text-red-600 hover:text-red-800 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                  <div className="h-6 bg-gray-200 rounded mb-3 w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2 w-1/4"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2 w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : books.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-book-open text-5xl text-gray-300 mb-4"></i>
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                No books found
              </h3>
              <p className="text-gray-600">
                {searchTerm || selectedCategory
                  ? 'Try adjusting your search or filters'
                  : 'No books are currently available in the library'}
              </p>
            </div>
          ) : (
            <>
              {/* Books List */}
              <div className="space-y-3">
                {books.map((book) => (
                  <div
                    key={book.book_id}
                    onClick={() => handleBookClick(book.book_id)}
                    className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer p-4 border border-gray-100"
                  >
                    {/* Title and Subtitle */}
                    <h3 className="text-lg font-medium text-blue-600 hover:text-blue-800 hover:underline mb-1 line-clamp-1">
                      {book.title}
                      {book.subtitle && <span className="text-gray-600"> - {book.subtitle}</span>}
                    </h3>
                    
                    {/* URL-style breadcrumb */}
                    <div className="flex items-center text-xs text-green-700 mb-2">
                      <span>DWCC Library › {book.category}</span>
                      {book.section && <span> › {book.section}</span>}
                    </div>
                    
                    {/* Summary/Description */}
                    {(book.summary || book.description) && (
                      <p className="text-sm text-gray-700 mb-2 line-clamp-2">
                        {book.summary || book.description}
                      </p>
                    )}
                    
                    {/* Author and Publication Info */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 mb-2">
                      <span>
                        <strong>by</strong> {book.book_author}
                      </span>
                      {book.publisher && <span>• {book.publisher}</span>}
                      {book.year_published && <span>• {book.year_published}</span>}
                      {book.isbn && <span>• ISBN: {book.isbn}</span>}
                    </div>
                    
                    {/* Tags and Status */}
                    <div className="flex flex-wrap items-center gap-2">
                      {book.copies_available > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-800">
                          <i className="fas fa-check-circle mr-1"></i>
                          {book.copies_available} of {book.copies_total} available
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-800">
                          <i className="fas fa-times-circle mr-1"></i>
                          Unavailable
                        </span>
                      )}
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-800">
                        {book.material_type}
                      </span>
                      {book.section && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">
                          <i className="fas fa-bookmark mr-1"></i>
                          {book.section}
                        </span>
                      )}
                      {book.location && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800">
                          <i className="fas fa-map-marker-alt mr-1"></i>
                          {book.location}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination - Google Style */}
              {totalPages > 1 && (
                <div className="mt-8 flex flex-col items-center gap-4">
                  {/* Page info */}
                  <p className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </p>
                  
                  <div className="flex items-center gap-1">
                    {/* Previous Button */}
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                      title="Previous"
                    >
                      <i className="fas fa-chevron-left mr-1"></i>
                      Previous
                    </button>
                    
                    {/* Page Numbers */}
                    <div className="flex items-center gap-1 mx-2">
                      {getPageNumbers().map((pageNum, idx) => (
                        pageNum === '...' ? (
                          <span key={`ellipsis-${idx}`} className="px-2 text-gray-500">...</span>
                        ) : (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum as number)}
                            className={`min-w-[40px] h-10 px-3 text-sm font-medium rounded-md transition-colors ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'text-blue-600 hover:bg-blue-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        )
                      ))}
                    </div>
                    
                    {/* Next Button */}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                      title="Next"
                    >
                      Next
                      <i className="fas fa-chevron-right ml-1"></i>
                    </button>
                  </div>

                  {/* Jump to page */}
                  {totalPages > 10 && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Jump to:</label>
                      <input
                        type="number"
                        min="1"
                        max={totalPages}
                        placeholder={currentPage.toString()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const page = parseInt((e.target as HTMLInputElement).value)
                            if (page >= 1 && page <= totalPages) {
                              setCurrentPage(page)
                            }
                          }
                        }}
                        className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-500">of {totalPages}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading book catalog...</p>
      </div>
    </div>
  )
}

export default function Browse() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <BrowseContent />
    </Suspense>
  )
}
