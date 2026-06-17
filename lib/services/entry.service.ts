import { BaseService } from './base.service'
import { AuditService } from './audit.service'
import { prisma } from '@/lib/prisma'
import {
  ServiceResult,
  EntryLog,
  SearchFilters,
  UserRole,
  UserStatus
} from '@/types'
import { AppError } from '@/lib/errors'

export class EntryService extends BaseService {
  async recordEntry(userId: number, rfidCode?: string, purpose?: string, verifiedBy?: number): Promise<ServiceResult<EntryLog>> {
    try {
      const validatedUserId = this.validateId(userId, 'User ID')

      const user = await this.findUnique(
        prisma.user,
        { user_id: validatedUserId },
        null,
        'User not found'
      ) as any

      if (user.status !== UserStatus.ACTIVE) {
        throw new AppError('User account is not active', 'ACCOUNT_INACTIVE', 403)
      }

      const existingActiveEntry = await prisma.entryLog.findFirst({
        where: {
          user_id: validatedUserId,
          exit_time: null,
        },
        orderBy: { entry_time: 'desc' }
      })

      // Shared include clause so the realtime broadcast payload carries the
      // same nested user data (department_ref, program) the REST list endpoint
      // returns. Without this the admin view's optimistic prepend rendered
      // "N/A" for the department, and exit events had no user info at all.
      const userInclude = {
        user: {
          select: {
            user_id: true,
            full_name: true,
            account_id: true,
            user_type: true,
            year_level: true,
            status: true,
            department_id: true,
            department_ref: { select: { name: true } },
            program: { select: { name: true } },
          },
        },
      }

      if (existingActiveEntry) {
        const exitTime = new Date()

        await this.update(
          prisma.entryLog,
          { entry_id: existingActiveEntry.entry_id },
          { exit_time: exitTime }
        )

        // Re-fetch the row with the user relation so the broadcast carries
        // the name/department, allowing the admin realtime toast to show
        // "Cedrick Dimayuga, Jr exited" instead of "User #4".
        const updatedEntry = await prisma.entryLog.findUnique({
          where: { entry_id: existingActiveEntry.entry_id },
          include: userInclude,
        })

        if (verifiedBy) {
          await AuditService.logAction(
            verifiedBy,
            UserRole.STAFF,
            'RECORD_EXIT',
            `Recorded exit for user: ${user.full_name} (${user.account_id})`
          )
        }

        return this.handleSuccess(
          updatedEntry ?? {
            ...existingActiveEntry,
            exit_time: exitTime,
            rfid_code: existingActiveEntry.rfid_code || undefined,
            purpose: existingActiveEntry.purpose || undefined,
            verified_by: existingActiveEntry.verified_by || undefined,
          },
          'Exit recorded successfully'
        )
      } else {
        const entryLog = await this.create<EntryLog>(prisma.entryLog, {
          user_id: validatedUserId,
          entry_time: new Date(),
          rfid_code: rfidCode,
          purpose: purpose,
          verified_by: verifiedBy,
        }, userInclude)

        if (verifiedBy) {
          await AuditService.logAction(
            verifiedBy,
            UserRole.STAFF,
            'RECORD_ENTRY',
            `Recorded entry for user: ${user.full_name} (${user.account_id})`
          )
        }

        return this.handleSuccess(entryLog, 'Entry recorded successfully')
      }
    } catch (error) {
      return this.handleError(error, 'EntryService.recordEntry')
    }
  }

  async recordEntryByRFID(rfidCode: string, purpose?: string, verifiedBy?: number): Promise<ServiceResult<EntryLog>> {
    try {
      const user = await this.findUnique(
        prisma.user,
        { rfid_code: rfidCode },
        null,
        'User not found with this RFID code'
      ) as any

      return await this.recordEntry(user.user_id, rfidCode, purpose, verifiedBy)
    } catch (error) {
      return this.handleError(error, 'EntryService.recordEntryByRFID')
    }
  }

