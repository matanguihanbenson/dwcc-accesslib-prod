/**
 * Client-side duplicate submission prevention hook
 * Use this hook in React forms to prevent multiple submissions
 */

'use client'

import React, { useState, useCallback, useRef } from 'react'

interface UseFormSubmissionOptions {
  preventDuplicates?: boolean
  timeout?: number
  onSubmissionStart?: () => void
  onSubmissionEnd?: () => void
  onDuplicateAttempt?: () => void
}

interface FormSubmissionState {
  isSubmitting: boolean
  isDisabled: boolean
  submitCount: number
  lastSubmission: number | null
}

export function useFormSubmission(options: UseFormSubmissionOptions = {}) {
  const {
    preventDuplicates = true,
    timeout = 5000,
    onSubmissionStart,
    onSubmissionEnd,
    onDuplicateAttempt
  } = options

  const [state, setState] = useState<FormSubmissionState>({
    isSubmitting: false,
    isDisabled: false,
    submitCount: 0,
    lastSubmission: null
  })

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleSubmit = useCallback(
    async (submitFunction: () => Promise<any>) => {
      const now = Date.now()

      // Check for duplicate submission
      if (preventDuplicates && state.isSubmitting) {
        onDuplicateAttempt?.()
        console.warn('Duplicate submission prevented')
        return null
      }

      // Check if still within timeout period
      if (
        preventDuplicates &&
        state.lastSubmission &&
        now - state.lastSubmission < timeout
      ) {
        onDuplicateAttempt?.()
        console.warn('Submission too soon after previous attempt')
        return null
      }

      try {
        // Start submission
        setState(prev => ({
          ...prev,
          isSubmitting: true,
          isDisabled: true,
          submitCount: prev.submitCount + 1,
          lastSubmission: now
        }))

        onSubmissionStart?.()

        // Execute the submission function
        const result = await submitFunction()

        return result
      } catch (error) {
        console.error('Form submission error:', error)
        throw error
      } finally {
        // End submission
        setState(prev => ({
          ...prev,
          isSubmitting: false
        }))

        onSubmissionEnd?.()

        // Clear timeout if it exists
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }

        // Re-enable after timeout
        timeoutRef.current = setTimeout(() => {
          setState(prev => ({
            ...prev,
            isDisabled: false
          }))
        }, timeout)
      }
    },
    [state.isSubmitting, state.lastSubmission, preventDuplicates, timeout, onSubmissionStart, onSubmissionEnd, onDuplicateAttempt]
  )

  const reset = useCallback(() => {
    setState({
      isSubmitting: false,
      isDisabled: false,
      submitCount: 0,
      lastSubmission: null
    })

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  return {
    ...state,
    handleSubmit,
    reset
  }
}

/**
 * Higher-order component for form protection
 */
export function withFormProtection<P extends object>(
  WrappedComponent: React.ComponentType<P & { formSubmission?: ReturnType<typeof useFormSubmission> }>,
  options: UseFormSubmissionOptions = {}
) {
  return function ProtectedForm(props: P) {
    const formSubmission = useFormSubmission(options)

    return React.createElement(WrappedComponent, {
      ...props,
      formSubmission
    })
  }
}

/**
 * Button component with built-in duplicate prevention
 */
interface ProtectedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClick: () => Promise<void> | void
  loading?: boolean
  cooldownPeriod?: number
  children: React.ReactNode
}

export function ProtectedButton({
  onClick,
  loading = false,
  cooldownPeriod = 3000,
  disabled,
  children,
  ...props
}: ProtectedButtonProps) {
  const [isInCooldown, setIsInCooldown] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleClick = async () => {
    if (isInCooldown || isProcessing || disabled || loading) {
      return
    }

    try {
      setIsProcessing(true)
      setIsInCooldown(true)

      await onClick()

      // Keep button disabled for cooldown period
      setTimeout(() => {
        setIsInCooldown(false)
      }, cooldownPeriod)
    } catch (error) {
      console.error('Button click error:', error)
      // Reset cooldown on error to allow retry
      setIsInCooldown(false)
    } finally {
      setIsProcessing(false)
    }
  }

  const isDisabled = disabled || loading || isInCooldown || isProcessing

  return (
    <button
      {...props}
      onClick={handleClick}
      disabled={isDisabled}
      className={`${props.className || ''} ${
        isDisabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      {isProcessing || loading ? (
        <span className="flex items-center">
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Processing...
        </span>
      ) : (
        children
      )}
    </button>
  )
}

/**
 * Form wrapper with duplicate submission prevention
 */
interface ProtectedFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void> | void
  preventDuplicates?: boolean
  submissionTimeout?: number
  children: React.ReactNode
}

export function ProtectedForm({
  onSubmit,
  preventDuplicates = true,
  submissionTimeout = 5000,
  children,
  ...props
}: ProtectedFormProps) {
  const formSubmission = useFormSubmission({
    preventDuplicates,
    timeout: submissionTimeout,
    onDuplicateAttempt: () => {
      // You could show a toast notification here
      console.warn('Please wait before submitting again')
    }
  })

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    await formSubmission.handleSubmit(async () => {
      await onSubmit(event)
    })
  }

  return (
    <form {...props} onSubmit={handleSubmit}>
      {children}
    </form>
  )
}

export default useFormSubmission
