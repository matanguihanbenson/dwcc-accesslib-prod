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
      select: {
        id: true,
        username: true,
        role: true,
        is_active: true,
        campus: true,
        last_login: true,
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

      const { full_name, email, user_type, password, department_id, program_id, office_id, contact_number, rfid_code, purpose, campus, account_id: providedAccountId } = await req.json()

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

      // Validate campus value if provided. Allowed values: COLLEGE,
      // BASIC_EDUCATION. Anything else is rejected so a typo can't
      // silently misroute entries.
      const allowedCampuses = ['COLLEGE', 'BASIC_EDUCATION']
      if (campus !== undefined && campus !== null && campus !== '' && !allowedCampuses.includes(campus)) {
        return NextResponse.json(
          { error: 'Invalid campus. Must be COLLEGE or BASIC_EDUCATION' },
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

      // ID Number / Username. Library admin enters this manually
      // (e.g. "2024-STAFF-001") instead of the previous
      // auto-generated `STAFF-${timestamp}`. The same value is
      // used as both `User.account_id` (the human-readable ID
      // shown in reports / RFID logs) and `UserAccount.username`
      // (the login name).
      const account_id = (providedAccountId || '').trim()
      if (!account_id) {
        return NextResponse.json(
          { error: 'ID Number / Username is required' },
          { status: 400 }
        )
      }
      if (!/^[A-Za-z0-9._-]{3,20}$/.test(account_id)) {
        return NextResponse.json(
          { error: 'ID Number / Username must be 3-20 characters (letters, numbers, . _ -)' },
          { status: 400 }
        )
      }
      // Reject values that look like a generated fallback so a
      // genuine typo can't collide with the legacy `STAFF-*`
      // pattern from older records.
      if (/^STAFF-\d+$/i.test(account_id)) {
        return NextResponse.json(
          { error: 'ID Number / Username cannot use the auto-generated STAFF-* format' },
          { status: 400 }
        )
      }

      // Check uniqueness against both `User.account_id` and
      // `UserAccount.username` (the same value is stored in both,
      // but checking both keeps the error message precise if the
      // schema ever diverges).
      const existingUser = await prisma.user.findUnique({
        where: { account_id }
      })
      if (existingUser) {
        return NextResponse.json(
          { error: 'ID Number already exists' },
          { status: 409 }
        )
      }
      const existingUsername = await prisma.userAccount.findUnique({
        where: { username: account_id }
      })
      if (existingUsername) {
        return NextResponse.json(
          { error: 'Username already exists' },
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

        // Create UserAccount record. STAFF accounts require a campus so
        // every entry they log can be stamped with the campus the staff
        // is currently responsible for. Default to COLLEGE if not
        // supplied so existing API callers don't break.
        const newUserAccount = await tx.userAccount.create({
          data: {
            username: account_id,
            password_hash: hashedPassword,
            role: 'STAFF',
            user_id: newUser.user_id,
            is_active: true,
            campus: (campus && allowedCampuses.includes(campus)) ? campus : 'COLLEGE'
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
            `Created STAFF account for ${result.user.full_name} (ID/username: ${account_id}) assigned to campus ${(campus && allowedCampuses.includes(campus)) ? campus : 'COLLEGE'}`,
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
    keyFields: ['full_name', 'email', 'account_id']
  }
)
