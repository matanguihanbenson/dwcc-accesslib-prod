import { AuditService } from '@/lib/services/audit.service'
import { UserRole } from '@/types'

/**
 * Centralized audit logging utility
 * Usage: import { auditLogger } from '@/lib/audit-logger'
 */

export class AuditLogger {
  /**
   * Get client IP and user agent from request
   */
  private static getRequestInfo(req?: Request) {
    if (!req) return { ipAddress: undefined, userAgent: undefined }
    
    const forwarded = req.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || undefined
    const userAgent = req.headers.get('user-agent') || undefined
    
    return { ipAddress: ip, userAgent }
  }

  // Authentication events
  static async logLogin(userId: number, role: UserRole, username: string, req?: Request) {
    const { ipAddress, userAgent } = this.getRequestInfo(req)
    await AuditService.logAuth(
      userId, 
      role, 
      'LOGIN', 
      `User ${username} logged in successfully`,
      ipAddress,
      userAgent
    )
  }

  static async logLogout(userId: number, role: UserRole, username: string, req?: Request) {
    const { ipAddress, userAgent } = this.getRequestInfo(req)
    await AuditService.logAuth(
      userId, 
      role, 
      'LOGOUT', 
      `User ${username} logged out`,
      ipAddress,
      userAgent
    )
  }

  static async logLoginFailed(username: string, req?: Request) {
    const { ipAddress, userAgent } = this.getRequestInfo(req)
    await AuditService.logAuth(
      0, 
      UserRole.USER, 
      'LOGIN_FAILED', 
      `Failed login attempt for username: ${username}`,
      ipAddress,
      userAgent
    )
  }

  // Profile management events
  static async logProfileUpdate(userId: number, role: UserRole, username: string, changes: string[], req?: Request) {
    const { ipAddress, userAgent } = this.getRequestInfo(req)
    await AuditService.logProfile(
      userId, 
      role, 
      'PROFILE_UPDATE', 
      `User ${username} updated profile: ${changes.join(', ')}`,
      ipAddress,
      userAgent
    )
  }

  static async logPasswordChange(userId: number, role: UserRole, username: string, req?: Request) {
    const { ipAddress, userAgent } = this.getRequestInfo(req)
    await AuditService.logProfile(
      userId, 
      role, 
      'PASSWORD_CHANGE', 
      `User ${username} changed their password`,
      ipAddress,
      userAgent
    )
  }

  // User management events
  static async logUserCreate(adminUserId: number, adminRole: UserRole, targetUsername: string, targetRole: UserRole, req?: Request) {
    const { ipAddress, userAgent } = this.getRequestInfo(req)
    await AuditService.logUser(
      adminUserId, 
      adminRole, 
      'USER_CREATE', 
      `Created new ${targetRole} user: ${targetUsername}`,
      ipAddress,
      userAgent
    )
  }

  static async logUserStatusChange(adminUserId: number, adminRole: UserRole, targetDisplayName: string, newStatus: string, req?: Request) {
    const { ipAddress, userAgent } = this.getRequestInfo(req)
    const action = newStatus === 'ACTIVE' ? 'USER_ACTIVATE' : 'USER_DEACTIVATE'
    await AuditService.logUser(
      adminUserId, 
      adminRole, 
      action, 
      `${newStatus === 'ACTIVE' ? 'Activated' : 'Deactivated'} user: ${targetDisplayName}`,
      ipAddress,
      userAgent
    )
  }

  static async logPasswordReset(adminUserId: number, adminRole: UserRole, targetDisplayName: string, req?: Request) {
    const { ipAddress, userAgent } = this.getRequestInfo(req)
    await AuditService.logUser(
      adminUserId, 
      adminRole, 
      'PASSWORD_RESET', 
      `Reset password for user: ${targetDisplayName}`,
      ipAddress,
      userAgent
    )
  }

  // Book management events
  static async logBookAdd(userId: number, role: UserRole, bookTitle: string, isbn: string, req?: Request) {
    const { ipAddress, userAgent } = this.getRequestInfo(req)
    await AuditService.logBook(
      userId, 
      role, 
      'BOOK_ADD', 
      `Added new book: "${bookTitle}" (ISBN: ${isbn})`,
      ipAddress,
      userAgent
    )
  }

  static async logBookUpdate(userId: number, role: UserRole, bookTitle: string, changes: string[], req?: Request) {
    const { ipAddress, userAgent } = this.getRequestInfo(req)
    await AuditService.logBook(
      userId, 
      role, 
      'BOOK_UPDATE', 
      `Updated book "${bookTitle}": ${changes.join(', ')}`,
      ipAddress,
      userAgent
    )
  }

  static async logBookDelete(userId: number, role: UserRole, bookTitle: string, req?: Request) {
    const { ipAddress, userAgent } = this.getRequestInfo(req)
    await AuditService.logBook(
      userId, 
      role, 
      'BOOK_DELETE', 
      `Deleted book: "${bookTitle}"`,
      ipAddress,
      userAgent
    )
  }

