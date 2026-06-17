import { NextRequest, NextResponse } from 'next/server'
import { UserRole, UserType } from '@/types'
import { withAuth, createSuccessResponse, getSearchParams, withValidation } from '@/lib/api-utils'
import { userService } from '@/lib/services/user.service'
import { validateCreateUserAccount } from '@/lib/validations'

export const GET = withAuth(
  async (req: NextRequest, session) => {
    const filters = getSearchParams(req)
    const typedFilters = {
      ...filters,
      userType: filters.userType as UserType | undefined
    }
    const result = await userService.getUserAccounts(typedFilters)
    
    if (!result.success) {
      throw new Error(result.error)
    }
    
  const res = createSuccessResponse(result.data)
  // Force no-store to prevent edge/browser caching
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.headers.set('Pragma', 'no-cache')
  res.headers.set('Expires', '0')
  return res
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
)

export const POST = withAuth(
  async (req: NextRequest, session) => {
    const validationHandler = withValidation(
      req,
      validateCreateUserAccount,
      async (req, data) => {
        const result = await userService.createUserAccount(
          data as any,
          parseInt(session.user.id),
          session.user.role as UserRole
        )
        
        if (!result.success) {
          throw new Error(result.error)
        }
        
  const res = createSuccessResponse(result.data, result.message, 201)
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  return res
      }
    )
    return validationHandler()
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN]
)
