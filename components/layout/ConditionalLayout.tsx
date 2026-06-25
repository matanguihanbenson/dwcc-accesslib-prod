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

// Public book detail pages. Accepts:
//   - bare numeric ID:        /books/123
//   - slug-id:                /books/good-omens-1
// The optional trailing group allows single-character IDs
// to match, and the negative lookahead explicitly excludes
// every admin sub-route so they keep the authenticated
// sidebar layout.
const PUBLIC_BOOK_DETAIL_RE = /^\/books\/(?!add$|borrow$|return$|transactions$|archived-copies$|categories$|sections$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname()

  // Public routes and public book detail pages render
  // without the sidebar layout.
  const isPublicRoute =
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_BOOK_DETAIL_RE.test(pathname)

  if (isPublicRoute) {
    return <>{children}</>
  }

  // All other routes are considered protected and will be
  // handled by middleware. This component only decides layout;
  // it does not perform auth checks.
  return <MainLayout>{children}</MainLayout>
}

