import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { JWTPayload, UserRole } from '@/types'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { AuditService } from '@/lib/services/audit.service'
import logger from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    logger.apiRequest('GET', '/api/users/profile')
    
    // Try to get session first (NextAuth)
    const session = await getServerSession(authOptions)
    
    if (session?.user?.id) {
      try {
        // Use session-based lookup by account ID
        const userAccount = await prisma.userAccount.findUnique({
          where: {
            id: parseInt(session.user.id),
            is_active: true
          },
          include: {
            user: {
              select: {
                full_name: true,
                email: true,
                contact_number: true,
                user_type: true,
                account_id: true,
              }
            }
          }
        })

        if (userAccount) {
          const userData = {
            id: userAccount.username,
            account_id: userAccount.user.account_id,
            name: userAccount.user.full_name,
            email: userAccount.user.email,
            contact_number: userAccount.user.contact_number,
            role: userAccount.role,
            avatar: null,
          }
          
          logger.info('Profile fetched successfully via session', { username: userAccount.username })
          return createSuccessResponse(userData)
        }
      } catch (dbError) {
        logger.error('Database error during session lookup', dbError instanceof Error ? dbError : new Error(String(dbError)))
      }
    }

    // If no session, try JWT token from cookies
    const token = request.cookies.get('token')?.value
    
    if (!token) {
      logger.warn('No authentication found for profile request')
      return createErrorResponse('No authentication found', 401)
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload
      const userId = decoded.userId

      // Fetch user data from database using JWT
      const userAccount = await prisma.userAccount.findUnique({
        where: { id: userId, is_active: true },
        include: {
          user: {
            select: {
              full_name: true,
              email: true,
              contact_number: true,
              user_type: true,
              account_id: true,
            }
          }
        }
      })

      if (!userAccount) {
        logger.warn('User not found for profile request', { userId: userId.toString() })
        return createErrorResponse('User not found', 404)
      }

      const userData = {
        id: userAccount.username,
        account_id: userAccount.user.account_id,
        name: userAccount.user.full_name,
        email: userAccount.user.email,
        contact_number: userAccount.user.contact_number,
        role: userAccount.role,
        avatar: null,
      }
      
      logger.info('Profile fetched successfully via JWT', { username: userAccount.username })
      return createSuccessResponse(userData)
      
    } catch (jwtError) {
      logger.warn('JWT verification failed for profile request', { error: jwtError instanceof Error ? jwtError.message : String(jwtError) })
      return createErrorResponse('Invalid authentication token', 401)
    }
  } catch (error) {
    logger.error('Profile fetch error', error instanceof Error ? error : new Error(String(error)))
    return createErrorResponse('Internal server error', 500)
  }
}

export async function PUT(request: NextRequest) {
  try {
    logger.apiRequest('PUT', '/api/users/profile')
    
    // Get session for authentication
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      logger.warn('No authentication found for profile update')
      return createErrorResponse('No authentication found', 401)
    }

    const body = await request.json()
    const { full_name, email, contact_number, username } = body

    // Validate inputs
    if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
      return createErrorResponse('Full name must be at least 2 characters long', 400)
    }

    if (email && typeof email === 'string' && email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email.trim())) {
        return createErrorResponse('Invalid email format', 400)
      }
    }

    // Validate username if provided
    if (username && typeof username === 'string' && username.trim() !== '') {
      const trimmedUsername = username.trim()
      if (trimmedUsername.length < 3) {
        return createErrorResponse('Username must be at least 3 characters long', 400)
      }
      if (trimmedUsername.length > 50) {
        return createErrorResponse('Username must be less than 50 characters', 400)
      }
      const usernameRegex = /^[a-zA-Z0-9_-]+$/
      if (!usernameRegex.test(trimmedUsername)) {
        return createErrorResponse('Username can only contain letters, numbers, underscores, and hyphens', 400)
      }
    }

    // Get current user account
    const userAccount = await prisma.userAccount.findUnique({
      where: {
        id: parseInt(session.user.id),
        is_active: true
      },
      include: {
        user: true
      }
    })

    if (!userAccount) {
      logger.warn('User account not found for profile update', { accountId: session.user.id })
      return createErrorResponse('User account not found', 404)
    }

    // Track changes for audit log
    const changes: string[] = []
    const updateData: any = {}
    const accountUpdateData: any = {}

    if (full_name.trim() !== userAccount.user.full_name) {
      changes.push(`name: "${userAccount.user.full_name}" → "${full_name.trim()}"`)
      updateData.full_name = full_name.trim()
    }

    const newEmail = email?.trim() || null
    if (newEmail !== userAccount.user.email) {
      changes.push(`email: "${userAccount.user.email || 'none'}" → "${newEmail || 'none'}"`)
      updateData.email = newEmail
    }

    const newContactNumber = contact_number?.trim() || null
    if (newContactNumber !== userAccount.user.contact_number) {
      changes.push(`contact: "${userAccount.user.contact_number || 'none'}" → "${newContactNumber || 'none'}"`)
      updateData.contact_number = newContactNumber
    }

    // Handle username update
    const newUsername = username?.trim() || null
    if (newUsername && newUsername !== userAccount.username) {
      // Check if username already exists
      const existingUser = await prisma.userAccount.findUnique({
        where: { 
          username: newUsername,
          is_active: true
        }
      })

      if (existingUser) {
        return createErrorResponse('Username is already taken', 400)
      }

      changes.push(`username: "${userAccount.username}" → "${newUsername}"`)
      accountUpdateData.username = newUsername
    }

    // Only update if there are changes
    if (changes.length === 0) {
      return createSuccessResponse({ message: 'No changes detected' })
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { user_id: userAccount.user_id },
      data: updateData
    })

    // Update user account if username changed
    if (Object.keys(accountUpdateData).length > 0) {
      await prisma.userAccount.update({
        where: { id: userAccount.id },
        data: accountUpdateData
      })
    }

    // Log the profile update
    await AuditService.logProfile(
      userAccount.id,
      userAccount.role as UserRole,
      'PROFILE_UPDATE',
      `User ${userAccount.username} updated profile: ${changes.join(', ')}`,
      request?.headers?.get('x-forwarded-for') || 'unknown',
      request?.headers?.get('user-agent') || 'unknown'
    )

    logger.info('Profile updated successfully', { 
      username: userAccount.username, 
      changes: changes.length 
    })

    // Get the updated username
    const finalUsername = accountUpdateData.username || userAccount.username

    return createSuccessResponse({
      message: 'Profile updated successfully',
      user: {
        id: finalUsername,
        account_id: userAccount.user.account_id,
        name: updatedUser.full_name,
        email: updatedUser.email,
        contact_number: updatedUser.contact_number,
        role: userAccount.role,
        avatar: null,
      }
    })

  } catch (error) {
    logger.error('Profile update error', error instanceof Error ? error : new Error(String(error)))
    return createErrorResponse('Internal server error', 500)
  }
}
