import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"
import { UserRole, AuthUser } from "@/types"
import { AuditService } from "./services/audit.service"
import { AppError, AccountLockedError, AuthenticationError } from "./errors"
import config from "./config"

const MAX_LOGIN_ATTEMPTS = 5
const LOCK_TIME = 30 * 60 * 1000

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        try {
          const userAccount = await prisma.userAccount.findFirst({
            where: {
              username: credentials.username
            },
            include: {
              user: true
            }
          })

          if (!userAccount || !userAccount.user) {
            await AuditService.logAuth(
              0,
              UserRole.USER,
              'LOGIN_FAILED',
              `Failed login attempt for username: ${credentials.username}`,
              req?.headers?.['x-forwarded-for'] as string || 'unknown',
              req?.headers?.['user-agent'] as string
            )
            return null
          }

          // Check if user account is inactive
          if (!userAccount.is_active) {
            await AuditService.logAuth(
              userAccount.id,
              userAccount.role as UserRole,
              'LOGIN_FAILED',
              'Account is inactive',
              req?.headers?.['x-forwarded-for'] as string || 'unknown',
              req?.headers?.['user-agent'] as string
            )
            throw new AuthenticationError('ACCOUNT_INACTIVE')
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            userAccount.password_hash
          )

          if (!isPasswordValid) {
            await AuditService.logAuth(
              userAccount.id,
              userAccount.role as UserRole,
              'LOGIN_FAILED',
              'Invalid password',
              req?.headers?.['x-forwarded-for'] as string || 'unknown',
              req?.headers?.['user-agent'] as string
            )
            return null
          }

          await prisma.userAccount.update({
            where: { id: userAccount.id },
            data: { last_login: new Date() }
          })

          await AuditService.logAuth(
            userAccount.id,
            userAccount.role as UserRole,
            'LOGIN',
            `Successful login`,
              req?.headers?.['x-forwarded-for'] as string || 'unknown',
            req?.headers?.['user-agent'] as string
          )

          return {
            id: userAccount.id.toString(), // UserAccount.id (for audit logs)
            realUserId: userAccount.user.user_id.toString(), // User.user_id (for notifications)
            email: userAccount.user.email || userAccount.username,
            name: userAccount.user.full_name,
            username: userAccount.username,
            role: userAccount.role as UserRole,
            userType: userAccount.user.user_type,
            accountId: userAccount.user.account_id
          }
        } catch (error) {
          
          if (error instanceof AppError) {
            throw error
          }
          
          if (error instanceof Error && error.message === 'ACCOUNT_INACTIVE') {
            throw error
          }
          
          return null
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: config.getSessionConfig().maxAge,
    updateAge: config.getSessionConfig().updateAge,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.userType = user.userType
        token.username = user.username
        token.accountId = user.accountId
        token.userId = parseInt(user.id) // This is UserAccount.id (for audit logs)
        token.realUserId = user.realUserId ? parseInt(user.realUserId) : undefined // User.user_id (for notifications)
      } else if (token.userId) {
        try {
          const userAccount = await prisma.userAccount.findUnique({
            where: {
              id: token.userId as number,
              is_active: true
            },
            include: {
              user: {
                select: {
                  user_id: true,
                  full_name: true,
                  user_type: true,
                  status: true,
                  account_id: true
                }
              }
            }
          })

          if (!userAccount || !userAccount.user || !userAccount.is_active) {
            return {} as any
          }

          token.role = userAccount.role
          token.name = userAccount.user.full_name
          token.userType = userAccount.user.user_type
          token.username = userAccount.username
          token.accountId = userAccount.user.account_id
          token.realUserId = userAccount.user.user_id
        } catch (error) {
          return {}
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId?.toString() || token.sub!
        session.user.realUserId = token.realUserId?.toString() // User.user_id for notifications
        session.user.role = token.role as string
        session.user.name = token.name as string
        session.user.userType = token.userType as string
        session.user.username = token.username as string
        session.user.accountId = token.accountId as string
      }
      return session
    },
    async signIn({ user, account, profile, email, credentials }) {
      // If user is null, allow NextAuth to handle the error
      if (!user) {
        return false
      }
      return true
    }
  },
  events: {
    async signOut({ token }) {
      if (token?.userId) {
        await AuditService.logAuth(
          token.userId as number,
          token.role as UserRole,
          'LOGOUT',
          'User logged out'
        )
      }
    }
  },
  pages: {
    signIn: "/login",
    error: "/login"
  },
  secret: config.get('NEXTAUTH_SECRET'),
}