'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { PublicHeader } from '@/components/layout/PublicHeader'

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
}

interface SearchResponse {
  success: boolean
  books: Book[]
  categories: string[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasMore: boolean
  }
}

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [books, setBooks] = useState<Book[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState(searchParams?.get('q') || '')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    fetchBooks()
  }, [searchTerm, selectedCategory, currentPage])

  const fetchBooks = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      })
      
      if (searchTerm) params.append('search', searchTerm)
      if (selectedCategory) params.append('category', selectedCategory)
      
      const response = await fetch(`/api/public/books?${params.toString()}`)
      
      if (response.ok) {
        const data: SearchResponse = await response.json()
        setBooks(data.books)
        setCategories(data.categories)
        setTotalCount(data.pagination.totalCount)
        setTotalPages(data.pagination.totalPages)
      } else {
      }
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    router.push(`/search?q=${encodeURIComponent(searchTerm)}`)
  }

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category)
    setCurrentPage(1)
  }

  const handleBookClick = (bookId: number) => {
    router.push(`/books/${bookId}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />

      {/* Search Section */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by title, author, or keyword..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
              >
                <i className="fas fa-search"></i>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Category Filter Bar */}
        {categories.length > 0 && (
          <div className="mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 text-center">
                Filter by Category
              </h3>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => handleCategoryChange('')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedCategory === ''
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-green-100 hover:text-green-800'
                  }`}
                >
                  All Categories ({totalCount})
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => handleCategoryChange(category)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      selectedCategory === category
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-green-100 hover:text-green-800'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results Summary */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {searchTerm ? `Search Results for "${searchTerm}"` : 'All Books'}
              </h1>
              <p className="text-gray-600">
                {loading ? 'Loading...' : `Showing ${books.length} of ${totalCount} available books`}
                {selectedCategory && ` in "${selectedCategory}"`}
              </p>
            </div>
            
            {/* Clear Filters */}
            {(searchTerm || selectedCategory) && (
              <button
                onClick={() => {
                  setSearchTerm('')
                  setSelectedCategory('')
                  setCurrentPage(1)
                  router.push('/search')
                }}
                className="text-sm text-green-600 hover:text-green-800 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm p-4 animate-pulse">
                <div className="h-32 bg-gray-200 rounded mb-3"></div>
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
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
            <p className="text-gray-600 mb-4">
              {searchTerm || selectedCategory
                ? 'Try adjusting your search or filters'
                : 'No books are currently available in the library'}
            </p>
            {(searchTerm || selectedCategory) && (
              <button
                onClick={() => {
                  setSearchTerm('')
                  setSelectedCategory('')
                  setCurrentPage(1)
                  router.push('/search')
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                View All Books
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Books Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {books.map((book) => (
                <div
                  key={book.book_id}
                  onClick={() => handleBookClick(book.book_id)}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer transform hover:-translate-y-1"
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
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-800">
                        <i className="fas fa-check-circle mr-1"></i>
                        {book.copies_available} of {book.copies_total} available
                      </span>
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <i className="fas fa-chevron-left mr-2"></i>
                  Previous
                </button>
                
                <div className="flex space-x-2">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNumber;
                    if (totalPages <= 5) {
                      pageNumber = i + 1;
                    } else if (currentPage <= 3) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + i;
                    } else {
                      pageNumber = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNumber}
                        onClick={() => setCurrentPage(pageNumber)}
                        className={`px-4 py-2 text-sm border rounded-md transition-colors ${
                          currentPage === pageNumber
                            ? 'bg-green-600 text-white border-green-600'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <i className="fas fa-chevron-right ml-2"></i>
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              DWCC AccessLib
            </h3>
            <p className="text-gray-600 mb-4">
              Digital library access management system providing easy access to our comprehensive book collection.
            </p>
            <div className="pt-4 border-t border-gray-200">
              <p className="text-gray-500 text-sm">
                &copy; 2025 DWCC AccessLib. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading search results...</p>
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SearchContent />
    </Suspense>
  )
}
