'use client'

import { signOut } from 'next-auth/react'
import { Button } from './button'

interface SignOutButtonProps {
  collapsed?: boolean
}

export function SignOutButton({ collapsed = false }: SignOutButtonProps) {
  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' })
  }

  return (
    <Button
      onClick={handleSignOut}
      variant="outline"
      className="w-full"
      title={collapsed ? "Sign Out" : undefined}
    >
      <i className="fas fa-sign-out-alt" aria-hidden="true" suppressHydrationWarning />
      {!collapsed && <span className="ml-2">Sign Out</span>}
    </Button>
  )
}