import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AuditService } from "@/lib/services/audit.service"
import { UserRole } from "@/types"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication and authorization
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // SUPER_ADMIN, ADMIN, and STAFF can toggle user status
    // (STAFF has the same library-user management
    // permissions as ADMIN on the UI side).
    if (
      session.user.role !== "SUPER_ADMIN" &&
      session.user.role !== "ADMIN" &&
      session.user.role !== "STAFF"
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const resolvedParams = await params
    const userId = parseInt(resolvedParams.id)
    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 })
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { user_id: userId }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if user is archived
    if (user.status === "ARCHIVED") {
      return NextResponse.json({ error: "Cannot modify archived user" }, { status: 400 })
    }

    // Toggle status
    const newStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    
    // Update user status
    const updatedUser = await prisma.user.update({
      where: { user_id: userId },
      data: { status: newStatus }
    })

    // Log the audit activity
    const currentUserAccount = await prisma.userAccount.findUnique({
      where: { username: session.user.username },
      include: { user: true }
    })

    if (currentUserAccount) {
      await AuditService.logUser(
        currentUserAccount.id,
        currentUserAccount.role as UserRole,
        newStatus === "ACTIVE" ? "USER_ACTIVATE" : "USER_DEACTIVATE",
        `User ${user.full_name} (ID: ${user.user_id}) status changed from ${user.status} to ${newStatus}`,
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        request.headers.get('user-agent') || 'unknown'
      )
    }

    const message = `User ${newStatus.toLowerCase()} successfully`

    return NextResponse.json({
      success: true,
      message,
      data: {
        message,
        user: {
          id: updatedUser.user_id,
          status: updatedUser.status,
        },
      },
    })

  } catch (error) {
    console.error("Error toggling user status:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
