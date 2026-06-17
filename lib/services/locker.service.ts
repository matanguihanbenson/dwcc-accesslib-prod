import { BaseService } from './base.service'
import { AuditService } from './audit.service'
import { prisma } from '@/lib/prisma'
import {
  ServiceResult,
  CreateLockerData,
  UpdateLockerData,
  Locker,
  LockerTransaction,
  SearchFilters,
  UserRole,
  LockerStatus,
  TransactionStatus
} from '@/types'
import { validateCreateLocker } from '@/lib/validations'
import { AppError, BusinessLogicError } from '@/lib/errors'

export class LockerService extends BaseService {
  async createLocker(data: CreateLockerData, createdBy: number, createdByRole: UserRole): Promise<ServiceResult<Locker>> {
    try {
      const validation = validateCreateLocker(data)
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', '),
          code: 'VALIDATION_ERROR',
        }
      }

      if (await this.exists(prisma.locker, { locker_number: data.locker_number })) {
        throw new AppError('Locker number already exists', 'DUPLICATE_ENTRY', 409)
      }

      const locker = await this.create<Locker>(prisma.locker, data)

      await AuditService.logAction(
        createdBy,
        createdByRole,
        'CREATE_LOCKER',
        `Created locker: ${locker.locker_number} at ${locker.location}`
      )

      return this.handleSuccess(locker, 'Locker created successfully')
    } catch (error) {
      return this.handleError(error, 'LockerService.createLocker')
    }
  }

  async getLockers(filters: SearchFilters): Promise<ServiceResult> {
    try {
      const result = await this.paginate(
        prisma.locker,
        filters,
        null,
        this.buildLockerSearchQuery(filters)
      )

      return this.handleSuccess(result)
    } catch (error) {
      return this.handleError(error, 'LockerService.getLockers')
    }
  }

  async getLockerById(lockerId: number): Promise<ServiceResult<Locker>> {
    try {
      const validatedId = this.validateId(lockerId, 'Locker ID')
      
      const locker = await this.findUnique<Locker>(
        prisma.locker,
        { locker_id: validatedId },
        null,
        'Locker not found'
      )

      return this.handleSuccess(locker)
    } catch (error) {
      return this.handleError(error, 'LockerService.getLockerById')
    }
  }

  async updateLocker(lockerId: number, data: UpdateLockerData, updatedBy: number, updatedByRole: UserRole): Promise<ServiceResult<Locker>> {
    try {
      const validatedId = this.validateId(lockerId, 'Locker ID')

      const existingLocker = await this.findUnique<Locker>(
        prisma.locker,
        { locker_id: validatedId },
        null,
        'Locker not found'
      )

      if (data.locker_number && data.locker_number !== existingLocker.locker_number) {
        if (await this.exists(prisma.locker, { locker_number: data.locker_number, locker_id: { not: validatedId } })) {
          throw new AppError('Locker number already exists', 'DUPLICATE_ENTRY', 409)
        }
      }

      const allowedFields: (keyof UpdateLockerData)[] = [
        'locker_number', 'location', 'status'
      ]

      const sanitizedData = this.sanitizeUpdateData(data, allowedFields)

      const updatedLocker = await this.update<Locker>(
        prisma.locker,
        { locker_id: validatedId },
        sanitizedData
      )

      await AuditService.logAction(
        updatedBy,
        updatedByRole,
        'UPDATE_LOCKER',
        `Updated locker: ${updatedLocker.locker_number} at ${updatedLocker.location}`
      )

      return this.handleSuccess(updatedLocker, 'Locker updated successfully')
    } catch (error) {
      return this.handleError(error, 'LockerService.updateLocker')
    }
  }

  async assignLocker(lockerId: number, userId: number, dueTime: Date, assignedBy: number, assignedByRole: UserRole): Promise<ServiceResult<LockerTransaction>> {
    try {
      const validatedLockerId = this.validateId(lockerId, 'Locker ID')
      const validatedUserId = this.validateId(userId, 'User ID')

      const locker = await this.findUnique<Locker>(
        prisma.locker,
        { locker_id: validatedLockerId },
        null,
        'Locker not found'
      )

      if (locker.status !== LockerStatus.AVAILABLE) {
        throw new BusinessLogicError('Locker is not available', 'LOCKER_NOT_AVAILABLE')
      }

      const hasActiveAssignment = await this.exists(prisma.lockerTransaction, {
        user_id: validatedUserId,
        status: TransactionStatus.ACTIVE,
      })

      if (hasActiveAssignment) {
        throw new BusinessLogicError('User already has an active locker assignment', 'DUPLICATE_ASSIGNMENT')
      }

      const result = await this.executeTransaction(async (tx) => {
        const transaction = await tx.lockerTransaction.create({
          data: {
            locker_id: validatedLockerId,
            user_id: validatedUserId,
            borrow_time: new Date(),
            due_time: dueTime,
            assigned_by: assignedBy,
            status: TransactionStatus.ACTIVE,
          },
          include: {
            locker: true,
            user: true,
          }
        })

        await tx.locker.update({
          where: { locker_id: validatedLockerId },
          data: { status: LockerStatus.OCCUPIED }
        })

        return transaction
      })

      await AuditService.logAction(
        assignedBy,
        assignedByRole,
        'ASSIGN_LOCKER',
        `Assigned locker ${locker.locker_number} to user ID ${userId}`
      )

      return this.handleSuccess(result, 'Locker assigned successfully')
    } catch (error) {
      return this.handleError(error, 'LockerService.assignLocker')
    }
  }

  async returnLocker(transactionId: number, processedBy: number, processedByRole: UserRole): Promise<ServiceResult> {
    try {
      const validatedId = this.validateId(transactionId, 'Transaction ID')

      const transaction = await this.findUnique<LockerTransaction>(
        prisma.lockerTransaction,
        { transaction_id: validatedId },
        { locker: true, user: true },
        'Transaction not found'
      )

      if (transaction.status !== TransactionStatus.ACTIVE) {
        throw new BusinessLogicError('Transaction is not active', 'INVALID_TRANSACTION_STATUS')
      }

      const returnTime = new Date()
      let penalty = 0

      if (returnTime > transaction.due_time) {
        const hoursOverdue = Math.ceil((returnTime.getTime() - transaction.due_time.getTime()) / (1000 * 60 * 60))
        const penaltyConfig = await prisma.penaltyConfig.findFirst({
          where: { type: 'LOCKER', is_active: true }
        })
        penalty = hoursOverdue * (Number(penaltyConfig?.penalty_per_hour) || 2)
      }

      await this.executeTransaction(async (tx) => {
        await tx.lockerTransaction.update({
          where: { transaction_id: validatedId },
          data: {
            return_time: returnTime,
            penalty,
            status: TransactionStatus.COMPLETED,
            returned_by: processedBy,
          }
        })

        await tx.locker.update({
          where: { locker_id: transaction.locker_id },
          data: { status: LockerStatus.AVAILABLE }
        })
      })

      await AuditService.logAction(
        processedBy,
        processedByRole,
        'RETURN_LOCKER',
        `Processed locker return: ${transaction.locker?.locker_number} from user ID ${transaction.user_id}`
      )

      return this.handleSuccess(null, 'Locker returned successfully')
    } catch (error) {
      return this.handleError(error, 'LockerService.returnLocker')
    }
  }

  async forceReturn(transactionId: number, processedBy: number, processedByRole: UserRole, notes?: string): Promise<ServiceResult> {
    try {
      const validatedId = this.validateId(transactionId, 'Transaction ID')

      const transaction = await this.findUnique<LockerTransaction>(
        prisma.lockerTransaction,
        { transaction_id: validatedId },
        { locker: true, user: true },
        'Transaction not found'
      )

      if (transaction.status !== TransactionStatus.ACTIVE) {
        throw new BusinessLogicError('Transaction is not active', 'INVALID_TRANSACTION_STATUS')
      }

      const returnTime = new Date()
      const hoursOverdue = Math.ceil((returnTime.getTime() - transaction.due_time.getTime()) / (1000 * 60 * 60))
      const penaltyConfig = await prisma.penaltyConfig.findFirst({
        where: { type: 'LOCKER', is_active: true }
      })
      const penalty = Math.max(0, hoursOverdue * (Number(penaltyConfig?.penalty_per_hour) || 2))

      await this.executeTransaction(async (tx) => {
        await tx.lockerTransaction.update({
          where: { transaction_id: validatedId },
          data: {
            return_time: returnTime,
            penalty,
            status: TransactionStatus.COMPLETED,
            returned_by: processedBy,
            notes: notes ? `FORCE RETURN: ${notes}` : 'FORCE RETURN',
          }
        })

        await tx.locker.update({
          where: { locker_id: transaction.locker_id },
          data: { status: LockerStatus.AVAILABLE }
        })
      })

      await AuditService.logAction(
        processedBy,
        processedByRole,
        'FORCE_RETURN_LOCKER',
        `Force returned locker: ${transaction.locker?.locker_number} from user ID ${transaction.user_id}`
      )

      return this.handleSuccess(null, 'Locker force returned successfully')
    } catch (error) {
      return this.handleError(error, 'LockerService.forceReturn')
    }
  }

  async getLockerTransactions(filters: SearchFilters): Promise<ServiceResult> {
    try {
      const result = await this.paginate(
        prisma.lockerTransaction,
        filters,
        {
          locker: true,
          user: true,
        }
      )

      return this.handleSuccess(result)
    } catch (error) {
      return this.handleError(error, 'LockerService.getLockerTransactions')
    }
  }

  async getOverdueLockers(): Promise<ServiceResult<LockerTransaction[]>> {
    try {
      const overdueLockers = await this.findMany<LockerTransaction>(
        prisma.lockerTransaction,
        {
          status: TransactionStatus.ACTIVE,
          due_time: { lt: new Date() },
        },
        {
          locker: true,
          user: true,
        },
        { due_time: 'asc' }
      )

      return this.handleSuccess(overdueLockers)
    } catch (error) {
      return this.handleError(error, 'LockerService.getOverdueLockers')
    }
  }

  async getAvailableLockers(): Promise<ServiceResult<Locker[]>> {
    try {
      const availableLockers = await this.findMany<Locker>(
        prisma.locker,
        { status: LockerStatus.AVAILABLE },
        null,
        { locker_number: 'asc' }
      )

      return this.handleSuccess(availableLockers)
    } catch (error) {
      return this.handleError(error, 'LockerService.getAvailableLockers')
    }
  }

  private buildLockerSearchQuery(filters: SearchFilters) {
    const where: any = {}
    
    if (filters.query) {
      where.OR = [
        { locker_number: { contains: filters.query } },
        { location: { contains: filters.query } },
      ]
    }
    
    if (filters.status) {
      where.status = filters.status
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

export const lockerService = new LockerService()
