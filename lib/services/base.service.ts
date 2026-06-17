import { ServiceResult, SearchFilters } from '@/types'
import { validatePagination, buildSearchQuery, buildOrderBy, createPaginationResponse } from '@/lib/utils'
import { AppError, createErrorFromPrisma, logError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

export abstract class BaseService {
  protected handleError(error: any, context: string): ServiceResult {
    logError(error, context)
    
    if (error instanceof AppError) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      }
    }
    
    if (error.code?.startsWith('P')) {
      const appError = createErrorFromPrisma(error)
      return {
        success: false,
        error: appError.message,
        code: appError.code,
      }
    }
    
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: 'SERVER_ERROR',
    }
  }

  protected handleSuccess<T>(data?: T, message?: string): ServiceResult<T> {
    return {
      success: true,
      data,
      message,
    }
  }

  protected async paginate<T>(
    model: any,
    filters: SearchFilters,
    include?: any,
    customWhere?: any
  ) {
    const { page, limit } = validatePagination(filters.page, filters.limit)
    const skip = (page - 1) * limit
    
    const where = customWhere || buildSearchQuery(filters)
    const orderBy = buildOrderBy(filters.sortBy, filters.sortOrder)
    
    // Execute queries in parallel for better performance
    const [items, total] = await Promise.all([
      model.findMany({
        where,
        include,
        orderBy,
        skip,
        take: limit,
      }),
      model.count({ where }),
    ])
    
    return createPaginationResponse(items, total, page, limit)
  }

  protected async paginateOptimized<T>(
    model: any,
    filters: SearchFilters,
    selectFields?: any,
    customWhere?: any,
    customOrderBy?: any
  ) {
    const { page, limit } = validatePagination(filters.page, filters.limit)
    const skip = (page - 1) * limit
    
    const where = customWhere || buildSearchQuery(filters)
    const orderBy = customOrderBy || buildOrderBy(filters.sortBy, filters.sortOrder)
    
    // Use select instead of include for better performance when possible
    const queryOptions: any = {
      where,
      orderBy,
      skip,
      take: limit,
    }
    
    if (selectFields) {
      queryOptions.select = selectFields
    }
    
    // Execute queries in parallel for better performance
    const [items, total] = await Promise.all([
      model.findMany(queryOptions),
      model.count({ where }),
    ])
    
    return createPaginationResponse(items, total, page, limit)
  }

  protected async findUnique<T>(
    model: any,
    where: any,
    include?: any,
    errorMessage?: string
  ): Promise<T> {
    const result = await model.findUnique({
      where,
      include,
    })
    
    if (!result) {
      throw new AppError(errorMessage || 'Record not found', 'NOT_FOUND', 404)
    }
    
    return result
  }

  protected async findMany<T>(
    model: any,
    where?: any,
    include?: any,
    orderBy?: any
  ): Promise<T[]> {
    return await model.findMany({
      where,
      include,
      orderBy,
    })
  }

  protected async create<T>(
    model: any,
    data: any,
    include?: any
  ): Promise<T> {
    return await model.create({
      data,
      include,
    })
  }

  protected async update<T>(
    model: any,
    where: any,
    data: any,
    include?: any
  ): Promise<T> {
    return await model.update({
      where,
      data,
      include,
    })
  }

  protected async delete<T>(
    model: any,
    where: any
  ): Promise<T> {
    return await model.delete({
      where,
    })
  }

  protected async executeTransaction<T>(
    operations: (tx: any) => Promise<T>
  ): Promise<T> {
    return await prisma.$transaction(operations)
  }

  protected async exists(
    model: any,
    where: any
  ): Promise<boolean> {
    const count = await model.count({ where })
    return count > 0
  }

  protected sanitizeUpdateData<T extends Record<string, any>>(
    data: T,
    allowedFields: (keyof T)[]
  ): Partial<T> {
    const sanitized: Partial<T> = {}
    
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        sanitized[field] = data[field]
      }
    }
    
    return sanitized
  }

  protected validateId(id: any, fieldName: string = 'ID'): number {
    const numId = parseInt(id)
    if (isNaN(numId) || numId <= 0) {
      throw new AppError(`Invalid ${fieldName}`, 'VALIDATION_ERROR', 400)
    }
    return numId
  }

  protected validateOptionalId(id?: any, fieldName: string = 'ID'): number | undefined {
    if (id === undefined || id === null) return undefined
    return this.validateId(id, fieldName)
  }
}