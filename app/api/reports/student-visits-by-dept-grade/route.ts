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

      const logs = await prisma.entryLog.findMany({
        where: {
          ...campusWhere,
          entry_time: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          user: {
            select: {
              department_id: true,
              program_id: true,
              grade_level_id: true,
              department_ref: { select: { department_id: true, name: true, code: true } },
              program: { select: { program_id: true, name: true, code: true, department: { select: { department_id: true, name: true, code: true } } } },
              grade_level: { select: { grade_level_id: true, name: true, education_level: true } },
            },
          },
        },
        orderBy: { entry_time: 'asc' },
      })

      const deptCounts = new Map<string, { department_id: number, name: string, code: string, count: number }>()
      const gradeCounts = new Map<string, { grade_level_id: number, name: string, education_level: string, count: number }>()

      for (const log of logs) {
        const u = log.user
        if (u) {
          const deptInfo = u.program?.department || u.department_ref || null
          if (deptInfo) {
            const key = deptInfo.code || `dept_${deptInfo.department_id}`
            const prev = deptCounts.get(key)
            if (prev) {
              prev.count += 1
            } else {
              deptCounts.set(key, { department_id: deptInfo.department_id, name: deptInfo.name, code: deptInfo.code, count: 1 })
            }
          }

          const gradeInfo = u.grade_level || null
          if (gradeInfo) {
            const key = (gradeInfo as any).code || `grade_${gradeInfo.grade_level_id}`
            const prev = gradeCounts.get(key)
            if (prev) {
              prev.count += 1
            } else {
              gradeCounts.set(key, { grade_level_id: gradeInfo.grade_level_id, name: gradeInfo.name, education_level: String(gradeInfo.education_level), count: 1 })
            }
          }
        }
      }

      const byDepartment = Array.from(deptCounts.values()).sort((a, b) => b.count - a.count)
      const byGradeLevel = Array.from(gradeCounts.values()).sort((a, b) => b.count - a.count)
      const totalVisits = logs.length

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

