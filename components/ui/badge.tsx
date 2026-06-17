'use client'

import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'outline' | 
           'active' | 'inactive' | 'archived' | 'available' | 'borrowed' | 
           'overdue' | 'damaged' | 'maintenance'
  size?: 'sm' | 'md' | 'lg'
}

function Badge({ className, variant = 'default', size = 'md', ...props }: BadgeProps) {
  const baseStyles = 'inline-flex items-center rounded-full font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'
  
  const variants = {
    default: 'bg-gray-100 text-gray-800 focus:ring-gray-500',
    primary: 'bg-primary-100 text-primary-800 focus:ring-primary-500',
    success: 'bg-success-100 text-success-800 focus:ring-success-500',
    warning: 'bg-warning-100 text-warning-800 focus:ring-warning-500',
    error: 'bg-error-100 text-error-800 focus:ring-error-500',
    outline: 'border border-gray-300 text-gray-700 bg-white focus:ring-primary-500',
    
    // Status-specific variants
    active: 'bg-success-100 text-success-800 focus:ring-success-500',
    inactive: 'bg-error-100 text-error-800 focus:ring-error-500',
    archived: 'bg-gray-100 text-gray-600 focus:ring-gray-500',
    available: 'bg-success-100 text-success-800 focus:ring-success-500',
    borrowed: 'bg-primary-100 text-primary-800 focus:ring-primary-500',
    overdue: 'bg-error-100 text-error-800 focus:ring-error-500',
    damaged: 'bg-warning-100 text-warning-800 focus:ring-warning-500',
    maintenance: 'bg-warning-100 text-warning-800 focus:ring-warning-500',
  }
  
  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-xs',
    lg: 'px-3 py-1 text-sm'
  }

  return (
    <div
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
}

export { Badge }