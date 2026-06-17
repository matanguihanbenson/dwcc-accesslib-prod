import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateAccountId } from '@/lib/utils'
import { UserType } from '@/types'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userType = searchParams.get('userType') as UserType
    const year = searchParams.get('year') || ''

    if (!userType) {
      return NextResponse.json({ error: "User type is required" }, { status: 400 })
    }

    // Generate account ID
    const accountId = generateAccountId(userType, year)

    return NextResponse.json({
      success: true,
      accountId
    })

  } catch (error) {
    console.error("Error generating account ID:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

