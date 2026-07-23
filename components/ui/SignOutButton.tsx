'use client'

import { signOut } from 'next-auth/react'
import { mutate } from 'swr'
import { Button } from './button'

export function SignOutButton() {
  const handleSignOut = () => {
    mutate(() => true, undefined, { revalidate: false })
    signOut({ callbackUrl: '/login' })
  }

  return (
    <Button
      onClick={handleSignOut}
      variant="outline"
      className="w-full !text-red-600 border-red-600"
    >
      <i className="fas fa-sign-out-alt mr-2" aria-hidden="true" />
      Sign Out
    </Button>
  )
}