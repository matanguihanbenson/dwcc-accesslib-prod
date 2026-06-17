import { NextRequest, NextResponse } from 'next/server'
import { UserRole, UserType } from '@/types'
import { withAuth, createSuccessResponse, getSearchParams, withValidation } from '@/lib/api-utils'
import { userService } from '@/lib/services/user.service'
import { validateCreateUser } from '@/lib/validations'
import { withDuplicatePreventionByBody, withDatabaseDuplicateCheck } from '@/lib/duplicate-prevention'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(
  async (req: NextRequest, session) => {
    const filters = getSearchParams(req)
    const typedFilters = {
      ...filters,
      userType: filters.userType as UserType | undefined
    }
    const result = await userService.getLibraryUsers(typedFilters)
    
    if (!result.success) {
      throw new Error(result.error)
    }
    
    // The result.data contains the paginated response, so we need to return it directly
  const res = NextResponse.json(result.data)
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.headers.set('Pragma', 'no-cache')
  res.headers.set('Expires', '0')
  return res
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)

export const POST = withAuth(
  withDuplicatePreventionByBody(
    async (req: NextRequest, session: any) => {
      const validationHandler = withValidation(
        req,
        validateCreateUser,
        async (req, data: any) => {
          // Database-level duplicate check for account_id and email
          const existing = await prisma.user.findFirst({
            where: {
              OR: [
                { account_id: data.account_id },
                ...(data.email ? [{ email: data.email }] : [])
              ]
            }
          })

          if (existing) {
            if (existing.account_id === data.account_id) {
              return NextResponse.json(
                { error: `ID Number "${data.account_id}" already exists. Please use a different ID Number.` },
                { status: 400 }
              )
            }
            if (existing.email === data.email) {
              return NextResponse.json(
                { error: `Email "${data.email}" is already registered. Please use a different email address.` },
                { status: 400 }
              )
            }
          }

          const result = await userService.createLibraryUser(
            data,
            parseInt(session.user.id),
            session.user.role as UserRole
          )

          if (!result.success) {
            const code = result.code || 'SERVER_ERROR'
            const statusMap: Record<string, number> = {
              VALIDATION_ERROR: 400,
              DUPLICATE_ENTRY: 409,
              NOT_FOUND: 404,
              FORBIDDEN: 403,
            }
            const status = statusMap[code] ?? 500

            return NextResponse.json(
              {
                success: false,
                error: result.error,
                code,
              },
              { status }
            )
          }

          return createSuccessResponse(result.data, result.message, 201)
        }
      )
      
      return await validationHandler()
    },
    {
      ttl: 10000, // 10 seconds prevention window
      keyFields: ['account_id', 'email', 'full_name'] // Key fields for duplicate detection
    }
  ),
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
)