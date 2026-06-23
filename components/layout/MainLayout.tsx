'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { NotificationDropdown } from './NotificationDropdown'
import { EditProfileModal } from '@/components/modals/EditProfileModal'
import { ChangePasswordModal } from '@/components/modals/ChangePasswordModal'
import { cn } from '@/lib/utils'
import { useLocalStorage } from '@/lib/hooks/useLocalStorage'
import { Icon } from '@/components/ui/icon'
import { Badge } from '@/components/ui/badge'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useLocalStorage('sidebar-collapsed', false)

  // Dropdown + modal state
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)

  const profileMenuRef = useRef<HTMLDivElement | null>(null)

  // Close the dropdown on outside click / Escape
  useEffect(() => {
    if (!profileMenuOpen) return
    const onMouseDown = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileMenuOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [profileMenuOpen])

  // Refresh session only once per user change to avoid infinite refresh loops
  const lastUserIdRef = useRef<string | undefined>(undefined)
  const refreshedForUserRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      const currentId = session.user.id
      if (!refreshedForUserRef.current.has(currentId)) {
        refreshedForUserRef.current.add(currentId)
        lastUserIdRef.current = currentId
        update().catch(() => {})
      }
    }
  }, [status, session?.user?.id, update])

  const userRole = session?.user?.role
  const userName = session?.user?.name || session?.user?.username || 'User'
  const roleLabel = (userRole || '').replace('_', ' ')

  // Quick actions defined per role. Each item has an icon, label and href
  // so the buttons render identically: leading icon + visible label.
  type QuickAction = { icon: string; label: string; href: string }
  const quickActions: QuickAction[] = []
  if (userRole === 'ADMIN' || userRole === 'STAFF') {
    quickActions.push({ icon: 'fa-plus', label: 'Add Book', href: '/books/add' })
  }
  if (userRole === 'ADMIN') {
    quickActions.push({ icon: 'fa-chart-bar', label: 'Reports', href: '/reports' })
  }
  if (userRole === 'ADMIN' || userRole === 'STAFF') {
    quickActions.push({ icon: 'fa-door-open', label: 'Entry Monitoring', href: '/entry-monitoring' })
  }

  // Profile dropdown menu handlers
  const openEditProfile = () => {
    setProfileMenuOpen(false)
    setEditProfileOpen(true)
  }
  const openChangePassword = () => {
    setProfileMenuOpen(false)
    setChangePasswordOpen(true)
  }
  const handleViewProfile = () => {
    setProfileMenuOpen(false)
    router.push('/profile')
  }
  const handleSignOut = () => {
    setProfileMenuOpen(false)
    signOut({ callbackUrl: '/login' })
  }

  const initials = (userName || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('') || '?'

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        isCollapsed={isCollapsed}
        onCollapsedToggle={() => setIsCollapsed(!isCollapsed)}
      />

      <div className={cn(
        'transition-all duration-300',
        isCollapsed ? 'lg:ml-16' : 'lg:ml-64'
      )}>
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left cluster — mobile toggle, sidebar collapse, welcome */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-md hover:bg-gray-100"
                aria-label="Open sidebar"
              >
                <Icon name="fa-bars" size="md" />
              </button>

              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="hidden lg:flex p-2 rounded-md hover:bg-gray-100"
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <Icon name={isCollapsed ? 'fa-angles-right' : 'fa-angles-left'} size="md" />
              </button>

              {session?.user && (
                <div className="hidden md:block min-w-0">
                  <p className="text-sm text-gray-600">
                    Welcome back,{' '}
                    <span className="font-medium text-gray-900">{userName}</span>
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">{roleLabel}</Badge>
                    <span className="text-xs text-gray-500">•</span>
                    <span className="text-xs text-gray-500">
                      {new Date().toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Center — quick actions, each with icon + label */}
            {quickActions.length > 0 && (
              <div className="hidden lg:flex items-center gap-1.5 flex-1 justify-center">
                {quickActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-colors"
                  >
                    <Icon name={action.icon} size="xs" />
                    <span>{action.label}</span>
                  </Link>
                ))}
              </div>
            )}

            {/* Right cluster — notifications + profile dropdown */}
            <div className="flex items-center gap-2">
              <NotificationDropdown userId={session?.user?.id} />

              {session?.user && (
                <div className="relative" ref={profileMenuRef}>
                  <button
                    type="button"
                    onClick={() => setProfileMenuOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={profileMenuOpen}
                    className={cn(
                      'flex items-center gap-2 pl-1 pr-2 py-1 rounded-md transition-colors',
                      profileMenuOpen ? 'bg-gray-100' : 'hover:bg-gray-100'
                    )}
                  >
                    <span className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-semibold shrink-0">
                      {initials}
                    </span>
                    <div className="hidden sm:flex flex-col items-start leading-tight min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate max-w-[140px]">
                        {userName}
                      </span>
                      <span className="text-[11px] text-gray-500 truncate max-w-[140px]">
                        {roleLabel}
                      </span>
                    </div>
                    <Icon name="fa-chevron-down" size="xs" className="text-gray-500" />
                  </button>

                  {profileMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden z-40"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleViewProfile}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                      >
                        <Icon name="fa-id-badge" size="sm" className="text-gray-500" />
                        <span>View profile</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={openEditProfile}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                      >
                        <Icon name="fa-user-pen" size="sm" className="text-gray-500" />
                        <span>Edit profile</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={openChangePassword}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                      >
                        <Icon name="fa-key" size="sm" className="text-gray-500" />
                        <span>Change password</span>
                      </button>
                      <div className="border-t border-gray-100 my-0" />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
                      >
                        <Icon name="fa-sign-out-alt" size="sm" className="text-red-500" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="p-6">
          {children}
        </main>
      </div>

      {/* Profile dropdown modals */}
      <EditProfileModal
        isOpen={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
      />
      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </div>
  )
}
