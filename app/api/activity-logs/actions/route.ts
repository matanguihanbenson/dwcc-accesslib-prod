import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get unique actions from AuditLog table
    const uniqueActions = await prisma.auditLog.findMany({
      select: {
        action: true
      },
      distinct: ['action'],
      orderBy: {
        action: 'asc'
      }
    })

    const actions = uniqueActions.map(log => log.action).filter(Boolean)

    return NextResponse.json({
      success: true,
      actions
    })

  } catch (error) {
    console.error("Error fetching unique actions:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
