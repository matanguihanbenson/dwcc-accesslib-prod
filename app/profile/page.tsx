'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { notify } from '@/lib/notification'

interface User {
  id: string
  account_id: string
  name: string
  email: string
  contact_number?: string
  role: string
  avatar?: string
}

function Profile() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [updateForm, setUpdateForm] = useState({
    full_name: '',
    email: '',
    contact_number: '',
    username: ''
  })
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [validationErrors, setValidationErrors] = useState({
    full_name: '',
    email: '',
    contact_number: '',
    username: '',
    old_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Debounced username for checking availability
  const debouncedUsername = useDebounce(updateForm.username, 500)

  // Check username availability function
  const checkUsernameAvailability = useCallback(async (username: string) => {
    const trimmedUsername = username.trim()

    setValidationErrors((prev) => ({
      ...prev,
      username: '',
    }))

    if (trimmedUsername === user?.id || trimmedUsername.length < 3) {
      return
    }

    try {
      const response = await fetch('/api/users/check-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: trimmedUsername })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        if (!data.data.available) {
          setValidationErrors(prev => ({
            ...prev,
            username: data.data.message
          }))
        }
      } else {
        setValidationErrors(prev => ({
          ...prev,
          username: 'Error checking username availability'
        }))
      }
    } catch (error) {
      setValidationErrors(prev => ({
        ...prev,
        username: 'Error checking username availability'
      }))
    }
  }, [user?.id])

  useEffect(() => {
    if (debouncedUsername && debouncedUsername !== user?.id) {
      checkUsernameAvailability(debouncedUsername)
    }
  }, [debouncedUsername, checkUsernameAvailability, user?.id])

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/users/profile', {
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setUser(data.data)
          } else {
            console.error('Profile fetch failed:', data.message)
            router.push('/login')
          }
        } else {
          console.error('Profile fetch failed with status:', response.status)
          router.push('/login')
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    if (status !== 'loading') {
      fetchProfile()
    }
  }, [status, router])

  if (loading || status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <div className="text-sm text-gray-500">Loading profile…</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const initials = (user.name || user.id).trim().charAt(0).toUpperCase()
  const roleLabel = user.role?.replace('_', ' ') || 'User'

  const openUpdateModal = () => {
    setUpdateForm({
      full_name: user.name || '',
      email: user.email || '',
      contact_number: user.contact_number || '',
      username: user.id || '',
    })
    setValidationErrors({
      full_name: '', email: '', contact_number: '', username: '',
      old_password: '', new_password: '', confirm_password: '',
    })
    setShowUpdateModal(true)
  }

  const openPasswordModal = () => {
    setPasswordForm({ old_password: '', new_password: '', confirm_password: '' })
    setValidationErrors({ full_name: '', email: '', contact_number: '', username: '', old_password: '', new_password: '', confirm_password: '' })
    setShowPasswordModal(true)
  }

  const validateForm = () => {
    const errors: any = {}

    if (!updateForm.full_name.trim()) {
      errors.full_name = 'Full name is required'
    } else if (updateForm.full_name.trim().length < 2) {
      errors.full_name = 'Full name must be at least 2 characters long'
    }

    if (updateForm.email && updateForm.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(updateForm.email.trim())) {
        errors.email = 'Invalid email format'
      }
    }

    if (updateForm.username && updateForm.username.trim()) {
      const trimmedUsername = updateForm.username.trim()
      if (trimmedUsername.length < 3) {
        errors.username = 'Username must be at least 3 characters long'
      } else if (trimmedUsername.length > 50) {
        errors.username = 'Username must be less than 50 characters'
      } else {
        const usernameRegex = /^[a-zA-Z0-9_-]+$/
        if (!usernameRegex.test(trimmedUsername)) {
          errors.username = 'Username can only contain letters, numbers, underscores, and hyphens'
        }
      }
    }

    setValidationErrors(prev => ({ ...prev, ...errors }))
    return Object.keys(errors).length === 0
  }

  const validateNewPassword = (password: string) => {
    if (password.length < 1) {
      setValidationErrors(prev => ({ ...prev, new_password: 'New password is required' }))
      return
    }
    if (password.length < 6) {
      setValidationErrors(prev => ({ ...prev, new_password: 'Password must be at least 6 characters long' }))
    } else {
      setValidationErrors(prev => ({ ...prev, new_password: '' }))
    }
  }

  const validateConfirmPassword = (confirmPassword: string) => {
    if (confirmPassword.length < 1) {
      setValidationErrors(prev => ({ ...prev, confirm_password: 'Please confirm your password' }))
      return
    }
    if (confirmPassword !== passwordForm.new_password) {
      setValidationErrors(prev => ({ ...prev, confirm_password: 'Passwords do not match' }))
    } else {
      setValidationErrors(prev => ({ ...prev, confirm_password: '' }))
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) {
      await notify.error('Validation Error', 'Please fix all validation errors before submitting.')
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updateForm)
      })
      const data = await response.json()
      if (response.ok && data.success) {
        await notify.success('Success', 'Profile updated successfully!')
        try {
          const profileResponse = await fetch('/api/users/profile', {
            credentials: 'include',
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
          })
          if (profileResponse.ok) {
            const profileData = await profileResponse.json()
            if (profileData.success) setUser(profileData.data)
          }
        } catch (refreshError) {
          console.error('Error refreshing profile:', refreshError)
        }
        setShowUpdateModal(false)
      } else {
        await notify.error('Error', data.error || 'Failed to update profile. Please try again.')
      }
    } catch (error) {
      console.error('Network error:', error)
      await notify.error('Error', 'Failed to update profile. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordForm.old_password) {
      setValidationErrors(prev => ({ ...prev, old_password: 'Current password is required' }))
    }
    if (!passwordForm.new_password) {
      setValidationErrors(prev => ({ ...prev, new_password: 'New password is required' }))
    }
    if (!passwordForm.confirm_password) {
      setValidationErrors(prev => ({ ...prev, confirm_password: 'Please confirm your password' }))
    }
    if (validationErrors.old_password || validationErrors.new_password || validationErrors.confirm_password ||
        !passwordForm.old_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      await notify.error('Validation Error', 'Please fix all validation errors before submitting.')
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: passwordForm.old_password,
          newPassword: passwordForm.new_password
        })
      })
      const data = await response.json()
      if (response.ok && data.success) {
        setShowPasswordModal(false)
        setPasswordForm({ old_password: '', new_password: '', confirm_password: '' })
        await notify.success('Success', 'Password changed successfully!')
      } else {
        await notify.error('Error', data.error || 'Failed to change password. Please try again.')
      }
    } catch (error) {
      console.error('Network error:', error)
      await notify.error('Error', 'Failed to change password. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/60">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header card: solid white, thin top accent stripe (blue-700) instead
            of a full gradient, plain avatar with no decorative ring/online-dot. */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="h-1 bg-blue-700" />
          <div className="px-6 sm:px-8 py-6 sm:py-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div className="flex items-center gap-5 min-w-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-900 text-white flex items-center justify-center text-2xl sm:text-3xl font-semibold shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 truncate">
                    {user.name || user.id}
                  </h1>
                  <p className="text-sm text-gray-500 mt-0.5">@{user.id}</p>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                      {roleLabel}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons live ONLY in the header. No duplicated
                  "Quick Actions" card. */}
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={openUpdateModal}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Edit profile
                </button>
                <button
                  type="button"
                  onClick={openPasswordModal}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
                >
                  Change password
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Two info cards side-by-side: solid white, plain border, no
            gradient headers. Each field is a label/value pair with a
            bottom divider (clean definition-list style). */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InfoCard title="Personal information">
            <InfoRow label="Full name" value={user.name} />
            <InfoRow label="ID number" value={user.account_id} mono />
            <InfoRow label="Email" value={user.email} fallback="Not provided" />
            <InfoRow
              label="Contact number"
              value={user.contact_number}
              fallback="Not provided"
              last
            />
          </InfoCard>

          <InfoCard title="Account">
            <InfoRow label="Username" value={user.id} mono />
            <InfoRow label="Role" value={roleLabel} />
            <InfoRow
              label="Status"
              value={
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              }
              last
            />
          </InfoCard>
        </div>
      </div>

      {/* Update Profile Modal */}
      {showUpdateModal && (
        <Modal onClose={() => setShowUpdateModal(false)} title="Edit profile" subtitle="Update your personal information.">
          <form onSubmit={handleUpdateProfile} className="space-y-5">
            <Field
              label="Full name"
              error={validationErrors.full_name}
            >
              <input
                type="text"
                value={updateForm.full_name}
                onChange={(e) => setUpdateForm(prev => ({ ...prev, full_name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your full name"
                required
              />
            </Field>

            <Field
              label="Username"
              error={validationErrors.username}
              hint="Letters, numbers, underscores, and hyphens only"
            >
              <input
                type="text"
                value={updateForm.username}
                onChange={(e) => setUpdateForm(prev => ({ ...prev, username: e.target.value }))}
                className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter username"
                required
              />
            </Field>

            <Field
              label="Email"
              error={validationErrors.email}
            >
              <input
                type="email"
                value={updateForm.email}
                onChange={(e) => setUpdateForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="your.email@example.com"
              />
            </Field>

            <Field
              label="Contact number"
              error={validationErrors.contact_number}
              hint="Optional"
            >
              <input
                type="tel"
                value={updateForm.contact_number}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === '' || /^[0-9]+$/.test(value)) {
                    setUpdateForm(prev => ({ ...prev, contact_number: value }))
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter contact number"
              />
            </Field>

            <ModalActions
              onCancel={() => setShowUpdateModal(false)}
              isSubmitting={isSubmitting}
              submitLabel="Save changes"
              hasErrors={Object.values(validationErrors).some(error => error !== '')}
            />
          </form>
        </Modal>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <Modal onClose={() => setShowPasswordModal(false)} title="Change password" subtitle="Use at least 6 characters.">
          <form onSubmit={handleChangePassword} className="space-y-5">
            <Field
              label="Current password"
              error={validationErrors.old_password}
            >
              <input
                type="password"
                value={passwordForm.old_password}
                onChange={(e) => {
                  setPasswordForm(prev => ({ ...prev, old_password: e.target.value }))
                  if (!e.target.value.trim()) {
                    setValidationErrors(prev => ({ ...prev, old_password: 'Current password is required' }))
                  } else {
                    setValidationErrors(prev => ({ ...prev, old_password: '' }))
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your current password"
                required
              />
            </Field>

            <Field
              label="New password"
              error={validationErrors.new_password}
            >
              <input
                type="password"
                value={passwordForm.new_password}
                onChange={(e) => {
                  setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))
                  validateNewPassword(e.target.value)
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="At least 6 characters"
                required
              />
            </Field>

            <Field
              label="Confirm new password"
              error={validationErrors.confirm_password}
            >
              <input
                type="password"
                value={passwordForm.confirm_password}
                onChange={(e) => {
                  setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))
                  validateConfirmPassword(e.target.value)
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Re-enter new password"
                required
              />
            </Field>

            <ModalActions
              onCancel={() => setShowPasswordModal(false)}
              isSubmitting={isSubmitting}
              submitLabel="Update password"
              hasErrors={
                Object.values(validationErrors).some(error => error !== '') ||
                !passwordForm.old_password ||
                !passwordForm.new_password ||
                !passwordForm.confirm_password
              }
            />
          </form>
        </Modal>
      )}
    </div>
  )
}

// Small presentational helpers -- keeps the JSX above readable and gives
// every field/row the same look without sprinkling utility classes around.
function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{title}</h2>
      </div>
      <dl className="px-6 py-2">{children}</dl>
    </section>
  )
}

function InfoRow({
  label,
  value,
  fallback = '—',
  mono = false,
  last = false,
}: {
  label: string
  value?: React.ReactNode
  fallback?: React.ReactNode
  mono?: boolean
  last?: boolean
}) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-3 ${last ? '' : 'border-b border-gray-100'}`}>
      <dt className="text-sm text-gray-500 shrink-0">{label}</dt>
      <dd className={`text-sm text-gray-900 text-right ${mono ? 'font-mono' : ''} truncate`}>
        {value || <span className="text-gray-400">{fallback}</span>}
      </dd>
    </div>
  )
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 -mr-1 -mt-1 p-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
      {error ? (
        <p className="text-xs text-red-600 mt-1.5">{error}</p>
      ) : hint ? (
        <p className="text-xs text-gray-500 mt-1.5">{hint}</p>
      ) : null}
    </div>
  )
}

function ModalActions({
  onCancel,
  isSubmitting,
  submitLabel,
  hasErrors,
}: {
  onCancel: () => void
  isSubmitting: boolean
  submitLabel: string
  hasErrors: boolean
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={isSubmitting}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isSubmitting || hasErrors}
        className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Saving…' : submitLabel}
      </button>
    </div>
  )
}

export default Profile
