import { BaseService } from './base.service'
import { AuditService } from './audit.service'
import { prisma } from '@/lib/prisma'
import {
  ServiceResult,
  EntryLog,
  SearchFilters,
  UserRole,
  UserStatus,
  Campus
} from '@/types'
import { AppError } from '@/lib/errors'

export class EntryService extends BaseService {
  /**
   * Resolve the campus of the staff account that is performing the
   * verification. Returns the staff's CURRENT designation so each
   * entry is stamped with the campus the staff was assigned to at
   * the moment of the entry. Falls back to COLLEGE for super admins
   * (who have no campus) or when the staff row is missing.
   */
  private async resolveVerifierCampus(verifiedBy: number | undefined): Promise<Campus> {
    if (!verifiedBy) return Campus.COLLEGE
    try {
      const account = await prisma.userAccount.findUnique({
        where: { id: verifiedBy },
        select: { campus: true, role: true }
      })
      // ADMIN / SUPER_ADMIN have no campus; default to COLLEGE so a
      // super-admin override still produces a sensible value.
      if (!account || !account.campus) return Campus.COLLEGE
      return account.campus
    } catch {
      return Campus.COLLEGE
    }
  }

  async recordEntry(userId: number, rfidCode?: string, purpose?: string, verifiedBy?: number, entranceId?: number | null): Promise<ServiceResult<EntryLog>> {
    try {
      const validatedUserId = this.validateId(userId, 'User ID')

      // Fetch the user *with* the lookup-table relations so
      // we can snapshot the denormalised name columns
      // (department / program / grade level) at write time.
      // Without this we'd be re-fetching the lookups on
      // every report, and a renamed lookup would still
      // shift historical data.
      const user = await this.findUnique(
        prisma.user,
        { user_id: validatedUserId },
        {
          department_ref: { select: { name: true } },
          program: { select: { name: true } },
          grade_level: { select: { name: true, code: true } }
        },
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
      //
      // Also includes the `entrance` relation so the live broadcast
      // payload already carries the entrance name (the SSE handler
      // just relays the payload as-is). The staff view renders
      // the entrance on every recent-entry card.
      //
      // Every field of `LibraryUser` that is required (not optional)
      // must be selected here -- otherwise the inferred Prisma return
      // type won't match `EntryLog.user` and `handleSuccess<EntryLog>`
      // will fail to compile.
      const entryInclude = {
        user: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            account_id: true,
            full_name: true,
            user_type: true,
            year_level: true,
            status: true,
            department_id: true,
            created_at: true,
            updated_at: true,
            department_ref: { select: { name: true } },
            program: { select: { name: true } },
            // Basic-Education students don't have a
            // `year_level` string — their "year" lives on
            // `grade_level_id` and the human-readable name
            // is on the joined `grade_level` row. Pull the
            // name so the realtime card + optimistic
            // prepend render "Grade 5" instead of "N/A" for
            // those users. Falls back to `year_level` for
            // college students / staff who have no
            // `grade_level_id`.
            grade_level: {
              select: { grade_level_id: true, name: true, code: true }
            },
            section: { select: { section_id: true, name: true } },
            strand: { select: { strand_id: true, name: true } }
          },
        },
        entrance: { select: { entrance_id: true, name: true, campus: true } },
      }

      if (existingActiveEntry) {
        const exitTime = new Date()

        await this.update(
          prisma.entryLog,
          { entry_id: existingActiveEntry.entry_id },
          { exit_time: exitTime }
        )

        const updatedEntry = await prisma.entryLog.findUnique({
          where: { entry_id: existingActiveEntry.entry_id },
          include: entryInclude,
        })

        if (verifiedBy) {
          await AuditService.logAction(
            verifiedBy,
            UserRole.STAFF,
            'RECORD_EXIT',
            `Recorded exit for user: ${user.full_name} (${user.account_id})`
          )
        }

        // Build the value we want to return. We cast the
        // Prisma-inferred row to `EntryLog` so optional/nullable
        // field differences (e.g. Prisma returns `string | null`
        // for `String?` columns while the service contract uses
        // the same shape) don't break the call to
        // `handleSuccess<EntryLog>`.
        const result: EntryLog = updatedEntry
          ? (updatedEntry as unknown as EntryLog)
          : ({ ...(existingActiveEntry as unknown as EntryLog), exit_time: exitTime })

        return this.handleSuccess<EntryLog>(result, 'Exit recorded successfully')
      } else {
        const verifierCampus = await this.resolveVerifierCampus(verifiedBy)

        // Snapshot the user attributes that can change
        // over time. Without this, a "last year" report
        // would show the user's CURRENT year level /
        // program / department, not the state at the
        // moment of the entry. Same pattern the row
        // already uses for `campus`, `entrance_id`, and
        // `purpose` -- immutable per-entry, which is why
        // reports from last year still read them correctly.
        const userSnapshot = {
          user_year_level:       user.year_level ?? null,
          user_grade_level_id:   user.grade_level_id ?? null,
          user_program_id:       user.program_id ?? null,
          user_department_id:    user.department_id ?? null,
          user_office_id:        user.office_id ?? null,
          user_user_type:        user.user_type,
          user_education_level:  ['KINDERGARTEN','ELEMENTARY','JUNIOR_HIGH','SENIOR_HIGH','COLLEGE','GRADUATE_SCHOOL'].includes(user.education_level as string) ? user.education_level : null,
          user_full_name:        user.full_name ?? null,
          user_department_name:  user.department_ref?.name ?? null,
          user_program_name:     user.program?.name ?? null,
          user_grade_level_name: user.grade_level?.name ?? null,
          user_section_id:       user.section_id ?? null,
          user_section_name:     (user as any).section?.name ?? null,
          user_strand_id:        user.strand_id ?? null,
          user_strand_name:      (user as any).strand?.name ?? null
        }

        const entryLog = await this.create<EntryLog>(prisma.entryLog, {
          user_id: validatedUserId,
          entry_time: new Date(),
          rfid_code: rfidCode,
          purpose: purpose,
          verified_by: verifiedBy,
          campus: verifierCampus,
          // Stamped at write time so the row records which
          // entrance the staff was operating from. Falls
          // back to null when no entrance is selected, which
          // is safe because the column is nullable.
          entrance_id: entranceId ?? null,
          ...userSnapshot
        }, entryInclude)

        if (verifiedBy) {
          await AuditService.logAction(
            verifiedBy,
            UserRole.STAFF,
            'RECORD_ENTRY',
            `Recorded entry for user: ${user.full_name} (${user.account_id}) on campus ${verifierCampus}`
          )
        }

        return this.handleSuccess(entryLog, 'Entry recorded successfully')
      }
    } catch (error) {
      return this.handleError(error, 'EntryService.recordEntry')
    }
  }

  async recordEntryByRFID(rfidCode: string, purpose?: string, verifiedBy?: number, entranceId?: number | null): Promise<ServiceResult<EntryLog>> {
    try {
      // Same snapshot relations as `recordEntry` so the
      // RFID-driven path is consistent.
      const user = await this.findUnique(
        prisma.user,
        { rfid_code: rfidCode },
        {
          department_ref: { select: { name: true } },
          program: { select: { name: true } },
          grade_level: { select: { name: true, code: true } }
        },
        'User not found with this RFID code'
      ) as any

      return await this.recordEntry(user.user_id, rfidCode, purpose, verifiedBy, entranceId)
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
      
      const includeClause: any = include_user ? {
        user: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            account_id: true,
            full_name: true,
            user_type: true,
            year_level: true,
            status: true,
            department_id: true,
            created_at: true,
            updated_at: true,
            department_ref: {
              select: {
                name: true
              }
            },
            program: {
              select: {
                name: true
              }
            },
            // Basic-Education students don't have a
            // `year_level` string — their "year" lives on
            // `grade_level_id` and the human-readable name
            // is on the joined `grade_level` row. Pull the
            // name so the realtime table can render "Grade
            // 5" instead of "N/A" for those users. Falls
            // back to `year_level` for college students /
            // staff who have no `grade_level_id`.
            grade_level: {
              select: {
                grade_level_id: true,
                name: true,
                code: true
              }
            }
          }
        }
      } : {}
      // The `entrance` relation is small (just id + name +
      // campus) and the staff view renders the entrance
      // name on every recent-entry card, so we always
      // include it regardless of `include_user`. Cheap
      // because it's a left-join on the indexed FK.
      includeClause.entrance = {
        select: { entrance_id: true, name: true, campus: true }
      }
      // `campus` is a top-level column on entrylog so it is always
      // available regardless of the include above.

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

    // Filter by grade level name (preferred when the UI shows names instead of
    // ids). Mirrors the department filter pattern.
    if (filters.grade_level_name) {
      where.user = {
        ...where.user,
        grade_level: {
          name: { contains: filters.grade_level_name }
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
    
    // Campus filter — column directly on entrylog, no relation join needed.
    if (filters.campus) {
      where.campus = filters.campus
    }

    // Entrance filter — column directly on entrylog, no relation join needed.
    // Accept either a number (or numeric string) for a single
    // entrance, or a list (e.g. "1,2,3") for a multi-select. The
    // caller decides which by how it builds the query.
    if (filters.entrance_id !== undefined && filters.entrance_id !== null && filters.entrance_id !== '') {
      if (Array.isArray(filters.entrance_id)) {
        const ids = filters.entrance_id
          .map((v: any) => parseInt(String(v)))
          .filter((n: number) => Number.isFinite(n) && n > 0)
        if (ids.length === 1) where.entrance_id = ids[0]
        else if (ids.length > 1) where.entrance_id = { in: ids }
      } else {
        const n = parseInt(String(filters.entrance_id))
        if (Number.isFinite(n) && n > 0) {
          where.entrance_id = n
        }
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
