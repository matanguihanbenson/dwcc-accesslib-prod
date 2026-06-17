import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { auditService } from "@/lib/services/audit.service"
import { UserRole, UserType, SearchFilters } from "@/types"
import { getSearchParams } from "@/lib/api-utils"

export async function GET(request: NextRequest) {
  try {
    // Check authentication and authorization
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = session.user.role as UserRole
    const userId = parseInt(session.user.id)

    // All authenticated users can access activity logs (with role-based filtering)
    if (!userRole) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get query parameters using the utility function
    const searchParams = getSearchParams(request)
    
    // Cast userType and role to the correct types for SearchFilters
    const filters: SearchFilters = {
      ...searchParams,
      userType: searchParams.userType as UserType | undefined,
      role: searchParams.role as UserRole | undefined
    }

    // Debug: log incoming search params and derived filters
    console.log('ActivityLogs API searchParams:', JSON.stringify(searchParams))
    console.log('ActivityLogs API filters:', JSON.stringify(filters))

    // Use the enhanced audit service with role-based filtering
    const result = await auditService.getAuditLogs(filters, userRole, userId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Transform the data to match the frontend interface
    const transformedLogs = (result.data?.data || []).map((log: any) => ({
      id: log.event_id,
      user_id: log.user_account_id,
      action: log.action, // Using action column for display
      details: log.description, // Using description for detailed view
      created_at: log.date_time_log,
      ip_address: log.ip_address,
      user_agent: log.user_agent,
      user: log.user_account?.user ? {
        full_name: log.user_account.user.full_name,
        account_id: log.user_account.user.account_id,
        role: log.role, // Role from audit log
        user_type: log.user_account.user.user_type,
        email: log.user_account.user.email,
        status: log.user_account.user.status
      } : null
    }))

    return NextResponse.json({
      success: true,
      logs: transformedLogs,
      pagination: result.data?.pagination || {}
    })

  } catch (error) {
    console.error("Error fetching activity logs:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
