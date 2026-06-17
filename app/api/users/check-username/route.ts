import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import logger from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    logger.apiRequest('POST', '/api/users/check-username')
    
    // Get session for authentication
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      logger.warn('No authentication found for username check')
      return createErrorResponse('No authentication found', 401)
    }

    const body = await request.json()
    const { username } = body

    if (!username || typeof username !== 'string') {
      return createErrorResponse('Username is required', 400)
    }

    const trimmedUsername = username.trim()

    // Validate username format
    if (trimmedUsername.length < 3) {
      return createSuccessResponse({
        available: false,
        message: 'Username must be at least 3 characters long'
      })
    }

    if (trimmedUsername.length > 50) {
      return createSuccessResponse({
        available: false,
        message: 'Username must be less than 50 characters'
      })
    }

    // Check if username contains only allowed characters
    const usernameRegex = /^[a-zA-Z0-9_-]+$/
    if (!usernameRegex.test(trimmedUsername)) {
      return createSuccessResponse({
        available: false,
        message: 'Username can only contain letters, numbers, underscores, and hyphens'
      })
    }

    // Get current user account to check current username
    const currentUserAccount = await prisma.userAccount.findUnique({
      where: {
        id: parseInt(session.user.id),
        is_active: true
      },
      select: {
        username: true
      }
    })

    if (!currentUserAccount) {
      return createErrorResponse('User account not found', 404)
    }

    // Check if username is the same as current username
    if (trimmedUsername === currentUserAccount.username) {
      return createSuccessResponse({
        available: true,
        message: 'This is your current username'
      })
    }

    // Check if username already exists
    const existingUser = await prisma.userAccount.findUnique({
      where: { 
        username: trimmedUsername,
        is_active: true
      }
    })

    if (existingUser) {
      return createSuccessResponse({
        available: false,
        message: 'Username is already taken'
      })
    }

    return createSuccessResponse({
      available: true,
      message: 'Username is available'
    })

  } catch (error) {
    logger.error('Username check error', error instanceof Error ? error : new Error(String(error)))
    return createErrorResponse('Internal server error', 500)
  }
}
