'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * Hook for executing protected actions with authentication checks
 */
export function useProtectedAction() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const executeProtectedAction = async (action: () => Promise<void>) => {
    // Check if user is authenticated
    if (status === 'loading') {
      return
    }

    if (status === 'unauthenticated' || !session) {
      router.push('/login')
      return
    }

    // Check if user has appropriate permissions (admin/super_admin)
    const userRole = session.user.role
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      alert('You do not have permission to perform this action.')
      return
    }

    try {
      setIsLoading(true)
      await action()
    } catch (error) {
      alert('An error occurred while performing this action. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return executeProtectedAction
}

/**
 * Hook for checking user status and permissions
 */
export function useUserStatus() {
  const { data: session, status } = useSession()

  const isAuthenticated = status === 'authenticated' && !!session
  const isLoading = status === 'loading'
  const userRole = session?.user?.role

  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'
  const isSuperAdmin = userRole === 'SUPER_ADMIN'
  const isStaff = userRole === 'STAFF' || isAdmin

  return {
    isAuthenticated,
    isLoading,
    userRole,
    isAdmin,
    isSuperAdmin,
    isStaff,
    session
  }
}
