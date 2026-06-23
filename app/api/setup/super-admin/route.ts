import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { UserRole, UserStatus, UserType } from '@/types'
import { isSetupRequired, invalidateSetupStateCache } from '@/lib/setup-state'

/**
 * POST /api/setup/super-admin
 *
 * Creates the first SUPER_ADMIN account. Hard-locked:
 *   - Refuses if any SUPER_ADMIN already exists (returns 403)
 *     so the endpoint is a one-shot per database.
 *   - Requires a `token` field in the JSON body that matches
 *     the `SETUP_TOKEN` env var.
 *   - The token is compared with `crypto.timingSafeEqual` to
 *     avoid leaking length / match-position info through timing.
 *
 * Request body:
 *   {
 *     token:        string,  // must match SETUP_TOKEN
 *     account_id:   string,  // human-readable ID, e.g. SUPER-ADMIN
 *     first_name:   string,
 *     last_name:    string,
 *     middle_name?: string,
 *     suffix?:      string,
 *     email?:       string,
 *     username:     string,  // login username
 *     password:     string,  // min 8 chars
 *   }
 *
 * Returns 201 with the created account id on success.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    // 1. Hard-lock: the endpoint only works when no
    //    SUPER_ADMIN exists.
    const setupRequired = await isSetupRequired()
    if (!setupRequired) {
      return NextResponse.json(
        {
          error:
            'Setup has already been completed. This endpoint is disabled.'
        },
        { status: 403 }
      )
    }

    // 2. Token check.
    const expectedToken = process.env.SETUP_TOKEN
    if (!expectedToken || expectedToken.length < 8) {
      console.error(
        'SETUP_TOKEN is missing or too short. Set a long random value in .env.'
      )
      return NextResponse.json(
        {
          error:
            'Server is mis-configured: SETUP_TOKEN is not set. Contact the administrator.'
        },
        { status: 500 }
      )
    }
    const providedToken = typeof body.token === 'string' ? body.token : ''
    if (!safeEqual(providedToken, expectedToken)) {
      return NextResponse.json(
        { error: 'Invalid setup token' },
        { status: 403 }
      )
    }

    // 3. Field validation.
    const {
      account_id,
      first_name,
      last_name,
      middle_name,
      suffix,
      email,
      username,
      password
    } = body as Record<string, unknown>

    const errors: string[] = []
    if (typeof account_id !== 'string' || !account_id.trim())
      errors.push('Account ID is required')
    if (typeof first_name !== 'string' || !first_name.trim())
      errors.push('First name is required')
    if (typeof last_name !== 'string' || !last_name.trim())
      errors.push('Last name is required')
    if (typeof username !== 'string' || !username.trim())
      errors.push('Username is required')
    if (typeof password !== 'string' || password.length < 8)
      errors.push('Password must be at least 8 characters')
    if (email != null && (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)))
      errors.push('Email is not a valid address')
    if (errors.length) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
    }

    // 4. Uniqueness checks (account_id + username + email).
    const existingAccountId = await prisma.user.findUnique({
      where: { account_id: (account_id as string).trim() }
    })
    if (existingAccountId) {
      return NextResponse.json(
        { error: 'Account ID is already in use' },
        { status: 409 }
      )
    }
    const existingUsername = await prisma.userAccount.findFirst({
      where: { username: (username as string).trim() }
    })
    if (existingUsername) {
      return NextResponse.json(
        { error: 'Username is already in use' },
        { status: 409 }
      )
    }
    if (email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: email as string }
      })
      if (existingEmail) {
        return NextResponse.json(
          { error: 'Email is already in use' },
          { status: 409 }
        )
      }
    }

    // 5. Create the User + UserAccount pair in a transaction so
    //    the system can never end up half-set-up.
    const fullName = [
      (first_name as string).trim(),
      (middle_name as string | undefined)?.trim(),
      (last_name as string).trim(),
      (suffix as string | undefined)?.trim()
    ]
      .filter(Boolean)
      .join(' ')

    const passwordHash = await bcrypt.hash(password as string, 12)

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          account_id: (account_id as string).trim(),
          first_name: (first_name as string).trim(),
          last_name: (last_name as string).trim(),
          middle_name: (middle_name as string | undefined)?.trim() || null,
          suffix: (suffix as string | undefined)?.trim() || null,
          full_name: fullName,
          user_type: UserType.EMPLOYEE,
          email: (email as string | undefined)?.trim() || null,
          status: UserStatus.ACTIVE
        }
      })

      const account = await tx.userAccount.create({
        data: {
          username: (username as string).trim(),
          password_hash: passwordHash,
          role: UserRole.SUPER_ADMIN,
          user_id: user.user_id,
          is_active: true
        }
      })

      return { user, account }
    })

    // 6. Drop the cached "setup required" state so the
    //    middleware and /api/setup/status see the new state
    //    on the very next request.
    invalidateSetupStateCache()

    return NextResponse.json(
      {
        success: true,
        message: 'Super admin account created. You can now log in.',
        user: {
          user_id: result.user.user_id,
          account_id: result.user.account_id,
          full_name: result.user.full_name,
          email: result.user.email
        },
        account: {
          id: result.account.id,
          username: result.account.username,
          role: result.account.role
        }
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Failed to create super admin during setup:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Constant-time string comparison so the token check doesn't
 * leak information through timing.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}
