'use client'

import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode
  error?: string
  icon?: React.ReactNode
  variant?: 'default' | 'error' | 'success'
  inputSize?: 'sm' | 'md' | 'lg'
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, label, icon, variant = 'default', inputSize = 'md', ...props }, ref) => {
    const baseStyles = 'block w-full border rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0'
    
    const variants = {
      default: 'border-gray-300 focus:border-primary-500 focus:ring-primary-500',
      error: 'border-error-500 focus:border-error-500 focus:ring-error-500',
      success: 'border-success-500 focus:border-success-500 focus:ring-success-500'
    }
    
    const sizes = {
      sm: 'px-2.5 py-1.5 text-xs',
      md: 'px-3 py-2 text-sm',
      lg: 'px-4 py-3 text-base'
    }

    const actualVariant = error ? 'error' : variant

    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              {icon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              baseStyles,
              variants[actualVariant],
              sizes[inputSize],
              icon && 'pl-10',
              'placeholder:text-gray-500',
              className
            )}
            ref={ref}
            {...props}
          />
        </div>
        {error && (
          <p className="text-sm text-error-600">{error}</p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }