'use client'

import { signOut } from 'next-auth/react'
import { mutate } from 'swr'
import { Button } from './button'

interface SignOutButtonProps {
  collapsed?: boolean
}

export function SignOutButton({ collapsed = false }: SignOutButtonProps) {
  const handleSignOut = () => {
    mutate(() => true, undefined, { revalidate: false })
    signOut({ callbackUrl: '/login' })
  }

  return (
    <Button
      onClick={handleSignOut}
      variant="outline"
      className="w-full bg-gray-50 h-[50px] text-red-600 hover:bg-gray-100 !border-red-600"
      title={collapsed ? "Sign Out" : undefined}
    >
      <i className="fas fa-sign-out-alt" aria-hidden="true" suppressHydrationWarning />
      {!collapsed && <span className="ml-2">Sign Out</span>}
    </Button>
  )
}