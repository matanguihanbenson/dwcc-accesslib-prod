'use client'

import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

// Heading Components
interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl'
  weight?: 'normal' | 'medium' | 'semibold' | 'bold'
  color?: 'primary' | 'secondary' | 'muted' | 'error' | 'success' | 'warning'
}

const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, variant = 'h1', size, weight = 'bold', color = 'primary', children, ...props }, ref) => {
    const Component = variant

    const defaultSizes = {
      h1: '3xl',
      h2: '2xl', 
      h3: 'xl',
      h4: 'lg',
      h5: 'md',
      h6: 'sm'
    }

    const actualSize = size || defaultSizes[variant]

    const sizeClasses = {
      xs: 'text-xs',
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
      xl: 'text-xl',
      '2xl': 'text-2xl',
      '3xl': 'text-3xl',
      '4xl': 'text-4xl',
      '5xl': 'text-5xl',
      '6xl': 'text-6xl'
    }

    const weightClasses = {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold'
    }

    const colorClasses = {
      primary: 'text-gray-900',
      secondary: 'text-gray-700',
      muted: 'text-gray-500',
      error: 'text-error-600',
      success: 'text-success-600',
      warning: 'text-warning-600'
    }

    return (
      <Component
        ref={ref}
        className={cn(
          sizeClasses[actualSize as keyof typeof sizeClasses],
          weightClasses[weight],
          colorClasses[color],
          'leading-tight tracking-tight',
          className
        )}
        {...props}
      >
        {children}
      </Component>
    )
  }
)
Heading.displayName = 'Heading'

// Text Component
interface TextProps extends HTMLAttributes<HTMLParagraphElement> {
  variant?: 'body' | 'caption' | 'label' | 'small' | 'large'
  weight?: 'normal' | 'medium' | 'semibold' | 'bold'
  color?: 'primary' | 'secondary' | 'muted' | 'error' | 'success' | 'warning'
  align?: 'left' | 'center' | 'right' | 'justify'
}

const Text = forwardRef<HTMLParagraphElement, TextProps>(
  ({ className, variant = 'body', weight = 'normal', color = 'primary', align = 'left', children, ...props }, ref) => {
    const variantClasses = {
      body: 'text-base leading-relaxed',
      caption: 'text-sm leading-normal',
      label: 'text-sm font-medium leading-none',
      small: 'text-xs leading-normal',
      large: 'text-lg leading-relaxed'
    }

    const weightClasses = {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold'
    }

    const colorClasses = {
      primary: 'text-gray-900',
      secondary: 'text-gray-700',
      muted: 'text-gray-500',
      error: 'text-error-600',
      success: 'text-success-600',
      warning: 'text-warning-600'
    }

    const alignClasses = {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
      justify: 'text-justify'
    }

    return (
      <p
        ref={ref}
        className={cn(
          variantClasses[variant],
          weightClasses[weight],
          colorClasses[color],
          alignClasses[align],
          className
        )}
        {...props}
      >
        {children}
      </p>
    )
  }
)
Text.displayName = 'Text'

// Link Component
interface LinkProps extends HTMLAttributes<HTMLAnchorElement> {
  href?: string
  variant?: 'primary' | 'secondary' | 'muted'
  underline?: 'none' | 'hover' | 'always'
  size?: 'sm' | 'md' | 'lg'
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  ({ className, variant = 'primary', underline = 'hover', size = 'md', children, ...props }, ref) => {
    const variantClasses = {
      primary: 'text-primary-600 hover:text-primary-700',
      secondary: 'text-gray-600 hover:text-gray-700',
      muted: 'text-gray-500 hover:text-gray-600'
    }

    const underlineClasses = {
      none: 'no-underline',
      hover: 'hover:underline',
      always: 'underline'
    }

    const sizeClasses = {
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg'
    }

    return (
      <a
        ref={ref}
        className={cn(
          'transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-sm',
          variantClasses[variant],
          underlineClasses[underline],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
      </a>
    )
  }
)
Link.displayName = 'Link'

export { Heading, Text, Link }
