'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageLayoutProps {
  children: ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  background?: 'gray' | 'white' | 'transparent'
}

export function PageLayout({ 
  children, 
  className,
  maxWidth = '7xl',
  padding = 'md',
  background = 'gray'
}: PageLayoutProps) {
  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md', 
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full'
  }
  
  const paddings = {
    none: '',
    sm: 'px-4 py-4',
    md: 'px-4 py-6 sm:px-6',
    lg: 'px-4 py-8 sm:px-6 lg:px-8'
  }
  
  const backgrounds = {
    gray: 'bg-gray-50',
    white: 'bg-white',
    transparent: 'bg-transparent'
  }

  return (
    <div className={cn('min-h-screen', backgrounds[background])}>
      <div className={cn(
        'container mx-auto',
        maxWidths[maxWidth],
        paddings[padding],
        className
      )}>
        {children}
      </div>
    </div>
  )
}

interface PageHeaderProps {
  title: string
  description?: string
  children?: ReactNode
  className?: string
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn('border-b border-gray-200 pb-6 mb-6', className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          {description && (
            <p className="text-lg text-gray-600">{description}</p>
          )}
        </div>
        {children && (
          <div className="flex items-center space-x-4">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}

interface PageSectionProps {
  title?: string
  description?: string
  children: ReactNode
  className?: string
  headerActions?: ReactNode
}

export function PageSection({ 
  title, 
  description, 
  children, 
  className,
  headerActions 
}: PageSectionProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {(title || description || headerActions) && (
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            {title && (
              <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            )}
            {description && (
              <p className="text-sm text-gray-600">{description}</p>
            )}
          </div>
          {headerActions && (
            <div className="flex items-center space-x-3">
              {headerActions}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
