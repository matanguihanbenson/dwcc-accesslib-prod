import bcrypt from 'bcryptjs'
import { BaseService } from './base.service'
import { AuditService } from './audit.service'
import { prisma } from '@/lib/prisma'
import { 
  ServiceResult, 
  CreateUserData, 
  CreateUserAccountData, 
  UpdateUserData,
  LibraryUser,
  UserAccount,
  SearchFilters,
  UserRole,
  UserStatus
} from '@/types'
import { validateCreateUser, validateCreateUserAccount } from '@/lib/validations'
import { AppError, DuplicateError } from '@/lib/errors'
import { generateAccountId } from '@/lib/utils'

export class UserService extends BaseService {
  async createLibraryUser(data: CreateUserData, createdBy: number, createdByRole: UserRole): Promise<ServiceResult<LibraryUser>> {
    try {
      const validation = validateCreateUser(data)
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', '),
          code: 'VALIDATION_ERROR',
        }
      }

      if (await this.exists(prisma.user, { account_id: data.account_id })) {
        throw new DuplicateError('Account ID already exists')
      }

      if (data.email && await this.exists(prisma.user, { email: data.email })) {
        throw new DuplicateError('Email already exists')
      }

      if (data.rfid_code) {
        if (await this.exists(prisma.user, { rfid_code: data.rfid_code })) {
          throw new DuplicateError('RFID code already exists')
        }

        const existingLocker = await prisma.locker.findFirst({
          where: {
            rfid_code: data.rfid_code,
            archived_at: null,
          },
          select: {
            locker_id: true,
            locker_number: true,
          },
        })

        if (existingLocker) {
          throw new DuplicateError(
            `RFID code is already bound to locker ${existingLocker.locker_number}`
          )
        }
      }

      // Construct full_name from parts if not provided
      const full_name = data.full_name || (() => {
        const nameParts = [data.first_name, data.middle_name, data.last_name]
          .filter(part => part && part.trim())
          .join(' ')
        
        // Append suffix with comma if present
        return data.suffix && data.suffix.trim() 
          ? `${nameParts}, ${data.suffix.trim()}` 
          : nameParts
      })()

      // Remove UI-only fields that don't exist in the database schema
      const { student_category, basic_ed_level, ...dbData } = data as any

      const user = await this.create<LibraryUser>(prisma.user, {
        ...dbData,
        account_id: data.account_id || generateAccountId(data.user_type),
        full_name,
        // Normalize optional empty strings to null to satisfy DB constraints
        middle_name: data.middle_name ? data.middle_name : null,
        suffix: data.suffix ? data.suffix : null,
        department_id: data.department_id ? data.department_id : null,
        program_id: data.program_id ? data.program_id : null,
        office_id: (data as any).office_id ? (data as any).office_id : null,
        grade_level_id: (data as any).grade_level_id ? parseInt((data as any).grade_level_id) : null,
        section_id: (data as any).section_id ? parseInt((data as any).section_id) : null,
        strand_id: (data as any).strand_id ? parseInt((data as any).strand_id) : null,
        year_level: data.year_level ? data.year_level : null,
        email: data.email ? data.email : null,
        rfid_code: data.rfid_code ? data.rfid_code : null,
        purpose: data.purpose ? data.purpose : null,
        contact_number: data.contact_number ? data.contact_number : null,
      })

      await AuditService.logAction(
        createdBy,
        createdByRole,
        'CREATE_USER',
        `Created library user: ${full_name} (${user.account_id})`
      )

      return this.handleSuccess(user, 'User created successfully')
    } catch (error) {
      return this.handleError(error, 'UserService.createLibraryUser')
    }
  }

  async createUserAccount(data: CreateUserAccountData, createdBy: number, createdByRole: UserRole): Promise<ServiceResult<UserAccount>> {
    try {
      const validation = validateCreateUserAccount(data)
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', '),
          code: 'VALIDATION_ERROR',
        }
      }

      if (await this.exists(prisma.userAccount, { username: data.username })) {
        throw new DuplicateError('Username already exists')
      }

      const hashedPassword = await bcrypt.hash(data.password, 12)

      const result = await this.executeTransaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            ...data.user_data,
            account_id: data.user_data.account_id || generateAccountId(data.user_data.user_type),
          }
        })

        const userAccount = await tx.userAccount.create({
          data: {
            username: data.username,
            password_hash: hashedPassword,
            role: data.role,
            user_id: user.user_id,
          },
          include: {
            user: true,
          }
        })

        return userAccount
      })

      await AuditService.logAction(
        createdBy,
        createdByRole,
        'CREATE_ACCOUNT',
        `Created user account: ${data.username} with role ${data.role}`
      )

      return this.handleSuccess(result, 'User account created successfully')
    } catch (error) {
      return this.handleError(error, 'UserService.createUserAccount')
    }
  }

  async getLibraryUsers(filters: SearchFilters): Promise<ServiceResult> {
    try {
      const result = await this.paginate(
        prisma.user,
        filters,
        {
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
          }
        },
        {
          AND: [
            this.buildUserSearchQuery(filters),
            {
              OR: [
                { user_account: null },
                { user_account: { role: UserRole.USER } }
              ]
            }
          ]
        }
      )

      // Transform the data to include department and program codes
      // (the compact form used in table cells). The full
      // `department_ref` and `program` objects are still
      // attached so pages that need the long name can read
      // them off the relation.
      const transformedData = {
        ...result,
        data: result.data ? result.data.map((user: any) => ({
          ...user,
          department: user.department_ref ? user.department_ref.code : null,
          course: user.program ? user.program.code : null
        })) : []
      }

      return this.handleSuccess(transformedData)
    } catch (error) {
      return this.handleError(error, 'UserService.getLibraryUsers')
    }
  }

  async getUserAccounts(filters: SearchFilters): Promise<ServiceResult> {
    try {
      const result = await this.paginate(
        prisma.userAccount,
        filters,
        {
          user: true,
        }
      )

      return this.handleSuccess(result)
    } catch (error) {
      return this.handleError(error, 'UserService.getUserAccounts')
    }
  }

  private buildUserSearchQuery(filters: SearchFilters) {
    const where: any = {}
    
    if (filters.query) {
      where.OR = [
        { first_name: { contains: filters.query } },
        { last_name: { contains: filters.query } },
        { middle_name: { contains: filters.query } },
        { full_name: { contains: filters.query } },
        { account_id: { contains: filters.query } },
        { email: { contains: filters.query } },
      ]
    }
    
    if (filters.userType) {
      where.user_type = filters.userType
    }
    
    if (filters.departmentId) {
      where.department_id = parseInt(filters.departmentId)
    }
    
    if (filters.programId) {
      where.program_id = parseInt(filters.programId)
    }
    
    if (filters.yearLevel) {
      where.year_level = filters.yearLevel
    }
    
    if (filters.status) {
      where.status = filters.status
    }
    
    // Additional category filters
    if ((filters as any).section_id) {
      where.section_id = parseInt((filters as any).section_id)
    }
    
    if ((filters as any).grade_level_id) {
      where.grade_level_id = parseInt((filters as any).grade_level_id)
    }
    
    if ((filters as any).strand_id) {
      where.strand_id = parseInt((filters as any).strand_id)
    }
    
    if ((filters as any).office_id) {
      where.office_id = parseInt((filters as any).office_id)
    }
    
    if (filters.dateFrom || filters.dateTo) {
      where.created_at = {}
      if (filters.dateFrom) {
        where.created_at.gte = filters.dateFrom
      }
      if (filters.dateTo) {
        where.created_at.lte = filters.dateTo
      }
    }
    
    return where
  }
}

export const userService = new UserService()