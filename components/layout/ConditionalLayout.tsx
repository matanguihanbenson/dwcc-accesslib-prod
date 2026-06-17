'use client'

import { usePathname } from 'next/navigation'
import { MainLayout } from './MainLayout'

interface ConditionalLayoutProps {
  children: React.ReactNode
}

// Public pages that don't need authentication
const PUBLIC_ROUTES = [
  '/',
  '/about',
  '/contact',
  '/browse',
  '/search',
  '/login'
]

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname()

  // Public routes and public book detail pages render without the main layout
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname) || !!pathname.match(/^\/books\/\d+$/)
  if (isPublicRoute) {
    return <>{children}</>
  }

  // All other routes are considered protected and will be handled by middleware
  // This component only decides layout; it does not perform auth checks
  return <MainLayout>{children}</MainLayout>
}
