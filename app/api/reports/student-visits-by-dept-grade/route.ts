import { NextRequest } from 'next/server'
import { UserRole, Campus } from '@/types'
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

/**
 * Auto-scope STAFF to their own campus. ADMIN / SUPER_ADMIN
 * can pass an explicit `campus` query param.
 */
async function resolveReportCampus(
  session: any,
  queryCampus: string | null
): Promise<Campus | null> {
  if (session?.user?.role === UserRole.STAFF) {
    const accountId = parseInt(session.user.id || '0')
    if (!isNaN(accountId) && accountId > 0) {
      const account = await prisma.userAccount.findUnique({
        where: { id: accountId },
        select: { campus: true }
      })
      if (account?.campus) return account.campus
    }
  }
  if (queryCampus === Campus.COLLEGE || queryCampus === Campus.BASIC_EDUCATION) {
    return queryCampus
  }
  return null
}

export const GET = withAuth(
  async (req: NextRequest, session) => {
    try {
      const params = req.nextUrl.searchParams
      const dateFrom = params.get('date_from')
      const dateTo = params.get('date_to')
      const queryCampus = params.get('campus')
      const rawEntrance = params.get('entrance_id')

      if (!dateFrom || !dateTo) {
        return createErrorResponse('date_from and date_to are required', 400)
      }

      const fromParts = dateFrom.split('-').map(Number)
      const toParts = dateTo.split('-').map(Number)
      const startDate = new Date(fromParts[0], fromParts[1] - 1, fromParts[2], 0, 0, 0, 0)
      const endDate = new Date(toParts[0], toParts[1] - 1, toParts[2], 23, 59, 59, 999)

      // Auto-scope by campus
      const effectiveCampus = await resolveReportCampus(session, queryCampus)
      const campusWhere = effectiveCampus ? { campus: effectiveCampus } : {}

      // Parse entrance_id filter (supports single number, numeric string,
      // or comma-separated list of numbers — same as entrance-exit report).
      const entranceIds: number[] = (() => {
        if (!rawEntrance) return []
        const list = String(rawEntrance)
          .split(',')
          .map((s) => parseInt(s.trim()))
          .filter((n) => Number.isFinite(n) && n > 0)
        return Array.from(new Set(list))
      })()

      // Use snapshot fields from the entrylog row so
      // historical reports reflect the user as they were
      // at entry time, not their current profile.
      const logs = await prisma.entryLog.findMany({
        where: {
          ...campusWhere,
          ...(entranceIds.length > 0
            ? { entrance_id: { in: entranceIds } }
            : {}),
          entry_time: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          user_department_id: true,
          user_department_name: true,
          user_program_id: true,
          user_program_name: true,
          user_grade_level_id: true,
          user_grade_level_name: true,
          user_education_level: true,
          user_user_type: true,
        },
        orderBy: { entry_time: 'asc' },
      })

      const deptCounts = new Map<string, { department_id: number | null, name: string, code: string, count: number }>()
      const gradeCounts = new Map<string, { grade_level_id: number | null, name: string, education_level: string, count: number }>()

      for (const log of logs) {
        // Only count students
        if (log.user_user_type !== 'STUDENT') continue

        // Department grouping: use program's department name or direct department name
        const deptName = log.user_department_name
        const deptId = log.user_department_id
        if (deptName) {
          const key = deptName
          const prev = deptCounts.get(key)
          if (prev) {
            prev.count += 1
          } else {
            deptCounts.set(key, { department_id: deptId, name: deptName, code: deptName, count: 1 })
          }
        }

        // Grade level grouping
        const gradeName = log.user_grade_level_name
        const gradeId = log.user_grade_level_id
        const eduLevel = log.user_education_level
        if (gradeName) {
          const key = gradeName
          const prev = gradeCounts.get(key)
          if (prev) {
            prev.count += 1
          } else {
            gradeCounts.set(key, { grade_level_id: gradeId, name: gradeName, education_level: String(eduLevel || ''), count: 1 })
          }
        }
      }

      const byDepartment = Array.from(deptCounts.values()).sort((a, b) => b.count - a.count)
      const byGradeLevel = Array.from(gradeCounts.values()).sort((a, b) => b.count - a.count)
      const totalVisits = logs.filter(l => l.user_user_type === 'STUDENT').length

      return createSuccessResponse({
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        totals: { totalVisits },
        byDepartment,
        byGradeLevel,
      })
    } catch (error) {
      return createErrorResponse('Failed to fetch student visits by department and grade level', 500)
    }
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
