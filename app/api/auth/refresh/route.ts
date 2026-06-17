import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import jwt from 'jsonwebtoken'
import { JWTPayload } from "@/types"
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import logger from "@/lib/logger"

export async function POST(request: Request) {
  try {
    logger.apiRequest('POST', '/api/auth/refresh')
    
    // Try NextAuth session first
    const session = await getServerSession(authOptions)
    
    if (session?.user?.username) {
      // Fetch fresh user data from database
      const userAccount = await prisma.userAccount.findUnique({
        where: {
          username: session.user.username,
          is_active: true
        },
        include: {
          user: true
        }
      })

      if (!userAccount || !userAccount.user) {
        logger.warn('User not found during refresh', { username: session.user.username })
        return createErrorResponse("User not found", 404)
      }

      const responseData = {
        role: userAccount.role,
        name: userAccount.user.full_name,
        username: userAccount.username,
        userType: userAccount.user.user_type
      }

      logger.info('User data refreshed successfully', { username: userAccount.username })
      return createSuccessResponse(responseData)
    }

    // Fallback to JWT token
    const body = await request.json().catch(() => ({}))
    const token = body.token || request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!token) {
      logger.warn('No authentication token provided for refresh')
      return createErrorResponse("Not authenticated", 401)
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload
    const userId = decoded.userId.toString()

    const userAccount = await prisma.userAccount.findUnique({
      where: {
        user_id: parseInt(userId),
        is_active: true
      },
      include: {
        user: true
      }
    })

    if (!userAccount || !userAccount.user) {
      logger.warn('User not found by JWT token', { userId })
      return createErrorResponse("User not found", 404)
    }

    const responseData = {
      role: userAccount.role,
      name: userAccount.user.full_name,
      username: userAccount.username,
      userType: userAccount.user.user_type
    }

    logger.info('User data refreshed via JWT', { username: userAccount.username })
    return createSuccessResponse(responseData)
    
  } catch (error) {
    logger.error("Error refreshing user data", error instanceof Error ? error : new Error(String(error)))
    return createErrorResponse("Internal server error", 500)
  }
}
