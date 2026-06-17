/**
 * DWCC AccessLib Design System
 * A comprehensive design system for consistent UI/UX across the application
 */

// Design Tokens
export const designTokens = {
  // Color Palette
  colors: {
    // Primary Brand Colors
    primary: {
      50: '#eff6ff',
      100: '#dbeafe', 
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6', // Main primary
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554'
    },
    
    // Secondary Colors
    secondary: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
      950: '#020617'
    },
    
    // Semantic Colors
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d'
    },
    
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f'
    },
    
    error: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d'
    },
    
    // Neutral Grays
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
      950: '#030712'
    }
  },
  
  // Typography Scale
  typography: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'Consolas', 'monospace']
    },
    
    fontSize: {
      xs: ['0.75rem', { lineHeight: '1rem' }],
      sm: ['0.875rem', { lineHeight: '1.25rem' }],
      base: ['1rem', { lineHeight: '1.5rem' }],
      lg: ['1.125rem', { lineHeight: '1.75rem' }],
      xl: ['1.25rem', { lineHeight: '1.75rem' }],
      '2xl': ['1.5rem', { lineHeight: '2rem' }],
      '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      '5xl': ['3rem', { lineHeight: '1' }],
      '6xl': ['3.75rem', { lineHeight: '1' }]
    },
    
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700'
    }
  },
  
  // Spacing Scale
  spacing: {
    px: '1px',
    0: '0',
    0.5: '0.125rem',
    1: '0.25rem',
    1.5: '0.375rem',
    2: '0.5rem',
    2.5: '0.625rem',
    3: '0.75rem',
    3.5: '0.875rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    7: '1.75rem',
    8: '2rem',
    9: '2.25rem',
    10: '2.5rem',
    12: '3rem',
    14: '3.5rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
    28: '7rem',
    32: '8rem'
  },
  
  // Border Radius
  borderRadius: {
    none: '0',
    sm: '0.125rem',
    DEFAULT: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    '3xl': '1.5rem',
    full: '9999px'
  },
  
  // Shadows
  boxShadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)'
  },
  
  // Z-Index Scale
  zIndex: {
    0: '0',
    10: '10',
    20: '20',
    30: '30',
    40: '40',
    50: '50',
    modal: '1000',
    popover: '1010',
    tooltip: '1020',
    notification: '1030'
  }
} as const

// Component Variants
export const componentVariants = {
  // Button variants
  button: {
    base: 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
    
    variants: {
      primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
      secondary: 'bg-secondary-600 text-white hover:bg-secondary-700 focus:ring-secondary-500', 
      outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-primary-500',
      ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-primary-500',
      success: 'bg-success-600 text-white hover:bg-success-700 focus:ring-success-500',
      warning: 'bg-warning-600 text-white hover:bg-warning-700 focus:ring-warning-500',
      error: 'bg-error-600 text-white hover:bg-error-700 focus:ring-error-500'
    },
    
    sizes: {
      xs: 'px-2.5 py-1.5 text-xs rounded',
      sm: 'px-3 py-2 text-sm rounded-md',
      md: 'px-4 py-2 text-sm rounded-md',
      lg: 'px-4 py-2 text-base rounded-md',
      xl: 'px-6 py-3 text-base rounded-md'
    }
  },
  
  // Input variants
  input: {
    base: 'block w-full border border-gray-300 rounded-md px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors',
    
    variants: {
      default: '',
      error: 'border-error-500 focus:ring-error-500 focus:border-error-500',
      success: 'border-success-500 focus:ring-success-500 focus:border-success-500'
    },
    
    sizes: {
      sm: 'px-2.5 py-1.5 text-xs',
      md: 'px-3 py-2 text-sm',
      lg: 'px-4 py-3 text-base'
    }
  },
  
  // Card variants
  card: {
    base: 'bg-white border border-gray-200 rounded-lg shadow-sm',
    
    variants: {
      default: '',
      elevated: 'shadow-md',
      outlined: 'border-2',
      ghost: 'border-transparent shadow-none'
    },
    
    padding: {
      none: '',
      sm: 'p-4',
      md: 'p-6', 
      lg: 'p-8'
    }
  },
  
  // Badge/Status variants
  badge: {
    base: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
    
    variants: {
      default: 'bg-gray-100 text-gray-800',
      primary: 'bg-primary-100 text-primary-800',
      success: 'bg-success-100 text-success-800',
      warning: 'bg-warning-100 text-warning-800',
      error: 'bg-error-100 text-error-800',
      active: 'bg-success-100 text-success-800',
      inactive: 'bg-gray-100 text-gray-800',
      archived: 'bg-gray-100 text-gray-600',
      available: 'bg-success-100 text-success-800',
      borrowed: 'bg-primary-100 text-primary-800',
      overdue: 'bg-error-100 text-error-800',
      damaged: 'bg-warning-100 text-warning-800',
      maintenance: 'bg-warning-100 text-warning-800'
    }
  }
} as const

// Layout Patterns
export const layoutPatterns = {
  // Page layouts
  page: {
    container: 'min-h-screen bg-gray-50',
    content: 'container mx-auto px-4 py-6',
    maxWidth: 'max-w-7xl'
  },
  
  // Form layouts
  form: {
    container: 'space-y-6',
    group: 'space-y-2',
    row: 'grid grid-cols-1 gap-4 sm:grid-cols-2',
    actions: 'flex items-center justify-end space-x-4'
  },
  
  // Grid layouts
  grid: {
    responsive: 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3',
    dashboard: 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4',
    table: 'overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg'
  }
} as const

// Animation Presets
export const animations = {
  // Transitions
  transition: {
    fast: 'transition-all duration-150 ease-in-out',
    normal: 'transition-all duration-200 ease-in-out', 
    slow: 'transition-all duration-300 ease-in-out'
  },
  
  // Common animations
  fadeIn: 'animate-fadeIn',
  slideIn: 'animate-slideIn',
  bounce: 'animate-bounce',
  pulse: 'animate-pulse',
  spin: 'animate-spin'
} as const

// Utility Functions
export const utils = {
  // Class name merger (cn function replacement)
  cn: (...classes: (string | undefined | null | false)[]): string => {
    return classes.filter(Boolean).join(' ')
  },
  
  // Get color value by path
  getColor: (path: string): string => {
    const keys = path.split('.')
    let current: any = designTokens.colors
    
    for (const key of keys) {
      current = current?.[key]
    }
    
    return current || path
  },
  
  // Get spacing value
  getSpacing: (value: keyof typeof designTokens.spacing): string => {
    return designTokens.spacing[value] || value
  }
} as const

// Export all for easy access
export default {
  tokens: designTokens,
  variants: componentVariants,
  layouts: layoutPatterns,
  animations,
  utils
}
