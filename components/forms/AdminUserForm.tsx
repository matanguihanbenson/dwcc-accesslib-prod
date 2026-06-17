'use client'

import { useState, useEffect } from 'react'
import { Button } from '../ui'

interface AdminUserFormProps {
  onSubmit: (userData: AdminUserFormData) => void
  loading?: boolean
  error?: string | null
  initialData?: Partial<AdminUserFormData>
  mode?: 'create' | 'edit'
  className?: string
}

export interface AdminUserFormData {
  username: string
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'librarian'
  password?: string
  confirmPassword?: string
  department?: string
  isActive: boolean
}

const ADMIN_ROLES = [
  { value: 'admin', label: 'Administrator' },
  { value: 'librarian', label: 'Librarian' }
]

const DEPARTMENTS = [
  'Library Administration',
  'Circulation',
  'Reference Services',
  'Technical Services',
  'Digital Resources',
  'Student Services'
]

export function AdminUserForm({
  onSubmit,
  loading = false,
  error = null,
  initialData = {},
  mode = 'create',
  className = ''
}: AdminUserFormProps) {
  const [formData, setFormData] = useState<AdminUserFormData>({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    role: 'librarian',
    password: '',
    confirmPassword: '',
    department: '',
    isActive: true,
    ...initialData
  })

  const [formErrors, setFormErrors] = useState<Partial<AdminUserFormData>>({})
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setFormData(prev => ({ ...prev, ...initialData }))
    }
  }, [initialData])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
    
    // Clear error for this field when user starts typing
    if (formErrors[name as keyof AdminUserFormData]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const validateForm = (): boolean => {
    const errors: Partial<AdminUserFormData> = {}

    if (!formData.username.trim()) {
      errors.username = 'Username is required'
    } else if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters long'
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address'
    }

    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required'
    }

    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required'
    }

    if (mode === 'create' || formData.password) {
      if (!formData.password) {
        errors.password = 'Password is required'
      } else if (formData.password.length < 8) {
        errors.password = 'Password must be at least 8 characters long'
      }

      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match'
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (validateForm()) {
      const submitData = { ...formData }
      // Don't send password fields if in edit mode and no password provided
      if (mode === 'edit' && !formData.password) {
        delete submitData.password
        delete submitData.confirmPassword
      }
      onSubmit(submitData)
    }
  }

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      role: 'librarian',
      password: '',
      confirmPassword: '',
      department: '',
      isActive: true
    })
    setFormErrors({})
  }

  return (
    <div className={`max-w-2xl w-full ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Username *
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              disabled={loading || mode === 'edit'}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                formErrors.username ? 'border-red-500' : 'border-gray-300'
              } ${mode === 'edit' ? 'bg-gray-100' : ''}`}
              placeholder="Enter username"
              value={formData.username}
              onChange={handleChange}
            />
            {formErrors.username && (
              <p className="mt-1 text-sm text-red-600">{formErrors.username}</p>
            )}
            {mode === 'edit' && (
              <p className="mt-1 text-xs text-gray-500">Username cannot be changed</p>
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

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              Role *
            </label>
            <select
              id="role"
              name="role"
              required
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                formErrors.role ? 'border-red-500' : 'border-gray-300'
              }`}
              value={formData.role}
              onChange={handleChange}
            >
              {ADMIN_ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            {formErrors.role && (
              <p className="mt-1 text-sm text-red-600">{formErrors.role}</p>
            )}
          </div>

          <div>
            <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
              Department
            </label>
            <select
              id="department"
              name="department"
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={formData.department}
              onChange={handleChange}
            >
              <option value="">Select Department</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <div className="space-y-4">
              <div className="relative">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  {mode === 'create' ? 'Password *' : 'New Password (leave blank to keep current)'}
                </label>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required={mode === 'create'}
                  disabled={loading}
                  className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter password"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 top-6 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <span className="text-sm text-gray-500">
                    {showPassword ? 'Hide' : 'Show'}
                  </span>
                </button>
                {formErrors.password && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
                )}
              </div>

              {(mode === 'create' || formData.password) && (
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password *
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    required={mode === 'create' || !!formData.password}
                    disabled={loading}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      formErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Confirm password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                  {formErrors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.confirmPassword}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center">
              <input
                id="isActive"
                name="isActive"
                type="checkbox"
                disabled={loading}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                checked={formData.isActive}
                onChange={handleChange}
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
                Account is active
              </label>
            </div>
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
              ? (mode === 'edit' ? 'Updating...' : 'Creating...')
              : (mode === 'edit' ? 'Update Admin User' : 'Create Admin User')
            }
          </Button>
        </div>
      </form>
    </div>
  )
}

export default AdminUserForm