  async getEntryLogs(filters: any): Promise<ServiceResult> {
    try {
      console.log('getEntryLogs called with filters:', filters) // Debug log
      const where = this.buildEntrySearchQuery(filters)
      const limit = filters.limit || 50
      const include_user = filters.include_user === true || filters.include_user === 'true'
      console.log('include_user flag:', include_user) // Debug log
      
      const includeClause = include_user ? {
        user: {
          select: {
            user_id: true,
            full_name: true,
            account_id: true,
            user_type: true,
            year_level: true,
            status: true,
            department_id: true,
            department_ref: {
              select: {
                name: true
              }
            },
            program: {
              select: {
                name: true
              }
            }
          }
        }
      } : {}

      console.log('includeClause:', JSON.stringify(includeClause, null, 2)) // Debug log

      // Get entries with proper ordering (most recent first)
      console.log('About to execute Prisma query with:')
      console.log('- where:', JSON.stringify(where, null, 2))
      console.log('- include:', JSON.stringify(includeClause, null, 2))
      console.log('- limit:', limit)
      
      const logs = await prisma.entryLog.findMany({
        where,
        include: includeClause,
        orderBy: { entry_time: 'desc' },
        take: limit
      })

      console.log('Retrieved logs count:', logs.length) // Debug log
      if (logs.length > 0) {
        console.log('First log:', logs[0]) // Debug log
        console.log('First log user:', logs[0].user) // Debug log
      } else {
        console.log('No logs found with current filters') // Debug log
        console.log('Where clause:', where) // Debug log
        
        // Try to get total count without filters
        const totalLogs = await prisma.entryLog.count()
        console.log('Total logs in database:', totalLogs) // Debug log
      }

      return this.handleSuccess({ logs })
    } catch (error) {
      return this.handleError(error, 'EntryService.getEntryLogs')
    }
  }

  async getEntryLogById(entryId: number): Promise<ServiceResult<EntryLog>> {
    try {
      const validatedId = this.validateId(entryId, 'Entry ID')
      
      const entryLog = await this.findUnique<EntryLog>(
        prisma.entryLog,
        { entry_id: validatedId },
        { user: true },
        'Entry log not found'
      )

      return this.handleSuccess(entryLog)
    } catch (error) {
      return this.handleError(error, 'EntryService.getEntryLogById')
    }
  }

  async getUserEntryLogs(userId: number, filters: SearchFilters): Promise<ServiceResult> {
    try {
      const validatedUserId = this.validateId(userId, 'User ID')
      
      const customWhere = {
        ...this.buildEntrySearchQuery(filters),
        user_id: validatedUserId,
      }

      const result = await this.paginate(
        prisma.entryLog,
        filters,
        { user: true },
        customWhere
      )

      return this.handleSuccess(result)
    } catch (error) {
      return this.handleError(error, 'EntryService.getUserEntryLogs')
    }
  }

  async getTodayEntries(): Promise<ServiceResult<EntryLog[]>> {
    try {
      const today = new Date()
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

      const entries = await this.findMany<EntryLog>(
        prisma.entryLog,
        {
          entry_time: {
            gte: startOfDay,
            lt: endOfDay,
          }
        },
        { user: true },
        { entry_time: 'desc' }
      )

      return this.handleSuccess(entries)
    } catch (error) {
      return this.handleError(error, 'EntryService.getTodayEntries')
    }
  }

  async getActiveEntries(): Promise<ServiceResult<EntryLog[]>> {
    try {
      const activeEntries = await this.findMany<EntryLog>(
        prisma.entryLog,
        { exit_time: null },
        { user: true },
        { entry_time: 'desc' }
      )

      return this.handleSuccess(activeEntries)
    } catch (error) {
      return this.handleError(error, 'EntryService.getActiveEntries')
    }
  }

