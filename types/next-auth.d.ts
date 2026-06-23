import { DefaultSession, DefaultUser } from "next-auth"
import { DefaultJWT } from "next-auth/jwt"
import { UserRole, UserType, Campus } from './index'

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      realUserId?: string
      role: string
      userType: string
      username: string
      accountId: string
      // Current campus designation for STAFF accounts. NULL for
      // ADMIN / SUPER_ADMIN. Refreshed on each session refresh so
      // re-designations take effect without forcing a re-login.
      campus?: Campus | null
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    realUserId?: string
    role: string
    userType: string
    username: string
    accountId: string
    campus?: Campus | null
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    userId?: number
    realUserId?: number
    role: string
    userType: string
    username: string
    accountId: string
    campus?: Campus | null
  }
}
