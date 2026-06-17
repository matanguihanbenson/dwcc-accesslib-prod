import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/types'
import logger from '@/lib/logger'
import { AuditService } from '@/lib/services/audit.service'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json(
        { 
          error: 'MISSING_CREDENTIALS',
          message: 'Username and password are required' 
        },
        { status: 400 }
      )
    }

    const userAccount = await prisma.userAccount.findUnique({
      where: {
        username: username
      },
      include: {
        user: true
      }
    })

    if (!userAccount || !userAccount.user) {
      return NextResponse.json(
        { 
          error: 'USER_NOT_FOUND',
          message: 'Invalid username or password' 
        },
        { status: 401 }
      )
    }

    const isPasswordValid = await bcrypt.compare(password, userAccount.password_hash)
    
    if (!isPasswordValid) {
      return NextResponse.json(
        { 
          error: 'INVALID_PASSWORD',
          message: 'Invalid username or password' 
        },
        { status: 401 }
      )
    }

    if (!userAccount.is_active) {
      return NextResponse.json(
        { 
          error: 'ACCOUNT_INACTIVE',
          message: 'Your account is inactive. Please proceed to the ISSO Office.',
          username: userAccount.username,
          fullName: userAccount.user.full_name
        },
        { status: 403 }
      )
    }

    await prisma.userAccount.update({
      where: { id: userAccount.id },
      data: { last_login: new Date() }
    })

    try {
      // Get IP address from headers (Next.js doesn't have req.ip)
      const ip = req.headers.get('x-forwarded-for') || 
                 req.headers.get('x-real-ip') ||
                 req.headers.get('cf-connecting-ip') ||
                 '::1'
      
      await AuditService.logAuth(
        userAccount.id,
        userAccount.role as UserRole,
        'LOGIN',
        `Successful login attempt for user ${userAccount.username}`,
        ip,
        req.headers.get('user-agent') || 'Unknown'
      )
    } catch (auditError) {
      logger.error("Failed to log login audit", auditError instanceof Error ? auditError : new Error(String(auditError)))
    }

    return NextResponse.json({
      success: true,
      message: 'Login credentials valid',
      user: {
        id: userAccount.user.user_id.toString(),
        email: userAccount.user.email || userAccount.username,
        name: userAccount.user.full_name,
        username: userAccount.username,
        role: userAccount.role,
        userType: userAccount.user.user_type,
        accountId: userAccount.user.account_id
      }
    })

  } catch (error) {
    console.error('Custom login error:', error)
    return NextResponse.json(
      { 
        error: 'INTERNAL_ERROR',
        message: 'An internal error occurred during login' 
      },
      { status: 500 }
    )
  }
}
     