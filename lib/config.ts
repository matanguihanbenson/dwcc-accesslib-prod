import type { AppConfig } from '@/types'
import logger from './logger'

/**
 * Validate required environment variables
 */
function validateEnv(): AppConfig {
  const requiredVars = {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NODE_ENV: process.env.NODE_ENV || 'development',
  }

  const missingVars: string[] = []
  
  for (const [key, value] of Object.entries(requiredVars)) {
    if (!value && key !== 'NODE_ENV') {
      missingVars.push(key)
    }
  }

  if (missingVars.length > 0) {
    const error = new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`
    )
    logger.error('Environment validation failed', error)
    throw error
  }

  // Validate NODE_ENV
  const validEnvs = ['development', 'production', 'test'] as const
  if (!validEnvs.includes(requiredVars.NODE_ENV as any)) {
    requiredVars.NODE_ENV = 'development'
    logger.warn('Invalid NODE_ENV, defaulting to development', {
      providedEnv: process.env.NODE_ENV,
      defaultedTo: 'development',
    })
  }

  return requiredVars as AppConfig
}

/**
 * Application configuration
 */
class Config {
  private static instance: Config
  private config: AppConfig

  private constructor() {
    this.config = validateEnv()
    logger.info('Environment configuration loaded', {
      nodeEnv: this.config.NODE_ENV,
      databaseUrl: this.config.DATABASE_URL ? '***HIDDEN***' : 'NOT_SET',
      jwtSecret: this.config.JWT_SECRET ? '***HIDDEN***' : 'NOT_SET',
      nextAuthSecret: this.config.NEXTAUTH_SECRET ? '***HIDDEN***' : 'NOT_SET',
      nextAuthUrl: this.config.NEXTAUTH_URL,
    })
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config()
    }
    return Config.instance
  }

  public get(key: keyof AppConfig): string {
    const value = this.config[key]
    if (value === undefined) {
      throw new Error(`Configuration key '${key}' is not defined`)
    }
    return String(value)
  }

  public getAll(): AppConfig {
    return { ...this.config }
  }

  public isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development'
  }

  public isProduction(): boolean {
    return this.config.NODE_ENV === 'production'
  }

  public isTest(): boolean {
    return this.config.NODE_ENV === 'test'
  }

  /**
   * Database connection configuration
   */
  public getDatabaseConfig() {
    return {
      url: this.config.DATABASE_URL,
      // Add connection pool settings for production
      connectionLimit: this.isProduction() ? 20 : 5,
      acquireTimeout: 30000,
      timeout: 60000,
    }
  }

  /**
   * Session configuration
   */
  public getSessionConfig() {
    return {
      maxAge: this.isProduction() ? 24 * 60 * 60 : 30 * 60, // 24 hours in prod, 30 min in dev
      updateAge: this.isProduction() ? 24 * 60 * 60 : 5 * 60, // Update frequency
      secret: this.config.NEXTAUTH_SECRET,
    }
  }

  /**
   * JWT configuration
   */
  public getJwtConfig() {
    return {
      secret: this.config.JWT_SECRET,
      expiresIn: this.isProduction() ? '24h' : '30m',
      algorithm: 'HS256' as const,
    }
  }
}

// Create singleton instance
const config = Config.getInstance()

export default config
export { Config }
