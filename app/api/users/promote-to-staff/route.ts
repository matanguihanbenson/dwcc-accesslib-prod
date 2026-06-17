import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { auditLogger } from '@/lib/audit-logger'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req })
    
    if (!token?.role) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (token.role !== 'SUPER_ADMIN' && token.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { userId, password, role } = await req.json()

    if (!userId || !password || !role) {
      return NextResponse.json(
        { error: 'User ID, password, and role are required' },
        { status: 400 }
      )
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: 'Password must be at least 4 characters long' },
        { status: 400 }
      )
    }

    // Check if ADMIN is trying to create non-STAFF role
    if (token.role === 'ADMIN' && role !== 'STAFF') {
      return NextResponse.json(
        { error: 'Admin can only create STAFF accounts' },
        { status: 403 }
      )
    }

    // Validate role
    const validRoles = ['STAFF', 'ADMIN']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { user_id: userId }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if user already has an account
    const existingAccount = await prisma.userAccount.findUnique({
      where: { user_id: userId }
    })

    // Generate username from account_id or use account_id as username
    const username = user.account_id
    
    if (!existingAccount) {
      // Creating new account path
      const existingUsername = await prisma.userAccount.findUnique({ where: { username } })
      if (existingUsername) {
        return NextResponse.json(
          { error: 'Username already exists in accounts' },
          { status: 400 }
        )
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    console.log(`Creating staff account for user ID: ${userId}, username: ${username}, role: ${role}`)

    let staffAccount
    if (existingAccount && existingAccount.role === 'USER') {
      // Promote existing USER to STAFF/ADMIN
      staffAccount = await prisma.userAccount.update({
        where: { user_id: userId },
        data: {
          role,
          password_hash: hashedPassword,
          is_active: true,
          last_login: null,
        },
        include: {
          user: {
            select: {
              full_name: true,
              user_type: true,
              email: true,
              year_level: true,
              department_ref: { select: { name: true } }
            }
          }
        }
      })
    } else if (!existingAccount) {
      // Create new account
      staffAccount = await prisma.userAccount.create({
        data: {
          user_id: userId,
          username,
          password_hash: hashedPassword,
          role,
          is_active: true,
          created_at: new Date(),
          last_login: null
        },
        include: {
          user: {
            select: {
              full_name: true,
              user_type: true,
              email: true,
              year_level: true,
              department_ref: { select: { name: true } }
            }
          }
        }
      })
    } else {
      return NextResponse.json(
        { error: 'User already has a privileged account' },
        { status: 400 }
      )
    }

    try {
      const actorId = parseInt((token?.sub as any) || '0')
      if (actorId > 0) {
        await auditLogger.logAction(
          actorId,
          token.role as any,
          role === 'STAFF' ? 'PROMOTE_TO_STAFF' : 'PROMOTE_TO_ADMIN',
          `${existingAccount ? 'Promoted' : 'Created'} ${role} account for ${staffAccount.user.full_name} (${user.account_id})`,
          req
        )
      }
    } catch {}

    return NextResponse.json({
      message: 'Staff account created successfully',
      account: staffAccount
    })

  } catch (error) {
    console.error('Error promoting user to staff:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
