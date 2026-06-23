import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import type { UserRole } from '@/types'
// Import config only on the server. Do not import this file client-side.
import config from './config'
import { NAVIGATION_ITEMS, USER_ROLES } from '@/lib/constants'

export interface RoutePermission {
  path: string
  roles: UserRole[]
  exact?: boolean
}

// Build protected routes from navigation items to centralize role checks
const buildProtectedRoutes = (): RoutePermission[] => {
  const routes: RoutePermission[] = []

  // Include dashboard explicitly for all roles, including USER
  routes.push({ path: '/dashboard', roles: [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.STAFF, USER_ROLES.USER] })

  // Flatten navigation items
  NAVIGATION_ITEMS.forEach(item => {
    if (item.href && item.roles && item.href !== '/browse') {
      routes.push({ path: item.href, roles: item.roles as UserRole[] })
    }
    if (item.children) {
      item.children.forEach(child => {
        if (child.href && child.roles) {
          routes.push({ path: child.href, roles: child.roles as UserRole[] })
        }
      })
    }
  })

  // Fine-grained protections not in navigation
  routes.push({ path: '/books', roles: [USER_ROLES.ADMIN, USER_ROLES.STAFF], exact: true }) // only /books list page
  // Protect book edit pages explicitly
  routes.push({ path: '/books/', roles: [USER_ROLES.ADMIN, USER_ROLES.STAFF] }) // will be filtered by detail regex below

  return routes
}

const protectedRoutes: RoutePermission[] = buildProtectedRoutes()

const publicRoutes = [
  '/login',
  '/api/auth',
  '/',
  '/browse',
  '/search',
  '/about',
  '/contact',
  // /setup is publicly accessible so the very first
  // SUPER_ADMIN can be created before any account exists.
  // The /setup page itself checks /api/setup/status on
  // mount and redirects to /login when setup is already
  // complete, so the route is "self-locking".
  '/setup'
]

// Routes that bypass the setup-wizard redirect so the user can
// actually reach /setup, /login, etc. when the system has no
// SUPER_ADMIN yet.
const setupBypassRoutes = [
  '/setup',
  '/login',
  '/api/setup',
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/public'
]

/**
 * Cached "is the system set up?" check used by the setup
 * redirect below. Edge-runtime safe (no Prisma) — the actual
 * DB count is fetched by /api/setup/status, which caches the
 * result server-side for ~30s.
 */
interface SetupCacheEntry {
  setupRequired: boolean
  expiresAt: number
}
let setupCache: SetupCacheEntry | null = null
const SETUP_CACHE_TTL_MS = 15_000

async function checkSetupRequired(originUrl: string): Promise<boolean> {
  const now = Date.now()
  if (setupCache && setupCache.expiresAt > now) {
    return setupCache.setupRequired
  }
  try {
    // Call our own /api/setup/status from the middleware.
    // Origin URL is the request's own host so this stays
    // internal and works in any deployment.
    const statusUrl = new URL('/api/setup/status', originUrl)
    const response = await fetch(statusUrl, {
      // Edge runtimes forbid keep-alive; this is also the
      // default but being explicit avoids surprises.
      cache: 'no-store',
      headers: { accept: 'application/json' }
    })
    if (!response.ok) {
      // If the status endpoint is unreachable we err on the
      // side of "already set up" so the user isn't trapped
      // in a redirect loop.
      return false
    }
    const data = (await response.json()) as { setupRequired?: boolean }
    const setupRequired = data.setupRequired === true
    setupCache = { setupRequired, expiresAt: now + SETUP_CACHE_TTL_MS }
    return setupRequired
  } catch {
    return false
  }
}

/**
 * Build the /setup redirect URL with the SETUP_TOKEN. The
 * token is only read from process.env (server side), never
 * from the URL — so an attacker can't trigger a redirect
 * with an arbitrary token and then have it round-trip back to
 * the user.
 */
function buildSetupRedirect(request: NextRequest): URL {
  const url = new URL('/setup', request.url)
  const setupToken = process.env.SETUP_TOKEN
  if (setupToken && setupToken.length > 0) {
    url.searchParams.set('token', setupToken)
  }
  return url
}

export async function authMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. First-time setup wizard: if no SUPER_ADMIN exists yet,
  //    force every non-bypassed request to /setup. This runs
  //    BEFORE the auth check so an unauthenticated user can
  //    still complete the initial setup.
  if (!setupBypassRoutes.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    const setupRequired = await checkSetupRequired(request.url)
    if (setupRequired) {
      return NextResponse.redirect(buildSetupRedirect(request))
    }
  }

  // 2. Setup is done (or the user is on /setup itself). From
  //    here on, behave as before: bounce /login -> /dashboard
  //    when authenticated, and gate every other route by role.
  if (pathname.startsWith('/login')) {
    try {
      const token = await getToken({
        req: request,
        secret: config.get('NEXTAUTH_SECRET'),
      })
      if (token) {
        const dashboardUrl = new URL('/dashboard', request.url)
        return NextResponse.redirect(dashboardUrl)
      }
    } catch {
      // ignore and proceed to next
    }
    return NextResponse.next()
  }

  // Allow public routes - no authentication required
  if (publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    return NextResponse.next()
  }

  // Allow public access to book detail pages (e.g., /books/123)
  if (pathname.match(/^\/books\/\d+$/)) {
    return NextResponse.next()
  }

  // /setup is intentionally NOT gated by the public-route
  // allow above. The page renders the wizard only when no
  // SUPER_ADMIN exists yet; once one does, the page itself
  // redirects to /login on mount (and the create endpoint
  // also rejects any further POSTs). That way the same URL
  // serves both "needs setup" and "already done" without
  // needing the middleware to flip its behaviour per request.

  try {
    const token = await getToken({
      req: request,
      secret: config.get('NEXTAUTH_SECRET'),
    })

    if (!token) {
      return redirectToLogin(request)
    }

    const userRole = token.role as UserRole

    const matchedRoute = protectedRoutes.find(route => {
      if (route.exact) {
        return pathname === route.path
      }
      return pathname.startsWith(route.path)
    })

    if (matchedRoute && !matchedRoute.roles.includes(userRole)) {
      // Unauthorized access - redirect to dashboard without query params
      if (pathname === '/dashboard') {
        return NextResponse.next()
      }
      const dashboardUrl = new URL('/dashboard', request.url)
      return NextResponse.redirect(dashboardUrl)
    }

    return NextResponse.next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    return redirectToLogin(request)
  }
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('callbackUrl', request.url)
  return NextResponse.redirect(loginUrl)
}

export function hasPermission(userRole: UserRole, requiredRoles: readonly UserRole[]): boolean {
  return requiredRoles.includes(userRole)
}

export function isAdmin(role: UserRole): boolean {
  return role === USER_ROLES.SUPER_ADMIN || role === USER_ROLES.ADMIN
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === USER_ROLES.SUPER_ADMIN
}

export function isStaff(role: UserRole): boolean {
  return role === USER_ROLES.STAFF || isAdmin(role)
}

export function canManageUsers(role: UserRole): boolean {
  return isAdmin(role)
}

export function canManageBooks(role: UserRole): boolean {
  return isStaff(role)
}

export function canViewReports(role: UserRole): boolean {
  return isAdmin(role)
}

export function canViewAuditLogs(role: UserRole): boolean {
  return isAdmin(role)
}

export function canManageSystem(role: UserRole): boolean {
  return isSuperAdmin(role)
}
