import { DefaultSession, DefaultUser } from "next-auth"
import { DefaultJWT } from "next-auth/jwt"
import { UserRole, UserType } from './index'

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      realUserId?: string
      role: string
      userType: string
      username: string
      accountId: string
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    realUserId?: string
    role: string
    userType: string
    username: string
    accountId: string
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
  }
}
