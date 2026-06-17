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

const publicRoutes = ['/login', '/api/auth', '/', '/browse', '/search', '/about', '/contact']

export async function authMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // If user is authenticated and visits the login page, send them to dashboard
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
