'use client'

import { useState, useEffect } from 'react'
import { Button } from '../ui'

interface LibraryUserFormProps {
  onSubmit: (userData: LibraryUserFormData) => void
  loading?: boolean
  error?: string | null
  initialData?: Partial<LibraryUserFormData>
  mode?: 'create' | 'edit'
  className?: string
}

export interface LibraryUserFormData {
  // Basic Info
  libraryId: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  
  // User Type & Role
  userType: 'student' | 'employee' | 'alumni'
  
  // Student-specific fields
  studentId?: string
  course?: string
  yearLevel?: string
  section?: string
  
  // Employee-specific fields
  employeeId?: string
  department?: string
  position?: string
  
  // Status
  isActive: boolean
  isArchived: boolean
  
  // Additional Info
  address?: string
  dateOfBirth?: string
  notes?: string
}

const USER_TYPES = [
  { value: 'student', label: 'Student' },
  { value: 'employee', label: 'Employee' },
  { value: 'alumni', label: 'Alumni' }
]

const COURSES = [
  'Bachelor of Science in Information Technology',
  'Bachelor of Science in Computer Science',
  'Bachelor of Science in Information Systems',
  'Bachelor of Science in Computer Engineering',
  'Bachelor of Science in Data Science',
  'Bachelor of Arts in Communication',
  'Bachelor of Science in Business Administration',
  'Bachelor of Science in Accounting',
  'Bachelor of Science in Marketing'
]

const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year']

const DEPARTMENTS = [
  'Information Technology',
  'Computer Science',
  'Business Administration',
  'Accounting',
  'Marketing',
  'Human Resources',
  'Finance',
  'Academic Affairs',
  'Student Affairs',
  'Library Services',
  'Maintenance',
  'Security'
]

