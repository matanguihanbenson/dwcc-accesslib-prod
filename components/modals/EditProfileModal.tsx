'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { notify } from '@/lib/notification'

interface ProfileData {
  id: string
  account_id: string
  name: string
  email: string
  contact_number?: string
  role: string
}

interface EditProfileModalProps {
  isOpen: boolean
  onClose: () => void
  /** Called after the profile is successfully updated — parent can use
   *  this to refresh cached profile data (e.g. header avatar / name). */
  onSaved?: (updated: ProfileData) => void
}

interface FieldErrors {
  full_name: string
  email: string
  contact_number: string
  username: string
}

const EMPTY_ERRORS: FieldErrors = {
  full_name: '', email: '', contact_number: '', username: ''
}

export function EditProfileModal({ isOpen, onClose, onSaved }: EditProfileModalProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', contact_number: '', username: '' })
  const [errors, setErrors] = useState<FieldErrors>(EMPTY_ERRORS)

  const debouncedUsername = useDebounce(form.username, 500)

  const checkUsernameAvailability = useCallback(async (username: string) => {
    const trimmed = username.trim()
    setErrors((prev) => ({ ...prev, username: '' }))

    if (!profile || trimmed === profile.id || trimmed.length < 3) return

    try {
      const response = await fetch('/api/users/check-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: trimmed })
      })
      const data = await response.json()
      if (response.ok && data.success && !data.data?.available) {
        setErrors((prev) => ({ ...prev, username: data.data?.message || 'Username is not available' }))
      }
    } catch {
      setErrors((prev) => ({ ...prev, username: 'Error checking username availability' }))
    }
  }, [profile])

  useEffect(() => {
    if (debouncedUsername && profile && debouncedUsername !== profile.id) {
      checkUsernameAvailability(debouncedUsername)
    }
  }, [debouncedUsername, checkUsernameAvailability, profile])

  // Reset whenever the modal opens; load fresh profile data.
  useEffect(() => {
    if (!isOpen) return
    setErrors(EMPTY_ERRORS)
    setLoading(true)
    const load = async () => {
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
            const p: ProfileData = data.data
            setProfile(p)
            setForm({
              full_name: p.name || '',
              email: p.email || '',
              contact_number: p.contact_number || '',
              username: p.id || ''
            })
          }
        }
      } catch (err) {
        console.error('Error loading profile for edit:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isOpen])

  if (!isOpen) return null

  const validate = () => {
    const next: FieldErrors = { ...EMPTY_ERRORS }
    if (!form.full_name.trim()) {
      next.full_name = 'Full name is required'
    } else if (form.full_name.trim().length < 2) {
      next.full_name = 'Full name must be at least 2 characters long'
    }
    if (form.email && form.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(form.email.trim())) next.email = 'Invalid email format'
    }
    if (form.username && form.username.trim()) {
      const trimmed = form.username.trim()
      if (trimmed.length < 3) next.username = 'Username must be at least 3 characters long'
      else if (trimmed.length > 50) next.username = 'Username must be less than 50 characters'
      else if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        next.username = 'Username can only contain letters, numbers, underscores, and hyphens'
      }
    }
    setErrors(next)
    return !Object.values(next).some((v) => v !== '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) {
      await notify.error('Validation Error', 'Please fix all validation errors before submitting.')
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form)
      })
      const data = await response.json()
      if (response.ok && data.success) {
        await notify.success('Success', 'Profile updated successfully!')
        // Re-fetch the latest profile so the caller has fresh data.
        try {
          const refresh = await fetch('/api/users/profile', {
            credentials: 'include', cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
          })
          if (refresh.ok) {
            const rd = await refresh.json()
            if (rd.success) {
              setProfile(rd.data)
              onSaved?.(rd.data)
            }
          }
        } catch { /* parent will refetch via onSaved */ }
        onClose()
      } else {
        await notify.error('Error', data.error || data.message || 'Failed to update profile.')
      }
    } catch (err) {
      console.error('Network error updating profile:', err)
      await notify.error('Error', 'Failed to update profile. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasErrors = Object.values(errors).some((v) => v !== '')

  return (
    <ModalShell title="Edit profile" subtitle="Update your personal information." onClose={onClose}>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <FieldRow label="Full name" error={errors.full_name}>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
              className={inputClass}
              placeholder="Enter your full name"
              required
            />
          </FieldRow>

          <FieldRow label="Username" error={errors.username} hint="Letters, numbers, underscores, and hyphens only">
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              className={`${inputClass} font-mono`}
              placeholder="Enter username"
              required
            />
          </FieldRow>

          <FieldRow label="Email" error={errors.email}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className={inputClass}
              placeholder="your.email@example.com"
            />
          </FieldRow>

          <FieldRow label="Contact number" error={errors.contact_number} hint="Optional">
            <input
              type="tel"
              value={form.contact_number}
              onChange={(e) => {
                const value = e.target.value
                if (value === '' || /^[0-9]+$/.test(value)) {
                  setForm((p) => ({ ...p, contact_number: value }))
                }
              }}
              className={inputClass}
              placeholder="Enter contact number"
            />
          </FieldRow>

          <ModalActions
            onCancel={onClose}
            isSubmitting={isSubmitting}
            submitLabel="Save changes"
            hasErrors={hasErrors}
          />
        </form>
      )}
    </ModalShell>
  )
}

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

// --- Presentational helpers (kept local — same look as profile page) ---

function ModalShell({
  title, subtitle, onClose, children,
}: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
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

function FieldRow({
  label, hint, error, children,
}: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
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
  onCancel, isSubmitting, submitLabel, hasErrors,
}: { onCancel: () => void; isSubmitting: boolean; submitLabel: string; hasErrors: boolean }) {
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

export default EditProfileModal
