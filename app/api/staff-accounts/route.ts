import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { auditLogger } from '@/lib/audit-logger'
import { withDuplicatePreventionByBody } from '@/lib/duplicate-prevention'

// GET - Fetch all staff accounts
export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req })
    
    if (!token?.role) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // ADMIN and SUPER_ADMIN can view staff accounts
    if (token.role !== 'SUPER_ADMIN' && token.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const staffAccounts = await prisma.userAccount.findMany({
      where: {
        role: 'STAFF'
      },
      include: {
        user: {
          include: {
            department_ref: {
              select: {
                name: true,
                code: true
              }
            },
            program: {
              select: {
                name: true,
                code: true
              }
            }
          }
        }
      },
      orderBy: [
        { user: { full_name: 'asc' } }
      ]
    })

    return NextResponse.json(staffAccounts)

  } catch (error) {
    console.error('Error fetching staff accounts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new staff account from scratch
export const POST = withDuplicatePreventionByBody(
  async (req: NextRequest) => {
    try {
      const token = await getToken({ req })
      
      if (!token?.role) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }

      // ADMIN and SUPER_ADMIN can create staff accounts
      if (token.role !== 'SUPER_ADMIN' && token.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        )
      }

      const { full_name, email, user_type, password, department_id, program_id, office_id, contact_number, rfid_code, purpose } = await req.json()

      // Validate required fields
      if (!full_name || !password) {
        return NextResponse.json(
          { error: 'Full name and password are required' },
          { status: 400 }
        )
      }

      if (password.length < 4) {
        return NextResponse.json(
          { error: 'Password must be at least 4 characters long' },
          { status: 400 }
        )
      }

      // Validate email if provided
      if (email) {
        const existingUserWithEmail = await prisma.user.findUnique({
          where: { email }
        })
        if (existingUserWithEmail) {
          return NextResponse.json(
            { error: 'Email already exists' },
            { status: 400 }
          )
        }
      }

      // Generate unique account_id
      const timestamp = Date.now()
      const account_id = `STAFF-${timestamp}`

      // Check if account_id already exists (unlikely but safe)
      const existingAccount = await prisma.user.findUnique({
        where: { account_id }
      })
      if (existingAccount) {
        return NextResponse.json(
          { error: 'Generated account ID conflict. Please try again.' },
          { status: 409 }
        )
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12)

      // Parse full_name into parts
      const nameParts = full_name.trim().split(/\s+/)
      const first_name = nameParts[0] || ''
      const last_name = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0]
      const middle_name = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : null

      // Create User and UserAccount in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create User record
        const newUser = await tx.user.create({
          data: {
            account_id,
            first_name,
            last_name,
            middle_name,
            full_name,
            user_type: user_type || 'EMPLOYEE',
            email: email || null,
            department_id: department_id || null,
            program_id: program_id || null,
            office_id: office_id || null,
            contact_number: contact_number || null,
            rfid_code: rfid_code || null,
            purpose: purpose || null,
            status: 'ACTIVE'
          }
        })

        // Create UserAccount record
        const newUserAccount = await tx.userAccount.create({
          data: {
            username: account_id,
            password_hash: hashedPassword,
            role: 'STAFF',
            user_id: newUser.user_id,
            is_active: true
          },
          include: {
            user: {
              select: {
                full_name: true,
                account_id: true,
                user_type: true,
                email: true,
                department_ref: {
                  select: { name: true, code: true }
                },
                program: {
                  select: { name: true, code: true }
                }
              }
            }
          }
        })

        return newUserAccount
      })

      // Log the action
      try {
        const actorId = parseInt((token?.sub as any) || '0')
        if (actorId > 0) {
          await auditLogger.logAction(
            actorId,
            token.role as any,
            'CREATE_STAFF_ACCOUNT',
            `Created STAFF account for ${result.user.full_name} (${result.user.account_id})`,
            req
          )
        }
      } catch {}

      return NextResponse.json({
        success: true,
        message: 'Staff account created successfully',
        data: {
          id: result.id,
          username: result.username,
          role: result.role,
          user: result.user
        }
      }, { status: 201 })

    } catch (error) {
      console.error('Error creating staff account:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  },
  {
    ttl: 15000,
    keyFields: ['full_name', 'email']
  }
)
