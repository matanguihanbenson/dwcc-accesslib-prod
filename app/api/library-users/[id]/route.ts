import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { UserRole } from '@/types'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { auditLogger } from '@/lib/audit-logger'
import { authOptions } from '@/lib/auth'
import { validateAccountId, validateName } from '@/lib/validations'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    // GET is available to SUPER_ADMIN, ADMIN, and STAFF
    // (STAFF needs to view user details + bind RFID).
    // PUT/DELETE below remain admin-only.
    if (
      !session ||
      (session.user.role !== UserRole.SUPER_ADMIN &&
        session.user.role !== UserRole.ADMIN &&
        session.user.role !== UserRole.STAFF)
    ) {
      return createErrorResponse('Unauthorized', 401)
    }

    const resolvedParams = await params
    const userId = parseInt(resolvedParams.id)
    
    if (isNaN(userId)) {
      return createErrorResponse('Invalid user ID', 400)
    }

    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      include: {
        department_ref: {
          select: {
            department_id: true,
            name: true,
            code: true,
            is_active: true
          }
        },
        program: {
          select: {
            program_id: true,
            name: true,
            code: true,
            is_active: true
          }
        },
        book_transactions: {
          select: {
            transaction_id: true,
            book_id: true,
            borrow_date: true,
            due_date: true,
            return_date: true,
            status: true,
            created_at: true,
            book: {
              select: {
                title: true,
                authors: {
                  select: { name: true },
                  orderBy: { display_order: 'asc' },
                  take: 1
                }
              }
            }
          },
          orderBy: {
            created_at: 'desc'
          },
          take: 10
        },
        entry_logs: {
          select: {
            entry_id: true,
            entry_time: true,
            exit_time: true,
            purpose: true
          },
          orderBy: {
            entry_time: 'desc'
          },
          take: 10
        }
      }
    })

    if (!user) {
      return createErrorResponse('User not found', 404)
    }

    return createSuccessResponse(user)
  } catch (error) {
    console.error('Error fetching user:', error)
    return createErrorResponse('Failed to fetch user', 500)
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    // PUT is available to SUPER_ADMIN, ADMIN, and STAFF
    // (STAFF has the same library-user management
    // permissions as ADMIN on the UI side). DELETE
    // remains SUPER_ADMIN-only — see the DELETE handler
    // below.
    if (
      !session ||
      (session.user.role !== UserRole.SUPER_ADMIN &&
        session.user.role !== UserRole.ADMIN &&
        session.user.role !== UserRole.STAFF)
    ) {
      return createErrorResponse('Unauthorized', 401)
    }

    const resolvedParams = await params
    const userId = parseInt(resolvedParams.id)
    
    if (isNaN(userId)) {
      return createErrorResponse('Invalid user ID', 400)
    }

    const data = await req.json()

    const validationErrors: string[] = []

    const accountIdError = validateAccountId(data.account_id)
    if (accountIdError) validationErrors.push(accountIdError)

    if (data.full_name) {
      const fullNameError = validateName(data.full_name)
      if (fullNameError) validationErrors.push(fullNameError)
    } else {
      const firstName = (data.first_name || '').trim()
      const lastName = (data.last_name || '').trim()
      if (!firstName) validationErrors.push('First name is required')
      if (!lastName) validationErrors.push('Last name is required')
      if (firstName) {
        const firstErr = validateName(firstName)
        if (firstErr) validationErrors.push(`First name: ${firstErr}`)
      }
      if (lastName) {
        const lastErr = validateName(lastName)
        if (lastErr) validationErrors.push(`Last name: ${lastErr}`)
      }
      if (data.middle_name) {
        const middleErr = validateName(data.middle_name)
        if (middleErr) validationErrors.push(`Middle name: ${middleErr}`)
      }
    }

    if (validationErrors.length > 0) {
      return createErrorResponse(validationErrors.join(', '), 400)
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { user_id: userId }
    })

    if (!existingUser) {
      return createErrorResponse('User not found', 404)
    }

    // Check if account ID already exists (excluding current user)
    const accountIdExists = await prisma.user.findFirst({
      where: { 
        account_id: data.account_id,
        user_id: { not: userId }
      }
    })
    
    if (accountIdExists) {
      return createErrorResponse('ID Number already exists', 400)
    }

    // Check if email already exists (excluding current user)
    if (data.email) {
      const emailExists = await prisma.user.findFirst({
        where: { 
          email: data.email,
          user_id: { not: userId }
        }
      })
      
      if (emailExists) {
        return createErrorResponse('Email already exists', 400)
      }
    }

    // Validate department and program if provided
    if (data.department_id) {
      const department = await prisma.department.findUnique({
        where: { department_id: data.department_id }
      })
      
      if (!department) {
        return createErrorResponse('Department not found', 400)
      }
    }

    if (data.program_id) {
      const program = await prisma.program.findUnique({
        where: { program_id: data.program_id }
      })
      
      if (!program) {
        return createErrorResponse('Program not found', 400)
      }
    }

    if (data.office_id) {
      const office = await prisma.office.findUnique({
        where: { office_id: data.office_id }
      })
      if (!office) {
        return createErrorResponse('Office not found', 400)
      }
    }

    const nameParts = [
      (data.first_name || '').trim(),
      (data.middle_name || '').trim(),
      (data.last_name || '').trim(),
    ].filter(Boolean)
    const computedFullName = data.full_name && data.full_name.trim()
      ? data.full_name.trim()
      : nameParts.join(' ')
    const finalFullName = data.suffix && String(data.suffix).trim()
      ? `${computedFullName}, ${String(data.suffix).trim()}`
      : computedFullName

    const updatedUser = await prisma.user.update({
      where: { user_id: userId },
      data: {
        full_name: finalFullName,
        account_id: data.account_id,
        user_type: data.user_type,
        department_id: data.department_id || null,
        program_id: data.program_id || null,
        office_id: data.office_id || null,
        year_level: data.year_level || null,
        email: data.email || null,
        contact_number: data.contact_number || null,
        purpose: data.purpose || null,
        status: data.status !== undefined ? data.status : existingUser.status
      },
      include: {
        department_ref: {
          select: {
            department_id: true,
            name: true,
            code: true
          }
        },
        program: {
          select: {
            program_id: true,
            name: true,
            code: true
          }
        }
      }
    })

    // Log the user update
    try {
      const changes = []
      if (existingUser.full_name !== updatedUser.full_name) {
        changes.push(`name: "${existingUser.full_name}" → "${updatedUser.full_name}"`)
      }
      if (existingUser.account_id !== updatedUser.account_id) {
        changes.push(`account_id: "${existingUser.account_id}" → "${updatedUser.account_id}"`)
      }
      if (existingUser.email !== updatedUser.email) {
        changes.push(`email: "${existingUser.email || 'none'}" → "${updatedUser.email || 'none'}"`)
      }
      if (existingUser.user_type !== updatedUser.user_type) {
        changes.push(`user_type: "${existingUser.user_type}" → "${updatedUser.user_type}"`)
      }
      if (existingUser.status !== updatedUser.status) {
        changes.push(`status: "${existingUser.status}" → "${updatedUser.status}"`)
      }
      
      await auditLogger.logAction(
        parseInt(session.user.id),
        session.user.role as UserRole,
        'USER_UPDATE',
        `Updated user ${updatedUser.full_name}: ${changes.join(', ')}`,
        req
      )
    } catch (auditError) {
      console.error('Failed to log user update:', auditError)
      // Don't fail the request if audit logging fails
    }

    return createSuccessResponse(updatedUser, 'User updated successfully')
  } catch (error) {
    console.error('Error updating user:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to update user', 
      500
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== UserRole.SUPER_ADMIN) {
      return createErrorResponse('Unauthorized', 401)
    }

    const resolvedParams = await params
    const userId = parseInt(resolvedParams.id)
    
    if (isNaN(userId)) {
      return createErrorResponse('Invalid user ID', 400)
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { user_id: userId },
      include: {
        book_transactions: true,
        entry_logs: true
      }
    })

    if (!existingUser) {
      return createErrorResponse('User not found', 404)
    }

    // Check if user has active transactions or recent activity
    const activeTransactions = existingUser.book_transactions.filter(
      t => t.status === 'ACTIVE'
    )

    if (activeTransactions.length > 0) {
      return createErrorResponse('Cannot delete user with active book transactions', 400)
    }

    // Archive the user instead of hard delete
    const archivedUser = await prisma.user.update({
      where: { user_id: userId },
      data: {
        status: 'ARCHIVED',
        archived_at: new Date()
      }
    })

    // Log the user archival
    try {
      await auditLogger.logAction(
        parseInt(session.user.id),
        session.user.role as UserRole,
        'USER_DELETE',
        `Archived user ${existingUser.full_name}`,
        req
      )
    } catch (auditError) {
      console.error('Failed to log user archival:', auditError)
      // Don't fail the request if audit logging fails
    }

    return createSuccessResponse(null, 'User archived successfully')
  } catch (error) {
    console.error('Error archiving user:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to archive user', 
      500
    )
  }
}
