'use client'

import { signOut } from 'next-auth/react'
import { Button } from './button'

export function SignOutButton() {
  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' })
  }

  return (
    <Button
      onClick={handleSignOut}
      variant="outline"
      className="w-full"
    >
      <i className="fas fa-sign-out-alt mr-2" aria-hidden="true" />
      Sign Out
    </Button>
  )
}