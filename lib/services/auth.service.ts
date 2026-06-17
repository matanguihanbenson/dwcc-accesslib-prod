import { BaseService } from './base.service'
import { AuthUser, LoginCredentials, ServiceResult, JWTPayload } from '@/types'
import { signIn, signOut, getSession } from 'next-auth/react'
import { Session } from 'next-auth'

class AuthService extends BaseService {
  constructor() {
    super()
  }

  /**
   * Login with credentials
   */
  async login(credentials: LoginCredentials): Promise<ServiceResult<AuthUser>> {
    try {
      const result = await signIn('credentials', {
        username: credentials.username,
        password: credentials.password,
        redirect: false,
      })

      if (result?.error) {
        return {
          success: false,
          error: 'Invalid credentials',
          message: 'Username or password is incorrect',
        }
      }

      // Get the session after successful login
      const session = await getSession()
      if (session?.user) {
        return {
          success: true,
          data: session.user as AuthUser,
          message: 'Login successful',
        }
      }

      return {
        success: false,
        error: 'Session creation failed',
      }
    } catch (error) {
      console.error('Login error:', error)
      return {
        success: false,
        error: 'Login failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<ServiceResult<void>> {
    try {
      await signOut({ redirect: false })
      return {
        success: true,
        message: 'Logout successful',
      }
    } catch (error) {
      console.error('Logout error:', error)
      return {
        success: false,
        error: 'Logout failed',
      }
    }
  }

  /**
   * Get current session
   */
  async getCurrentSession(): Promise<ServiceResult<Session | null>> {
    try {
      const session = await getSession()
      return {
        success: true,
        data: session,
      }
    } catch (error) {
      console.error('Get session error:', error)
      return {
        success: false,
        error: 'Failed to get session',
      }
    }
  }

  /**
   * Refresh user data from database
   */
  async refreshUserData(): Promise<ServiceResult<AuthUser>> {
    try {
      const session = await getSession()
      if (!session?.user) {
        return {
          success: false,
          error: 'No active session found'
        }
      }

      return {
        success: true,
        data: session.user as AuthUser
      }
    } catch (error) {
      return this.handleError(error, 'refreshUserData')
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(): Promise<ServiceResult<AuthUser>> {
    try {
      const session = await getSession()
      if (!session?.user) {
        return {
          success: false,
          error: 'No active session found'
        }
      }

      return {
        success: true,
        data: session.user as AuthUser
      }
    } catch (error) {
      return this.handleError(error, 'getUserProfile')
    }
  }

  /**
   * Validate JWT token
   */
  async validateToken(token: string): Promise<ServiceResult<JWTPayload>> {
    try {
      // This would typically validate the JWT token
      // For now, return a mock implementation
      return {
        success: false,
        error: 'Token validation not implemented'
      }
    } catch (error) {
      return this.handleError(error, 'validateToken')
    }
  }
}

// Create singleton instance
export const authService = new AuthService()
export default authService
