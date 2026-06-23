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

    // SUPER_ADMIN, ADMIN, and STAFF can archive/unarchive
    // library users (STAFF has the same library-user
    // management permissions as ADMIN on the UI side).
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

    const body = await request.json()
    const { archive } = body

    if (typeof archive !== "boolean") {
      return NextResponse.json({ error: "Invalid archive value" }, { status: 400 })
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { user_id: userId }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Determine new status
    const newStatus = archive ? "ARCHIVED" : "ACTIVE"
    
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

    if (currentUserAccount?.user) {
      await AuditService.logAction(
        currentUserAccount.id,
        currentUserAccount.role as UserRole,
        archive ? "USER_ARCHIVED" : "USER_RESTORED",
        archive 
          ? `User archived - access disabled and record locked for ${user.full_name} (#${user.user_id})` 
          : `User unarchived - access restored and record unlocked for ${user.full_name} (#${user.user_id})`
      )
    }

    return NextResponse.json({
      success: true,
      message: `User ${archive ? "archived" : "unarchived"} successfully`,
      user: {
        id: updatedUser.user_id,
        status: updatedUser.status,
        is_archived: updatedUser.status === "ARCHIVED"
      }
    })

  } catch (error) {
    console.error("Error archiving/unarchiving user:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
