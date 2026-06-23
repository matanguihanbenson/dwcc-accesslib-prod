'use client'

import React, { useState } from 'react'
import { notify } from '@/lib/notification'

interface ChangePasswordModalProps {
  isOpen: boolean
  onClose: () => void
  /** Called after the password is successfully updated. */
  onSaved?: () => void
}

export function ChangePasswordModal({ isOpen, onClose, onSaved }: ChangePasswordModalProps) {
  const [form, setForm] = useState({ old_password: '', new_password: '', confirm_password: '' })
  const [errors, setErrors] = useState({ old_password: '', new_password: '', confirm_password: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const validateNewPassword = (password: string) => {
    if (password.length < 1) {
      setErrors((p) => ({ ...p, new_password: 'New password is required' }))
      return
    }
    if (password.length < 6) {
      setErrors((p) => ({ ...p, new_password: 'Password must be at least 6 characters long' }))
    } else {
      setErrors((p) => ({ ...p, new_password: '' }))
    }
  }

  const validateConfirm = (confirmPassword: string) => {
    if (confirmPassword.length < 1) {
      setErrors((p) => ({ ...p, confirm_password: 'Please confirm your password' }))
      return
    }
    if (confirmPassword !== form.new_password) {
      setErrors((p) => ({ ...p, confirm_password: 'Passwords do not match' }))
    } else {
      setErrors((p) => ({ ...p, confirm_password: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Mirror the validation block from the original profile page so
    // every error is collected and displayed at once.
    const nextErrors = { old_password: '', new_password: '', confirm_password: '' }
    if (!form.old_password) nextErrors.old_password = 'Current password is required'
    if (!form.new_password) nextErrors.new_password = 'New password is required'
    if (!form.confirm_password) nextErrors.confirm_password = 'Please confirm your password'
    if (form.new_password && form.new_password.length < 6) {
      nextErrors.new_password = 'Password must be at least 6 characters long'
    }
    if (form.confirm_password && form.confirm_password !== form.new_password) {
      nextErrors.confirm_password = 'Passwords do not match'
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some((v) => v !== '')) {
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
          currentPassword: form.old_password,
          newPassword: form.new_password
        })
      })
      const data = await response.json()
      if (response.ok && data.success) {
        setForm({ old_password: '', new_password: '', confirm_password: '' })
        await notify.success('Success', 'Password changed successfully!')
        onSaved?.()
        onClose()
      } else {
        await notify.error('Error', data.error || data.message || 'Failed to change password.')
      }
    } catch (err) {
      console.error('Network error changing password:', err)
      await notify.error('Error', 'Failed to change password. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasErrors =
    Object.values(errors).some((v) => v !== '') ||
    !form.old_password ||
    !form.new_password ||
    !form.confirm_password

  return (
    <ModalShell title="Change password" subtitle="Use at least 6 characters." onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <FieldRow label="Current password" error={errors.old_password}>
          <input
            type="password"
            value={form.old_password}
            onChange={(e) => {
              setForm((p) => ({ ...p, old_password: e.target.value }))
              setErrors((p) => ({ ...p, old_password: e.target.value.trim() ? '' : 'Current password is required' }))
            }}
            className={inputClass}
            placeholder="Enter your current password"
            required
          />
        </FieldRow>

        <FieldRow label="New password" error={errors.new_password}>
          <input
            type="password"
            value={form.new_password}
            onChange={(e) => {
              setForm((p) => ({ ...p, new_password: e.target.value }))
              validateNewPassword(e.target.value)
              // Re-check confirm in case user edited new after confirm
              if (form.confirm_password) validateConfirm(form.confirm_password)
            }}
            className={inputClass}
            placeholder="At least 6 characters"
            required
          />
        </FieldRow>

        <FieldRow label="Confirm new password" error={errors.confirm_password}>
          <input
            type="password"
            value={form.confirm_password}
            onChange={(e) => {
              setForm((p) => ({ ...p, confirm_password: e.target.value }))
              validateConfirm(e.target.value)
            }}
            className={inputClass}
            placeholder="Re-enter new password"
            required
          />
        </FieldRow>

        <ModalActions
          onCancel={onClose}
          isSubmitting={isSubmitting}
          submitLabel="Update password"
          hasErrors={hasErrors}
        />
      </form>
    </ModalShell>
  )
}

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

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

export default ChangePasswordModal
