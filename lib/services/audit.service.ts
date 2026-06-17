import { BaseService } from './base.service'
import { prisma } from '@/lib/prisma'
import { ServiceResult, AuditLog, SearchFilters, UserRole } from '@/types'
import { validatePagination, createPaginationResponse } from '@/lib/utils'

export class AuditService extends BaseService {
  static async logAction(
    userAccountId: number,
    role: UserRole,
    action: string,
    description: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      // For failed login attempts with non-existent users (userAccountId = 0), 
      // we need to handle this differently to avoid foreign key constraint violations
      if (!userAccountId || Number.isNaN(userAccountId) || userAccountId === 0) {
        // Log to console instead of database to avoid foreign key constraint violations
        console.log(`AUDIT: ${action} - ${description} (IP: ${ipAddress})`)
        return
      }
      
      await prisma.auditLog.create({
        data: {
          user_account: {
            connect: { id: userAccountId }
          },
          role,
          action,
          description,
          ip_address: ipAddress,
          user_agent: userAgent,
          date_time_log: new Date(),
        }
      })
    } catch (error) {
      console.error('Failed to log audit action:', error)
      // Don't throw the error to prevent breaking the main flow
    }
  }

  static async logAuth(
    userAccountId: number,
    role: UserRole,
    action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED',
    description: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logAction(userAccountId, role, action, description, ipAddress, userAgent)
  }

  // Profile and user management actions
  static async logProfile(
    userAccountId: number,
    role: UserRole,
    action: 'PROFILE_UPDATE' | 'PASSWORD_CHANGE' | 'STATUS_CHANGE',
    description: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logAction(userAccountId, role, action, description, ipAddress, userAgent)
  }

  // Book management actions
  static async logBook(
    userAccountId: number,
    role: UserRole,
    action: 'BOOK_ADD' | 'BOOK_UPDATE' | 'BOOK_DELETE' | 'BOOK_BORROW' | 'BOOK_RETURN',
    description: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logAction(userAccountId, role, action, description, ipAddress, userAgent)
  }

  // User management actions
  static async logUser(
    userAccountId: number,
    role: UserRole,
    action: 'USER_CREATE' | 'USER_UPDATE' | 'USER_DELETE' | 'USER_ACTIVATE' | 'USER_DEACTIVATE' | 'PASSWORD_RESET',
    description: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logAction(userAccountId, role, action, description, ipAddress, userAgent)
  }

  // System actions
  static async logSystem(
    userAccountId: number,
    role: UserRole,
    action: 'SYSTEM_CONFIG' | 'BACKUP_CREATE' | 'BACKUP_RESTORE' | 'MAINTENANCE',
    description: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logAction(userAccountId, role, action, description, ipAddress, userAgent)
  }

  async getAuditLogs(filters: SearchFilters, currentUserRole: UserRole, currentUserId?: number): Promise<ServiceResult> {
    try {
      const baseWhere = this.buildAuditSearchQuery(filters)

      let customWhere: any = { ...baseWhere }

      // Apply role-based visibility while honoring explicit role filters
      if (currentUserRole === UserRole.STAFF) {
        // Staff can only see their own actions
        customWhere.user_account_id = currentUserId
      } else if (currentUserRole === UserRole.ADMIN) {
        // If caller did not explicitly filter by role, apply default admin scope
        if (!filters.role) {
          customWhere = {
            ...customWhere,
            OR: [
              { user_account_id: currentUserId },
              { role: { in: [UserRole.ADMIN, UserRole.STAFF] } },
            ],
          }
        } else {
          // When a specific role is requested, intersect with their own actions if needed
          if (filters.role === UserRole.STAFF) {
            customWhere.role = UserRole.STAFF
          } else if (filters.role === UserRole.ADMIN) {
            customWhere.role = UserRole.ADMIN
          } else {
            // For other roles (e.g., SUPER_ADMIN, USER), rely on explicit filter only
            customWhere.role = filters.role
          }
        }
      } else if (currentUserRole === UserRole.SUPER_ADMIN) {
        // Super admin can see all actions; no extra constraints beyond filters
        customWhere = { ...customWhere }
      }

      // Custom pagination for audit logs with correct field names
      const { page, limit } = validatePagination(filters.page, filters.limit)
      const skip = (page - 1) * limit
      
      const where = customWhere || baseWhere
      // Debug: log filters and final where clause for troubleshooting
      console.log('AuditService.getAuditLogs filters:', JSON.stringify(filters))
      console.log('AuditService.getAuditLogs where:', JSON.stringify(where))
      const orderBy = { date_time_log: 'desc' as any } // Use correct field name for audit logs
      
      const [items, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          include: { 
            user_account: {
              include: {
                user: true
              }
            }
          },
          orderBy,
          skip,
          take: limit,
        }),
        prisma.auditLog.count({ where }),
      ])
      
      const result = createPaginationResponse(items, total, page, limit)

      return this.handleSuccess(result)
    } catch (error) {
      return this.handleError(error, 'AuditService.getAuditLogs')
    }
  }

  async getAuditLogById(eventId: number): Promise<ServiceResult<AuditLog>> {
    try {
      const validatedId = this.validateId(eventId, 'Event ID')
      
      const auditLog = await this.findUnique<AuditLog>(
        prisma.auditLog,
        { event_id: validatedId },
        { user: true },
        'Audit log not found'
      )

      return this.handleSuccess(auditLog)
    } catch (error) {
      return this.handleError(error, 'AuditService.getAuditLogById')
    }
  }

  async getUserAuditLogs(userId: number, filters: SearchFilters): Promise<ServiceResult> {
    try {
      const validatedUserId = this.validateId(userId, 'User ID')
      
      const customWhere = {
        ...this.buildAuditSearchQuery(filters),
        user_id: validatedUserId,
      }

      const result = await this.paginate(
        prisma.auditLog,
        filters,
        { user: true },
        customWhere
      )

      return this.handleSuccess(result)
    } catch (error) {
      return this.handleError(error, 'AuditService.getUserAuditLogs')
    }
  }

  async getLoginHistory(filters: SearchFilters): Promise<ServiceResult> {
    try {
      const customWhere = {
        ...this.buildAuditSearchQuery(filters),
        action: { in: ['LOGIN', 'LOGOUT', 'LOGIN_FAILED'] },
      }

      const result = await this.paginate(
        prisma.auditLog,
        filters,
        { user: true },
        customWhere
      )

      return this.handleSuccess(result)
    } catch (error) {
      return this.handleError(error, 'AuditService.getLoginHistory')
    }
  }

  async getSystemActivity(timeRange: 'today' | 'week' | 'month' = 'today'): Promise<ServiceResult> {
    try {
      const now = new Date()
      let startDate: Date

      switch (timeRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      }

      const activities = await this.findMany<AuditLog>(
        prisma.auditLog,
        {
          date_time_log: {
            gte: startDate,
            lte: now,
          }
        },
        { user: true },
        { date_time_log: 'desc' }
      )

      const summary = {
        totalActivities: activities.length,
        uniqueUsers: new Set(activities.map(a => a.user_id)).size,
        actionBreakdown: activities.reduce((acc, activity) => {
          acc[activity.action] = (acc[activity.action] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        activities: activities.slice(0, 50)
      }

      return this.handleSuccess(summary)
    } catch (error) {
      return this.handleError(error, 'AuditService.getSystemActivity')
    }
  }

  private buildAuditSearchQuery(filters: SearchFilters) {
    const where: any = {}
    
    if (filters.query) {
      where.OR = [
        { action: { contains: filters.query } },
        { description: { contains: filters.query } },
        { user_account: { is: { username: { contains: filters.query } } } },
        { user_account: { is: { user: { is: { full_name: { contains: filters.query } } } } } },
        { user_account: { is: { user: { is: { account_id: { contains: filters.query } } } } } },
      ]
    }
    
    // Filter by specific action (exact match on stored enum/string)
    if (filters.action) {
      const actions = String(filters.action)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)

      where.action = actions.length > 1 ? { in: actions } : actions[0]
    }
    
    // Filter by user role
    if (filters.role) {
      where.role = filters.role
    }
    
    if (filters.dateFrom || filters.dateTo) {
      where.date_time_log = {}
      if (filters.dateFrom) {
        where.date_time_log.gte = filters.dateFrom
      }
      if (filters.dateTo) {
        where.date_time_log.lte = filters.dateTo
      }
    }
    
    return where
  }
}

export const auditService = new AuditService()