  static async logBookBorrow(userId: number, role: UserRole, bookTitle: string, borrowerName: string, req?: Request) {
    const { ipAddress, userAgent } = this.getRequestInfo(req)
    await AuditService.logBook(
      userId, 
      role, 
      'BOOK_BORROW', 
      `Book "${bookTitle}" borrowed by ${borrowerName}`,
      ipAddress,
      userAgent
    )
  }

  static async logBookReturn(userId: number, role: UserRole, bookTitle: string, borrowerName: string, req?: Request) {
    const { ipAddress, userAgent } = this.getRequestInfo(req)
    await AuditService.logBook(
      userId, 
      role, 
      'BOOK_RETURN', 
      `Book "${bookTitle}" returned by ${borrowerName}`,
      ipAddress,
      userAgent
    )
  }

  // Department management events
  static async logDepartmentCreate(userId: number, role: UserRole, departmentName: string, departmentCode: string, req?: Request) {
    const { ipAddress, userAgent } = this.getRequestInfo(req)
    await AuditService.logAction(
      userId, 
      role, 
      'DEPARTMENT_CREATE', 
      `Created new department: "${departmentName}" (Code: ${departmentCode})`,
      ipAddress,
      userAgent
    )
  }

  static async logDepartmentUpdate(userId: number, role: UserRole, departmentName: string, changes: string[], req?: Request) {
    const { ipAddress, userAgent } = this.getRequestInfo(req)
    await AuditService.logAction(
      userId, 
      role, 
      'DEPARTMENT_UPDATE', 
      `Updated department "${departmentName}": ${changes.join(', ')}`,
      ipAddress,
      userAgent
    )
  }

  static async logDepartmentDelete(userId: number, role: UserRole, departmentName: string, req?: Request) {
    const { ipAddress, userAgent } = this.getRequestInfo(req)
    await AuditService.logAction(
      userId, 
      role, 
      'DEPARTMENT_DELETE', 
      `Deleted department: "${departmentName}"`,
      ipAddress,
      userAgent
    )
  }

  static async logDepartmentStatusChange(userId: number, role: UserRole, departmentName: string, newStatus: string, req?: Request) {
    const { ipAddress, userAgent } = this.getRequestInfo(req)
    const action = newStatus === 'ACTIVE' ? 'DEPARTMENT_ACTIVATE' : 'DEPARTMENT_DEACTIVATE'
    await AuditService.logAction(
      userId, 
      role, 
      action, 
      `${newStatus === 'ACTIVE' ? 'Activated' : 'Deactivated'} department: "${departmentName}"`,
      ipAddress,
      userAgent
    )
  }

  // Program management events
  static async logProgramCreate(userId: number, role: UserRole, programName: string, programCode: string, departmentName: string, req?: Request) {
    const { ipAddress, userAgent } = this.getRequestInfo(req)
    await AuditService.logAction(
      userId, 
      role, 
      'PROGRAM_CREATE', 
      `Created new program: "${programName}" (Code: ${programCode}) in department "${departmentName}"`,
      ipAddress,
      userAgent
    )
  }

  static async logProgramUpdate(userId: number, role: UserRole, programName: string, changes: string[], req?: Request) {
    const { ipAddress, userAgent } = this.getRequestInfo(req)
    await AuditService.logAction(
      userId, 
      role, 
      'PROGRAM_UPDATE', 
      `Updated program "${programName}": ${changes.join(', ')}`,
      ipAddress,
      userAgent
    )
  }

  static async logProgramDelete(userId: number, role: UserRole, programName: string, req?: Request) {
    const { ipAddress, userAgent } = this.getRequestInfo(req)
    await AuditService.logAction(
      userId, 
      role, 
      'PROGRAM_DELETE', 
      `Deleted program: "${programName}"`,
      ipAddress,
      userAgent
    )
  }

  static async logProgramStatusChange(userId: number, role: UserRole, programName: string, newStatus: string, req?: Request) {
    const { ipAddress, userAgent } = this.getRequestInfo(req)
    const action = newStatus === 'ACTIVE' ? 'PROGRAM_ACTIVATE' : 'PROGRAM_DEACTIVATE'
    await AuditService.logAction(
      userId, 
      role, 
      action, 
      `${newStatus === 'ACTIVE' ? 'Activated' : 'Deactivated'} program: "${programName}"`,
      ipAddress,
      userAgent
    )
  }

  // System management events
  static async logSystemConfig(userId: number, role: UserRole, configType: string, details: string, req?: Request) {
    const { ipAddress, userAgent } = this.getRequestInfo(req)
    await AuditService.logSystem(
      userId, 
      role, 
      'SYSTEM_CONFIG', 
      `System configuration changed - ${configType}: ${details}`,
      ipAddress,
      userAgent
    )
  }

  // Generic action logger
  static async logAction(
    userId: number, 
    role: UserRole, 
    action: string, 
    description: string, 
    req?: Request
  ) {
    const { ipAddress, userAgent } = this.getRequestInfo(req)
    await AuditService.logAction(userId, role, action, description, ipAddress, userAgent)
  }
}

export const auditLogger = AuditLogger

