'use client'

import { useState, useEffect } from 'react'
import { Button } from '../ui'

interface BookManagementFormProps {
  onSubmit: (bookData: BookFormData) => void
  loading?: boolean
  error?: string | null
  initialData?: Partial<BookFormData>
  mode?: 'create' | 'edit'
  className?: string
}

export interface BookFormData {
  title: string
  author: string
  isbn: string
  publisher: string
  publicationYear: string
  category: string
  description: string
  totalCopies: number
  location: string
}

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

export function BookManagementForm({
  onSubmit,
  loading = false,
  error = null,
  initialData = {},
  mode = 'create',
  className = ''
}: BookManagementFormProps) {
  const [formData, setFormData] = useState<BookFormData>({
    title: '',
    author: '',
    isbn: '',
    publisher: '',
    publicationYear: '',
    category: '',
    description: '',
    totalCopies: 1,
    location: '',
    ...initialData
  })

  const [formErrors, setFormErrors] = useState<Partial<BookFormData>>({})

  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setFormData(prev => ({ ...prev, ...initialData }))
    }
  }, [initialData])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    setFormData(prev => ({
      ...prev,
      [name]: name === 'totalCopies' ? Math.max(1, parseInt(value) || 1) : value
    }))
    
    // Clear error for this field when user starts typing
    if (formErrors[name as keyof BookFormData]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const validateForm = (): boolean => {
    const errors: Partial<BookFormData> = {}

    if (!formData.title.trim()) {
      errors.title = 'Title is required'
    }
    if (!formData.author.trim()) {
      errors.author = 'Author is required'
    }
    if (!formData.isbn.trim()) {
      errors.isbn = 'ISBN is required'
    } else if (!/^(?:\d{10}|\d{13})$/.test(formData.isbn.replace(/-/g, ''))) {
      errors.isbn = 'Please enter a valid ISBN (10 or 13 digits)'
    }
    if (!formData.publisher.trim()) {
      errors.publisher = 'Publisher is required'
    }
    if (!formData.publicationYear.trim()) {
      errors.publicationYear = 'Publication year is required'
    } else {
      const year = parseInt(formData.publicationYear)
      const currentYear = new Date().getFullYear()
      if (isNaN(year) || year < 1000 || year > currentYear) {
        errors.publicationYear = `Please enter a valid year (1000-${currentYear})`
      }
    }
    if (!formData.category) {
      errors.category = 'Category is required'
    }
    if (!formData.location.trim()) {
      errors.location = 'Location/Shelf is required'
    }
    if (formData.totalCopies < 1) {
      errors.totalCopies = 'Total copies must be at least 1' as any
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (validateForm()) {
      onSubmit(formData)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      author: '',
      isbn: '',
      publisher: '',
      publicationYear: '',
      category: '',
      description: '',
      totalCopies: 1,
      location: ''
    })
    setFormErrors({})
  }

  return (
    <div className={`max-w-3xl w-full ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Book Title *
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                formErrors.title ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter book title"
              value={formData.title}
              onChange={handleChange}
            />
            {formErrors.title && (
              <p className="mt-1 text-sm text-red-600">{formErrors.title}</p>
            )}
          </div>

          <div>
            <label htmlFor="author" className="block text-sm font-medium text-gray-700 mb-1">
              Author *
            </label>
            <input
              id="author"
              name="author"
              type="text"
              required
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                formErrors.author ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter author name"
              value={formData.author}
              onChange={handleChange}
            />
            {formErrors.author && (
              <p className="mt-1 text-sm text-red-600">{formErrors.author}</p>
            )}
          </div>

          <div>
            <label htmlFor="isbn" className="block text-sm font-medium text-gray-700 mb-1">
              ISBN *
            </label>
            <input
              id="isbn"
              name="isbn"
              type="text"
              required
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                formErrors.isbn ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter ISBN (10 or 13 digits)"
              value={formData.isbn}
              onChange={handleChange}
            />
            {formErrors.isbn && (
              <p className="mt-1 text-sm text-red-600">{formErrors.isbn}</p>
            )}
          </div>

          <div>
            <label htmlFor="publisher" className="block text-sm font-medium text-gray-700 mb-1">
              Publisher *
            </label>
            <input
              id="publisher"
              name="publisher"
              type="text"
              required
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                formErrors.publisher ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter publisher name"
              value={formData.publisher}
              onChange={handleChange}
            />
            {formErrors.publisher && (
              <p className="mt-1 text-sm text-red-600">{formErrors.publisher}</p>
            )}
          </div>

          <div>
            <label htmlFor="publicationYear" className="block text-sm font-medium text-gray-700 mb-1">
              Publication Year *
            </label>
            <input
              id="publicationYear"
              name="publicationYear"
              type="number"
              required
              disabled={loading}
              min="1000"
              max={new Date().getFullYear()}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                formErrors.publicationYear ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter publication year"
              value={formData.publicationYear}
              onChange={handleChange}
            />
            {formErrors.publicationYear && (
              <p className="mt-1 text-sm text-red-600">{formErrors.publicationYear}</p>
            )}
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <select
              id="category"
              name="category"
              required
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                formErrors.category ? 'border-red-500' : 'border-gray-300'
              }`}
              value={formData.category}
              onChange={handleChange}
            >
              <option value="">Select a category</option>
              {BOOK_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            {formErrors.category && (
              <p className="mt-1 text-sm text-red-600">{formErrors.category}</p>
            )}
          </div>

          <div>
            <label htmlFor="totalCopies" className="block text-sm font-medium text-gray-700 mb-1">
              Total Copies *
            </label>
            <input
              id="totalCopies"
              name="totalCopies"
              type="number"
              required
              disabled={loading}
              min="1"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                formErrors.totalCopies ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter total copies"
              value={formData.totalCopies}
              onChange={handleChange}
            />
            {formErrors.totalCopies && (
              <p className="mt-1 text-sm text-red-600">{formErrors.totalCopies}</p>
            )}
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
              Location/Shelf *
            </label>
            <input
              id="location"
              name="location"
              type="text"
              required
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                formErrors.location ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter shelf/location (e.g., A1, B2, Fiction-01)"
              value={formData.location}
              onChange={handleChange}
            />
            {formErrors.location && (
              <p className="mt-1 text-sm text-red-600">{formErrors.location}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              disabled={loading}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter book description (optional)"
              value={formData.description}
              onChange={handleChange}
            />
          </div>
        </div>

        {error && (
          <div className="text-red-600 text-sm text-center p-3 bg-red-50 rounded-md">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          {mode === 'create' && (
            <Button
              type="button"
              variant="secondary"
              onClick={resetForm}
              disabled={loading}
              className="sm:w-auto"
            >
              Reset Form
            </Button>
          )}
          <Button
            type="submit"
            variant="default"
            loading={loading}
            disabled={loading}
            className="sm:w-auto"
          >
            {loading 
              ? (mode === 'edit' ? 'Updating...' : 'Adding...')
              : (mode === 'edit' ? 'Update Book' : 'Add Book')
            }
          </Button>
        </div>
      </form>
    </div>
  )
}

export default BookManagementForm
