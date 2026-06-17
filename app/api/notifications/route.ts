import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    // Try NextAuth token first, then session
    let userAccountId: string | null = null
    
    const token = await getToken({ req })
    if (token?.id) {
      userAccountId = token.id as string
    } else {
      // Try session as fallback
      const session = await getServerSession(authOptions)
      if (session?.user?.id) {
        userAccountId = session.user.id
      }
    }
    
    if (!userAccountId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get the actual User.user_id from UserAccount
    const userAccount = await prisma.userAccount.findUnique({
      where: { id: parseInt(userAccountId) },
      select: { user_id: true }
    })

    if (!userAccount) {
      return NextResponse.json(
        { error: 'User account not found' },
        { status: 404 }
      )
    }

    const url = new URL(req.url)
    const unreadOnly = url.searchParams.get('unread') === 'true'
    const limit = parseInt(url.searchParams.get('limit') || '10')

    // Get user's notifications using User.user_id
    const whereClause: any = {
      user_id: userAccount.user_id
    }
    if (unreadOnly) {
      whereClause.read_at = null
    }
    
    const notifications = await prisma.notificationLog.findMany({
      where: whereClause,
      orderBy: {
        created_at: 'desc'
      },
      take: limit
    })

    // Get unread count
    const unreadCount = await prisma.notificationLog.count({
      where: {
        user_id: userAccount.user_id,
        read_at: null
      }
    })

    return NextResponse.json({
      notifications,
      unreadCount
    })

  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    // Try NextAuth token first, then session
    let userAccountId: string | null = null
    
    const token = await getToken({ req })
    if (token?.id) {
      userAccountId = token.id as string
    } else {
      // Try session as fallback
      const session = await getServerSession(authOptions)
      if (session?.user?.id) {
        userAccountId = session.user.id
      }
    }
    
    if (!userAccountId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get the actual User.user_id from UserAccount
    const userAccount = await prisma.userAccount.findUnique({
      where: { id: parseInt(userAccountId) },
      select: { user_id: true }
    })

    if (!userAccount) {
      return NextResponse.json(
        { error: 'User account not found' },
        { status: 404 }
      )
    }

    const body = await req.json()
    const { notificationIds, markAllAsRead } = body

    if (markAllAsRead) {
      // Mark all notifications as read
      await prisma.notificationLog.updateMany({
        where: {
          user_id: userAccount.user_id,
          read_at: null
        },
        data: {
          read_at: new Date()
        }
      })
    } else if (notificationIds && Array.isArray(notificationIds)) {
      // Mark specific notifications as read
      await prisma.notificationLog.updateMany({
        where: {
          notification_id: { in: notificationIds },
          user_id: userAccount.user_id
        },
        data: {
          read_at: new Date()
        }
      })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error updating notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
