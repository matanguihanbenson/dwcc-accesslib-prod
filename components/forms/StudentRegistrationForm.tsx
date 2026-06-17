'use client'

import { useState } from 'react'
import { Button } from '../ui'

interface StudentRegistrationFormProps {
  onSubmit: (studentData: StudentFormData) => void
  loading?: boolean
  error?: string | null
  className?: string
}

export interface StudentFormData {
  studentId: string
  firstName: string
  lastName: string
  email: string
  course: string
  yearLevel: string
  section: string
}

const COURSES = [
  'Bachelor of Science in Information Technology',
  'Bachelor of Science in Computer Science',
  'Bachelor of Science in Information Systems',
  'Bachelor of Science in Computer Engineering',
  'Bachelor of Science in Data Science',
  // Add more courses as needed
]

const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year']

export function StudentRegistrationForm({
  onSubmit,
  loading = false,
  error = null,
  className = ''
}: StudentRegistrationFormProps) {
  const [formData, setFormData] = useState<StudentFormData>({
    studentId: '',
    firstName: '',
    lastName: '',
    email: '',
    course: '',
    yearLevel: '',
    section: ''
  })

  const [formErrors, setFormErrors] = useState<Partial<StudentFormData>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Clear error for this field when user starts typing
    if (formErrors[name as keyof StudentFormData]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const validateForm = (): boolean => {
    const errors: Partial<StudentFormData> = {}

    if (!formData.studentId.trim()) {
      errors.studentId = 'Student ID is required'
    }
    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required'
    }
    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required'
    }
    if (!formData.email.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address'
    }
    if (!formData.course) {
      errors.course = 'Course is required'
    }
    if (!formData.yearLevel) {
      errors.yearLevel = 'Year level is required'
    }
    if (!formData.section.trim()) {
      errors.section = 'Section is required'
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
      studentId: '',
      firstName: '',
      lastName: '',
      email: '',
      course: '',
      yearLevel: '',
      section: ''
    })
    setFormErrors({})
  }

  return (
    <div className={`max-w-2xl w-full ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="studentId" className="block text-sm font-medium text-gray-700 mb-1">
              Student ID *
            </label>
            <input
              id="studentId"
              name="studentId"
              type="text"
              required
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                formErrors.studentId ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter student ID"
              value={formData.studentId}
              onChange={handleChange}
            />
            {formErrors.studentId && (
              <p className="mt-1 text-sm text-red-600">{formErrors.studentId}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                formErrors.email ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter email address"
              value={formData.email}
              onChange={handleChange}
            />
            {formErrors.email && (
              <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
              First Name *
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              required
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                formErrors.firstName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter first name"
              value={formData.firstName}
              onChange={handleChange}
            />
            {formErrors.firstName && (
              <p className="mt-1 text-sm text-red-600">{formErrors.firstName}</p>
            )}
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
              Last Name *
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              required
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                formErrors.lastName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter last name"
              value={formData.lastName}
              onChange={handleChange}
            />
            {formErrors.lastName && (
              <p className="mt-1 text-sm text-red-600">{formErrors.lastName}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="course" className="block text-sm font-medium text-gray-700 mb-1">
              Course *
            </label>
            <select
              id="course"
              name="course"
              required
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                formErrors.course ? 'border-red-500' : 'border-gray-300'
              }`}
              value={formData.course}
              onChange={handleChange}
            >
              <option value="">Select a course</option>
              {COURSES.map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
            {formErrors.course && (
              <p className="mt-1 text-sm text-red-600">{formErrors.course}</p>
            )}
          </div>

          <div>
            <label htmlFor="yearLevel" className="block text-sm font-medium text-gray-700 mb-1">
              Year Level *
            </label>
            <select
              id="yearLevel"
              name="yearLevel"
              required
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                formErrors.yearLevel ? 'border-red-500' : 'border-gray-300'
              }`}
              value={formData.yearLevel}
              onChange={handleChange}
            >
              <option value="">Select year level</option>
              {YEAR_LEVELS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            {formErrors.yearLevel && (
              <p className="mt-1 text-sm text-red-600">{formErrors.yearLevel}</p>
            )}
          </div>

          <div>
            <label htmlFor="section" className="block text-sm font-medium text-gray-700 mb-1">
              Section *
            </label>
            <input
              id="section"
              name="section"
              type="text"
              required
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                formErrors.section ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter section (e.g., A, B, C)"
              value={formData.section}
              onChange={handleChange}
            />
            {formErrors.section && (
              <p className="mt-1 text-sm text-red-600">{formErrors.section}</p>
            )}
          </div>
        </div>

        {error && (
          <div className="text-red-600 text-sm text-center p-3 bg-red-50 rounded-md">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={resetForm}
            disabled={loading}
            className="sm:w-auto"
          >
            Reset Form
          </Button>
          <Button
            type="submit"
            variant="default"
            loading={loading}
            disabled={loading}
            className="sm:w-auto"
          >
            {loading ? 'Registering...' : 'Register Student'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default StudentRegistrationForm
