'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PasswordResetModalProps {
  isOpen: boolean
  onClose: () => void
  onReset: (userId: number, fullName: string, newPassword: string) => Promise<void>
  userId: number
  fullName: string
  loading?: boolean
}

export function PasswordResetModal({
  isOpen,
  onClose,
  onReset,
  userId,
  fullName,
  loading = false
}: PasswordResetModalProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  const handleReset = async () => {
    if (!newPassword || newPassword.length < 4) {
      setPasswordError('Password must be at least 4 characters long')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    setPasswordError('')
    setIsResetting(true)
    try {
      console.log('Resetting password for user:', userId, 'with password length:', newPassword.length)
      await onReset(userId, fullName, newPassword)
      
      // Clear the form and show success
      setNewPassword('')
      setConfirmPassword('')
      setShowPassword(false)
      setShowConfirmPassword(false)
      setPasswordError('')
      
      // Close the modal after a brief delay to show success
      setTimeout(() => {
        onClose()
      }, 100)
    } catch (error) {
      console.error('Error resetting password:', error)
      alert('Failed to reset password. Please try again.')
    } finally {
      setIsResetting(false)
    }
  }

  const handleClose = () => {
    setNewPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirmPassword(false)
    setPasswordError('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="text-center pb-2">Reset Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Reset password for <strong>{fullName}</strong>
            </p>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="newPassword" className="text-sm font-medium">
              New Temporary Password
            </label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  if (confirmPassword && e.target.value !== confirmPassword) {
                    setPasswordError('Passwords do not match')
                  } else {
                    setPasswordError('')
                  }
                }}
                placeholder="Enter new password"
                className="pr-10"
                disabled={isResetting || loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                disabled={isResetting || loading}
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Password must be at least 4 characters long
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm Password
            </label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (newPassword && e.target.value !== newPassword) {
                    setPasswordError('Passwords do not match')
                  } else {
                    setPasswordError('')
                  }
                }}
                placeholder="Re-enter new password"
                className="pr-10"
                disabled={isResetting || loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                disabled={isResetting || loading}
              >
                <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
              </button>
            </div>
            {passwordError && (
              <p className="text-xs text-red-600 font-medium">
                {passwordError}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleClose}
              variant="outline"
              className="flex-1 px-5 h-[50px] bg-gray-100 hover:bg-gray-200"
              disabled={isResetting || loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReset}
              className="flex-1 bg-primary-600 px-5 h-[50px]"
              disabled={isResetting || loading || !newPassword || !confirmPassword || !!passwordError}
            >
              {isResetting || loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
