'use client'

import { useState } from 'react'
import { Button } from '../ui'

interface SearchFormProps {
  onSearch: (searchData: SearchFormData) => void
  loading?: boolean
  searchType: 'books' | 'students'
  className?: string
  placeholder?: string
}

export interface SearchFormData {
  query: string
  searchBy: string
  category?: string
}

const BOOK_SEARCH_OPTIONS = [
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'isbn', label: 'ISBN' },
  { value: 'publisher', label: 'Publisher' },
  { value: 'category', label: 'Category' },
  { value: 'all', label: 'All Fields' }
]

const STUDENT_SEARCH_OPTIONS = [
  { value: 'studentId', label: 'Student ID' },
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'course', label: 'Course' },
  { value: 'yearLevel', label: 'Year Level' },
  { value: 'all', label: 'All Fields' }
]

const BOOK_CATEGORIES = [
  'Fiction',
  'Non-Fiction',
  'Science & Technology',
  'Mathematics',
  'Computer Science',
  'Literature',
  'History',
  'Philosophy',
  'Business',
  'Art & Design',
  'Reference',
  'Textbooks',
  'Research Papers',
  'Magazines',
  'Other'
]

export function SearchForm({
  onSearch,
  loading = false,
  searchType,
  className = '',
  placeholder
}: SearchFormProps) {
  const [formData, setFormData] = useState<SearchFormData>({
    query: '',
    searchBy: 'all',
    category: ''
  })

  const searchOptions = searchType === 'books' ? BOOK_SEARCH_OPTIONS : STUDENT_SEARCH_OPTIONS
  const defaultPlaceholder = searchType === 'books' 
    ? 'Search for books by title, author, ISBN, or any field...'
    : 'Search for students by ID, name, email, or any field...'

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.query.trim() || formData.category) {
      onSearch(formData)
    }
  }

  const clearSearch = () => {
    setFormData({
      query: '',
      searchBy: 'all',
      category: ''
    })
    // Trigger search with empty data to show all results
    onSearch({
      query: '',
      searchBy: 'all',
      category: ''
    })
  }

  return (
    <div className={`w-full ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Main search input */}
          <div className="flex-1">
            <input
              id="query"
              name="query"
              type="text"
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder={placeholder || defaultPlaceholder}
              value={formData.query}
              onChange={handleChange}
            />
          </div>

          {/* Search by dropdown */}
          <div className="w-full sm:w-48">
            <select
              id="searchBy"
              name="searchBy"
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={formData.searchBy}
              onChange={handleChange}
            >
              {searchOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Category filter for books */}
          {searchType === 'books' && (
            <div className="w-full sm:w-48">
              <select
                id="category"
                name="category"
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.category}
                onChange={handleChange}
              >
                <option value="">All Categories</option>
                {BOOK_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="default"
              loading={loading}
              disabled={loading || (!formData.query.trim() && !formData.category)}
              className="w-full sm:w-auto"
            >
              Search
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={clearSearch}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Clear
            </Button>
          </div>
        </div>

        {/* Quick search tips */}
        <div className="text-xs text-gray-500">
          <p>
            <strong>Tips:</strong> 
            {searchType === 'books' ? (
              <>
                {' '}Search by title, author, ISBN, or use category filters. 
                Leave empty and click search to see all books.
              </>
            ) : (
              <>
                {' '}Search by student ID, name, email, course, or year level. 
                Leave empty and click search to see all students.
              </>
            )}
          </p>
        </div>
      </form>
    </div>
  )
}

export default SearchForm
