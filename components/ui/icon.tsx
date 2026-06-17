'use client'

import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface IconProps extends HTMLAttributes<HTMLElement> {
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const Icon = forwardRef<HTMLElement, IconProps>(
  ({ name, size = 'md', className, ...props }, ref) => {
    const sizeClasses = {
      xs: 'w-3 h-3 text-xs',
      sm: 'w-4 h-4 text-sm', 
      md: 'w-5 h-5',
      lg: 'w-6 h-6 text-lg',
      xl: 'w-8 h-8 text-xl'
    }

    return (
      <i
        ref={ref}
        className={cn(
          'fas',
          name,
          sizeClasses[size],
          className
        )}
        aria-hidden="true"
        suppressHydrationWarning
        {...props}
      />
    )
  }
)
Icon.displayName = 'Icon'

export { Icon }