export function LibraryUserForm({
  onSubmit,
  loading = false,
  error = null,
  initialData = {},
  mode = 'create',
  className = ''
}: LibraryUserFormProps) {
  const [formData, setFormData] = useState<LibraryUserFormData>({
    libraryId: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    userType: 'student',
    studentId: '',
    course: '',
    yearLevel: '',
    section: '',
    employeeId: '',
    department: '',
    position: '',
    isActive: true,
    isArchived: false,
    address: '',
    dateOfBirth: '',
    notes: '',
    ...initialData
  })

  const [formErrors, setFormErrors] = useState<Partial<LibraryUserFormData>>({})

  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setFormData(prev => ({ ...prev, ...initialData }))
    }
  }, [initialData])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
    
    // Clear error for this field when user starts typing
    if (formErrors[name as keyof LibraryUserFormData]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const validateForm = (): boolean => {
    const errors: Partial<LibraryUserFormData> = {}

    if (!formData.libraryId.trim()) {
      errors.libraryId = 'Library ID is required'
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

    // Type-specific validations
    if (formData.userType === 'student') {
      if (!formData.studentId?.trim()) {
        errors.studentId = 'Student ID is required for students'
      }
      if (!formData.course) {
        errors.course = 'Course is required for students'
      }
      if (!formData.yearLevel) {
        errors.yearLevel = 'Year level is required for students'
      }
    }

    if (formData.userType === 'employee') {
      if (!formData.employeeId?.trim()) {
        errors.employeeId = 'Employee ID is required for employees'
      }
      if (!formData.department) {
        errors.department = 'Department is required for employees'
      }
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
      libraryId: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      userType: 'student',
      studentId: '',
      course: '',
      yearLevel: '',
      section: '',
      employeeId: '',
      department: '',
      position: '',
      isActive: true,
      isArchived: false,
      address: '',
      dateOfBirth: '',
      notes: ''
    })
    setFormErrors({})
  }

  return (
    <div className={`max-w-4xl w-full ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label htmlFor="libraryId" className="block text-sm font-medium text-gray-700 mb-1">
                Library ID *
              </label>
              <input
                id="libraryId"
                name="libraryId"
                type="text"
                required
                disabled={loading || (mode === 'edit')}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  formErrors.libraryId ? 'border-red-500' : 'border-gray-300'
                } ${mode === 'edit' ? 'bg-gray-100' : ''}`}
                placeholder="Enter library ID"
                value={formData.libraryId}
                onChange={handleChange}
              />
              {formErrors.libraryId && (
                <p className="mt-1 text-sm text-red-600">{formErrors.libraryId}</p>
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
                disabled={loading || formData.isArchived}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  formErrors.firstName ? 'border-red-500' : 'border-gray-300'
                } ${formData.isArchived ? 'bg-gray-100' : ''}`}
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
                disabled={loading || formData.isArchived}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  formErrors.lastName ? 'border-red-500' : 'border-gray-300'
                } ${formData.isArchived ? 'bg-gray-100' : ''}`}
                placeholder="Enter last name"
                value={formData.lastName}
                onChange={handleChange}
              />
              {formErrors.lastName && (
                <p className="mt-1 text-sm text-red-600">{formErrors.lastName}</p>
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
                disabled={loading || formData.isArchived}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  formErrors.email ? 'border-red-500' : 'border-gray-300'
                } ${formData.isArchived ? 'bg-gray-100' : ''}`}
                placeholder="Enter email address"
                value={formData.email}
                onChange={handleChange}
              />
              {formErrors.email && (
                <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                disabled={loading || formData.isArchived}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formData.isArchived ? 'bg-gray-100' : ''}`}
                placeholder="Enter phone number"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="userType" className="block text-sm font-medium text-gray-700 mb-1">
                User Type *
              </label>
              <select
                id="userType"
                name="userType"
                required
                disabled={loading || formData.isArchived}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formData.isArchived ? 'bg-gray-100' : ''}`}
                value={formData.userType}
                onChange={handleChange}
              >
                {USER_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Student-specific fields */}
        {formData.userType === 'student' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-blue-900 mb-4">Student Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label htmlFor="studentId" className="block text-sm font-medium text-gray-700 mb-1">
                  Student ID *
                </label>
                <input
                  id="studentId"
                  name="studentId"
                  type="text"
                  required
                  disabled={loading || formData.isArchived}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.studentId ? 'border-red-500' : 'border-gray-300'
                  } ${formData.isArchived ? 'bg-gray-100' : ''}`}
                  placeholder="Enter student ID"
                  value={formData.studentId}
                  onChange={handleChange}
                />
                {formErrors.studentId && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.studentId}</p>
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
                  disabled={loading || formData.isArchived}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.course ? 'border-red-500' : 'border-gray-300'
                  } ${formData.isArchived ? 'bg-gray-100' : ''}`}
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
                  disabled={loading || formData.isArchived}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.yearLevel ? 'border-red-500' : 'border-gray-300'
                  } ${formData.isArchived ? 'bg-gray-100' : ''}`}
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
                  Section
                </label>
                <input
                  id="section"
                  name="section"
                  type="text"
                  disabled={loading || formData.isArchived}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formData.isArchived ? 'bg-gray-100' : ''}`}
                  placeholder="Enter section"
                  value={formData.section}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>
        )}

        {/* Employee-specific fields */}
        {formData.userType === 'employee' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-green-900 mb-4">Employee Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700 mb-1">
                  Employee ID *
                </label>
                <input
                  id="employeeId"
                  name="employeeId"
                  type="text"
                  required
                  disabled={loading || formData.isArchived}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.employeeId ? 'border-red-500' : 'border-gray-300'
                  } ${formData.isArchived ? 'bg-gray-100' : ''}`}
                  placeholder="Enter employee ID"
                  value={formData.employeeId}
                  onChange={handleChange}
                />
                {formErrors.employeeId && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.employeeId}</p>
                )}
              </div>

              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
                  Department *
                </label>
                <select
                  id="department"
                  name="department"
                  required
                  disabled={loading || formData.isArchived}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.department ? 'border-red-500' : 'border-gray-300'
                  } ${formData.isArchived ? 'bg-gray-100' : ''}`}
                  value={formData.department}
                  onChange={handleChange}
                >
                  <option value="">Select department</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
                {formErrors.department && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.department}</p>
                )}
              </div>

              <div>
                <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-1">
                  Position
                </label>
                <input
                  id="position"
                  name="position"
                  type="text"
                  disabled={loading || formData.isArchived}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formData.isArchived ? 'bg-gray-100' : ''}`}
                  placeholder="Enter position/job title"
                  value={formData.position}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>
        )}

        {/* Additional Information */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth
              </label>
              <input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                disabled={loading || formData.isArchived}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formData.isArchived ? 'bg-gray-100' : ''}`}
                value={formData.dateOfBirth}
                onChange={handleChange}
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                id="address"
                name="address"
                type="text"
                disabled={loading || formData.isArchived}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formData.isArchived ? 'bg-gray-100' : ''}`}
                placeholder="Enter full address"
                value={formData.address}
                onChange={handleChange}
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                disabled={loading || formData.isArchived}
                rows={3}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formData.isArchived ? 'bg-gray-100' : ''}`}
                placeholder="Additional notes or comments"
                value={formData.notes}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* Status Settings */}
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Status Settings</h3>
          <div className="space-y-3">
            <div className="flex items-center">
              <input
                id="isActive"
                name="isActive"
                type="checkbox"
                disabled={loading || formData.isArchived}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                checked={formData.isActive}
                onChange={handleChange}
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
                Account is active
              </label>
            </div>

            <div className="flex items-center">
              <input
                id="isArchived"
                name="isArchived"
                type="checkbox"
                disabled={loading}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                checked={formData.isArchived}
                onChange={handleChange}
              />
              <label htmlFor="isArchived" className="ml-2 block text-sm text-gray-700">
                Archive this record (archived records cannot be edited)
              </label>
            </div>

            {formData.isArchived && (
              <div className="ml-6 text-sm text-red-600">
                ⚠️ Archived records are read-only and cannot be modified
              </div>
            )}
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
            disabled={loading || formData.isArchived}
            className="sm:w-auto"
          >
            {loading 
              ? (mode === 'edit' ? 'Updating...' : 'Registering...')
              : (mode === 'edit' ? 'Update User' : 'Register User')
            }
          </Button>
        </div>
      </form>
    </div>
  )
}

export default LibraryUserForm
