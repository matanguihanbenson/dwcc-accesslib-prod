import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { UserRole } from '@/types'

export interface UseAuthOptions {
  /** If true, redirect to login if not authenticated */
  requireAuth?: boolean
  /** Required roles for this page/action */
  requiredRoles?: UserRole[]
  /** Redirect path if unauthorized (default: /dashboard) */
  unauthorizedRedirect?: string
  /** Redirect path if unauthenticated (default: /login) */
  unauthenticatedRedirect?: string
}

export interface UseAuthReturn {
  /** Session data */
  session: ReturnType<typeof useSession>['data']
  /** Session status */
  status: 'loading' | 'authenticated' | 'unauthenticated'
  /** Whether the user is authenticated */
  isAuthenticated: boolean
  /** Whether authentication is being loaded */
  isLoading: boolean
  /** Whether the user has required permissions */
  isAuthorized: boolean
  /** User role if authenticated */
  userRole: UserRole | null
}

/**
 * Centralized authentication hook that handles:
 * - Session state management
 * - Loading states
 * - Authorization checks
 * - Automatic redirects
 */
export function useAuth(options: UseAuthOptions = {}): UseAuthReturn {
  const {
    requireAuth = false,
    requiredRoles = [],
    unauthorizedRedirect = '/dashboard',
    unauthenticatedRedirect = '/login',
  } = options

  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [hasRedirected, setHasRedirected] = useState(false)

  const isAuthenticated = status === 'authenticated' && !!session
  const isLoading = status === 'loading'
  const userRole = (session?.user?.role as UserRole) || null

  // Check if user has required roles
  const isAuthorized = isAuthenticated && (
    requiredRoles.length === 0 || 
    (userRole && requiredRoles.includes(userRole))
  )

  // Handle redirects
  useEffect(() => {
    // Skip during loading or if already redirected
    if (isLoading || hasRedirected) return

    // Don't redirect on public routes unless requireAuth is true
    const publicRoutes = ['/', '/login', '/about', '/contact', '/browse']
    if (publicRoutes.includes(pathname) && !requireAuth) return

    // Redirect if authentication is required but user is not authenticated
    if (requireAuth && !isAuthenticated) {
      setHasRedirected(true)
      const loginUrl = `${unauthenticatedRedirect}?callbackUrl=${encodeURIComponent(pathname)}`
      router.replace(loginUrl)
      return
    }

    // Redirect if user is authenticated but not authorized
    if (requireAuth && isAuthenticated && !isAuthorized && requiredRoles.length > 0) {
      setHasRedirected(true)
      router.replace(unauthorizedRedirect)
      return
    }
  }, [
    isLoading,
    isAuthenticated,
    isAuthorized,
    requireAuth,
    pathname,
    router,
    unauthenticatedRedirect,
    unauthorizedRedirect,
    requiredRoles.length,
    hasRedirected,
  ])

  return {
    session,
    status,
    isAuthenticated,
    isLoading,
    isAuthorized,
    userRole,
  }
}

/**
 * Hook specifically for protected pages that require authentication
 */
export function useProtectedPage(requiredRoles?: UserRole[]) {
  return useAuth({
    requireAuth: true,
    requiredRoles: requiredRoles || [],
  })
}

/**
 * Check if user has permission for specific roles
 */
export function useHasRole(roles: UserRole | UserRole[]): boolean {
  const { isAuthenticated, userRole } = useAuth()
  
  if (!isAuthenticated || !userRole) return false
  
  const roleArray = Array.isArray(roles) ? roles : [roles]
  return roleArray.includes(userRole)
}