  async getEntryStatistics(timeRange: 'today' | 'week' | 'month' = 'today'): Promise<ServiceResult> {
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

      const [totalEntries, uniqueUsers, currentlyInside, departmentBreakdown] = await Promise.all([
        prisma.entryLog.count({
          where: {
            entry_time: {
              gte: startDate,
              lte: now,
            }
          }
        }),
        prisma.entryLog.findMany({
          where: {
            entry_time: {
              gte: startDate,
              lte: now,
            }
          },
          select: { user_id: true },
          distinct: ['user_id']
        }),
        prisma.entryLog.count({
          where: { exit_time: null }
        }),
        prisma.entryLog.groupBy({
          by: ['user_id'],
          where: {
            entry_time: {
              gte: startDate,
              lte: now,
            }
          },
          _count: true
        })
      ])

      const userDepartments = await prisma.user.findMany({
        where: {
          user_id: {
            in: departmentBreakdown.map(d => d.user_id)
          }
        },
        select: {
          user_id: true,
          user_type: true,
          department_ref: {
            select: {
              name: true
            }
          }
        }
      })

      const deptStats = userDepartments.reduce((acc, user) => {
        const key = user.department_ref?.name || user.user_type
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const statistics = {
        totalEntries,
        uniqueUsers: uniqueUsers.length,
        currentlyInside,
        departmentBreakdown: deptStats,
        timeRange,
      }

      return this.handleSuccess(statistics)
    } catch (error) {
      return this.handleError(error, 'EntryService.getEntryStatistics')
    }
  }

  async forceExit(entryId: number, processedBy: number, processedByRole: UserRole): Promise<ServiceResult> {
    try {
      const validatedId = this.validateId(entryId, 'Entry ID')

      const entryLog = await this.findUnique<EntryLog>(
        prisma.entryLog,
        { entry_id: validatedId },
        { user: true },
        'Entry log not found'
      )

      if (entryLog.exit_time) {
        throw new AppError('Entry already has an exit time', 'ALREADY_EXITED', 400)
      }

      await this.update(
        prisma.entryLog,
        { entry_id: validatedId },
        { exit_time: new Date() }
      )

      await AuditService.logAction(
        processedBy,
        processedByRole,
        'FORCE_EXIT',
        `Force exit for user: ${entryLog.user?.full_name} (${entryLog.user?.account_id})`
      )

      return this.handleSuccess(null, 'Exit recorded successfully')
    } catch (error) {
      return this.handleError(error, 'EntryService.forceExit')
    }
  }

  private buildEntrySearchQuery(filters: any) {
    const where: any = {}
    
    // Handle search query (backward compatibility and new search parameter)
    const searchTerm = filters.search || filters.query
    if (searchTerm) {
      where.OR = [
        { user: { full_name: { contains: searchTerm } } },
        { user: { account_id: { contains: searchTerm } } },
        { user: { department_ref: { name: { contains: searchTerm } } } },
        { rfid_code: { contains: searchTerm } },
        { purpose: { contains: searchTerm } },
      ]
    }
    
    // User type filter
    if (filters.userType) {
      where.user = { user_type: filters.userType }
    }
    
    // Department filter
    if (filters.department) {
      where.user = {
        ...where.user,
        department_ref: {
          name: { contains: filters.department }
        }
      }
    }

    // Office filter by office_id
    if (filters.office_id) {
      const officeId = typeof filters.office_id === 'string'
        ? parseInt(filters.office_id)
        : filters.office_id

      if (!isNaN(officeId)) {
        where.user = {
          ...where.user,
          office_id: officeId
        }
      }
    }

    if (filters.grade_level_id) {
      const gradeLevelId = typeof filters.grade_level_id === 'string'
        ? parseInt(filters.grade_level_id)
        : filters.grade_level_id

      if (!isNaN(gradeLevelId)) {
        where.user = {
          ...where.user,
          grade_level_id: gradeLevelId
        }
      }
    }
    
    // Year level filter
    if (filters.year_level || filters.yearLevel) {
      const yearLevel = filters.year_level || filters.yearLevel
      where.user = {
        ...where.user,
        year_level: { contains: yearLevel }
      }
    }
    
    // Date range filters
    if (filters.date_from || filters.date_to || filters.dateFrom || filters.dateTo) {
      where.entry_time = {}
      
      const dateFrom = filters.date_from || filters.dateFrom
      const dateTo = filters.date_to || filters.dateTo
      
      if (dateFrom) {
        where.entry_time.gte = new Date(dateFrom)
      }
      if (dateTo) {
        const endDate = new Date(dateTo)
        endDate.setHours(23, 59, 59, 999) // Include the entire day
        where.entry_time.lte = endDate
      }
    }
    
    // Status filter (inside/exited)
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'inside') {
        where.exit_time = null
      } else if (filters.status === 'exited') {
        where.exit_time = { not: null }
      }
    }
    
    return where
  }
}

export const entryService = new EntryService()
