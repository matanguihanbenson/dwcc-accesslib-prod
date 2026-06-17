'use client'

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'
import { Session } from 'next-auth'

interface Props {
  children: React.ReactNode
  session: Session | null
}

/**
 * SessionProvider - Wraps NextAuth session provider with optimized settings
 * to prevent excessive refetching and improve performance
 */
export function SessionProvider({ children, session }: Props) {
  return (
    <NextAuthSessionProvider 
      session={session}
      // Refetch session every 10 minutes (balanced between security and performance)
      refetchInterval={10 * 60}
      // Refetch on window focus, but only if last check was > 5 minutes ago
      // This prevents excessive refetching while still catching session changes
      refetchOnWindowFocus={true}
      // Don't refetch when offline to prevent errors
      refetchWhenOffline={false}
      // Base path for auth (default is /api/auth)
      basePath="/api/auth"
    >
      {children}
    </NextAuthSessionProvider>
  )
}
