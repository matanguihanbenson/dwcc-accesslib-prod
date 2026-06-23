import { UserRole } from '@/types'

export function hasPermission(userRole: UserRole, requiredRoles: readonly UserRole[]): boolean {
  return requiredRoles.includes(userRole)
}

export function isAdmin(role: UserRole): boolean {
  return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === UserRole.SUPER_ADMIN
}

export function isStaff(role: UserRole): boolean {
  return role === UserRole.STAFF || isAdmin(role)
}

export function canManageUsers(role: UserRole): boolean {
  // STAFF now has the same library-user management
  // permissions as ADMIN (add / edit / archive / bind
  // RFID / view / activate-deactivate). SUPER_ADMIN-only
  // operations (delete, manage categories) are gated
  // separately via `canManageSystem`.
  return isAdmin(role) || isStaff(role)
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

