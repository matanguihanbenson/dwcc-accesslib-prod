import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, getSearchParams, withValidation } from '@/lib/api-utils'
import { broadcastEntryLog } from '@/lib/realtime'
import { entryService } from '@/lib/services/entry.service'

export const GET = withAuth(
  async (req: NextRequest, session) => {
    const filters = getSearchParams(req)
    
    // Enhanced filtering for admin users
    const enhancedFilters = {
      ...filters,
      search: filters.search || undefined,
      department: filters.department || undefined,
      year_level: filters.year_level || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      status: filters.status || undefined, // 'inside', 'exited', or 'all'
      limit: typeof filters.limit === 'string' ? parseInt(filters.limit) : (filters.limit || 50),
      include_user: filters.include_user
    }
    
    const result = await entryService.getEntryLogs(enhancedFilters)
    
    if (!result.success) {
      throw new Error(result.error)
    }
    
    return createSuccessResponse(result.data)
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)

export const POST = withAuth(
  async (req: NextRequest, session) => {
    return withValidation(
      req,
      (data) => {
        const errors: string[] = []
        
        if (!data.user_id && !data.rfid_code) {
          errors.push('Either user_id or rfid_code is required')
        }
        
        if (data.user_id && isNaN(parseInt(data.user_id))) {
          errors.push('Invalid User ID')
        }
        
        return { isValid: errors.length === 0, errors }
      },
      async (req, data) => {
        const typedData = data as any // Cast to any for property access
        
        // Validate session.user.id before parsing
        if (!session.user.id || isNaN(parseInt(session.user.id))) {
          return NextResponse.json(
            { success: false, error: 'Invalid session user ID', code: 'INVALID_SESSION' },
            { status: 500 }
          )
        }

        const verifiedBy = parseInt(session.user.id)
        let result
        
        try {
          if (typedData.rfid_code) {
            result = await entryService.recordEntryByRFID(
              typedData.rfid_code,
              typedData.purpose || 'General',
              verifiedBy
            )
          } else {
            result = await entryService.recordEntry(
              parseInt(typedData.user_id),
              typedData.rfid_code,
              typedData.purpose || 'General',
              verifiedBy
            )
          }
          
        } catch (error) {
          return NextResponse.json(
            { success: false, error: 'Service error: ' + String(error), code: 'SERVICE_ERROR' },
            { status: 500 }
          )
        }
        
        if (!result.success) {
          // Map service error codes to HTTP status
          const code = result.code || 'SERVER_ERROR'
          let status = 500
          switch (code) {
            case 'VALIDATION_ERROR':
              status = 400; break
            case 'NOT_FOUND':
              status = 404; break
            case 'ACCOUNT_INACTIVE':
              status = 403; break
            default:
              status = 500
          }
          return NextResponse.json(
            { success: false, error: result.error, code },
            { status }
          )
        }
        
        // Fire realtime event (omit large nested objects if needed)
        try {
          broadcastEntryLog({
            ...result.data,
            message: result.message,
            ts: Date.now()
          })
        } catch (e) {
        }
        return createSuccessResponse(result.data, result.message, 201)
      }
    )()
  },
  [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF]
)
