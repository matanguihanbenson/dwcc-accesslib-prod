import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { UserRole } from '@/types'
import { auditLogger } from '@/lib/audit-logger'
import { withDuplicatePreventionByBody } from '@/lib/duplicate-prevention'

export const POST = withDuplicatePreventionByBody(
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions)
      
      if (!session?.user?.username) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }

      // Check if user is SUPER_ADMIN
      const userAccount = await prisma.userAccount.findUnique({
        where: {
          username: session.user.username,
          is_active: true
        }
      })

      if (!userAccount || userAccount.role !== UserRole.SUPER_ADMIN) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }

      const { user_id, password, role } = await req.json()

      // Validate required fields
      if (!user_id || !password || !role) {
        return NextResponse.json({ 
          error: 'User ID, password, and role are required' 
        }, { status: 400 })
      }

      // Validate role
      if (role !== 'ADMIN') {
        return NextResponse.json({ 
          error: 'Invalid role. Only ADMIN role is allowed for this endpoint' 
        }, { status: 400 })
      }

      // Check admin limit (maximum 1 active ADMIN account)
      const activeAdminCount = await prisma.userAccount.count({
        where: {
          role: UserRole.ADMIN,
          is_active: true
        }
      })

      if (activeAdminCount >= 1) {
        return NextResponse.json({ 
          error: 'Maximum number of Library Admin accounts (1) has been reached. Please deactivate an existing admin before creating a new one.' 
        }, { status: 400 })
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { user_id: parseInt(user_id) }
      })

      if (!user) {
        return NextResponse.json({ 
          error: 'User not found' 
        }, { status: 404 })
      }

      // Check existing account
      const existingAccount = await prisma.userAccount.findFirst({ where: { user_id: parseInt(user_id) } })

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12)

      let adminAccount
      if (existingAccount && existingAccount.role === UserRole.USER) {
        // Promote existing USER to ADMIN
        adminAccount = await prisma.userAccount.update({
          where: { user_id: parseInt(user_id) },
          data: {
            role: UserRole.ADMIN,
            password_hash: hashedPassword,
            is_active: true
          },
          include: {
            user: { select: { full_name: true, account_id: true, user_type: true, email: true } }
          }
        })
      } else if (!existingAccount) {
        // Create admin account
        adminAccount = await prisma.userAccount.create({
          data: {
            username: user.account_id,
            password_hash: hashedPassword,
            role: UserRole.ADMIN,
            user_id: parseInt(user_id),
            is_active: true
          },
          include: {
            user: { select: { full_name: true, account_id: true, user_type: true, email: true } }
          }
        })
      } else {
        return NextResponse.json({ error: 'User already has a privileged account' }, { status: 400 })
      }

      try {
        if (session?.user?.id) {
          await auditLogger.logAction(
            parseInt(session.user.id as any),
            session.user.role as any,
            existingAccount ? 'PROMOTE_TO_ADMIN' : 'CREATE_ADMIN_ACCOUNT',
            `${existingAccount ? 'Promoted' : 'Created'} ADMIN account for ${adminAccount.user.full_name} (${adminAccount.user.account_id})`,
            req
          )
        }
      } catch {}

      return NextResponse.json({
        success: true,
        message: 'Admin account created successfully',
        data: {
          id: adminAccount.id,
          username: adminAccount.username,
          role: adminAccount.role,
          user: adminAccount.user
        }
      }, { status: 201 })

    } catch (error) {
      console.error('Error creating admin account:', error)
      return NextResponse.json({ 
        error: 'Internal server error' 
      }, { status: 500 })
    }
  },
  {
    ttl: 15000, // 15 seconds for admin account creation
    keyFields: ['user_id', 'role']
  }
)

