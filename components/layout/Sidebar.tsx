'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { NAVIGATION_ITEMS } from '@/lib/constants'
import { hasPermission } from '@/lib/roles'
import { UserRole, NavigationItem } from '@/types'
import { Icon } from '@/components/ui/icon'
import { SignOutButton } from '@/components/ui/sign-out-button'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  isCollapsed: boolean
  onCollapsedToggle: () => void
}

// Position of the open flyout panel (in viewport coordinates).
interface FlyoutPosition {
  top: number
  left: number
}

export function Sidebar({ isOpen, onToggle, isCollapsed, onCollapsedToggle }: SidebarProps) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const sidebarRef = useRef<HTMLElement | null>(null)

  // Submenus no longer expand inline -- they open as a flyout panel to the
  // right of the sidebar. Track the currently open parent + the trigger
  // element so the flyout can be measured and positioned correctly.
  const [openSubmenu, setOpenSubmenu] = useState<{
    name: string
    triggerEl: HTMLButtonElement
  } | null>(null)
  const [flyoutPos, setFlyoutPos] = useState<FlyoutPosition | null>(null)
  const flyoutRef = useRef<HTMLDivElement | null>(null)

  // Compute the flyout's viewport position based on the trigger element and
  // the sidebar's right edge. Called on open and on scroll/resize so the
  // panel stays anchored to the trigger.
  const updateFlyoutPosition = useCallback((triggerEl: HTMLButtonElement | null = openSubmenu?.triggerEl ?? null) => {
    if (!triggerEl || !sidebarRef.current) return
    const triggerRect = triggerEl.getBoundingClientRect()
    const sidebarRect = sidebarRef.current.getBoundingClientRect()
    setFlyoutPos({ top: triggerRect.top, left: sidebarRect.right })
  }, [openSubmenu])

  // Close flyout on outside click, Escape, scroll, or resize.
  useEffect(() => {
    if (!openSubmenu) return
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (openSubmenu.triggerEl.contains(target)) return
      if (flyoutRef.current?.contains(target)) return
      setOpenSubmenu(null)
      setFlyoutPos(null)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenSubmenu(null)
        setFlyoutPos(null)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKey)
    window.addEventListener('scroll', () => updateFlyoutPosition(), true)
    window.addEventListener('resize', () => updateFlyoutPosition())
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', () => updateFlyoutPosition(), true)
      window.removeEventListener('resize', () => updateFlyoutPosition())
    }
  }, [openSubmenu, updateFlyoutPosition])

  // Close flyout when the route changes.
  useEffect(() => {
    setOpenSubmenu(null)
    setFlyoutPos(null)
  }, [pathname])

  if (!session) return null

  const userRole = session.user.role as UserRole

  const filteredNavItems = NAVIGATION_ITEMS.filter(item =>
    hasPermission(userRole, item.roles)
  )

  const handleParentClick = (item: NavigationItem, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (openSubmenu?.name === item.name) {
      setOpenSubmenu(null)
      setFlyoutPos(null)
      return
    }
    setOpenSubmenu({ name: item.name, triggerEl: e.currentTarget })
    // Compute position immediately so the flyout doesn't appear in the
    // wrong spot for a frame.
    const sidebarRect = sidebarRef.current?.getBoundingClientRect()
    const triggerRect = e.currentTarget.getBoundingClientRect()
    if (sidebarRect) {
      setFlyoutPos({ top: triggerRect.top, left: sidebarRect.right })
    }
  }

  const renderNavItem = (item: NavigationItem) => {
    const hasChildren = item.children && item.children.length > 0
    const isActive = pathname === item.href || (hasChildren && item.children?.some(child => pathname === child.href))
    const isOpen = openSubmenu?.name === item.name

    return (
      <div key={item.name} className="mb-1">
        {hasChildren ? (
          <button
            onClick={(e) => handleParentClick(item, e)}
            className={cn(
              'w-full flex items-center rounded-lg transition-colors duration-150',
              'hover:bg-blue-50 hover:text-blue-700',
              isActive || isOpen
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-gray-700',
              isCollapsed ? 'justify-center px-3 py-2' : 'justify-between px-3 py-2 text-left'
            )}
            title={isCollapsed ? item.name : undefined}
            aria-expanded={isOpen}
          >
            <div className={cn('flex items-center', isCollapsed ? 'justify-center' : 'space-x-3')}>
              <Icon name={item.icon} size={isCollapsed ? 'lg' : 'md'} />
              {!isCollapsed && <span className="text-sm">{item.name}</span>}
            </div>
            {!isCollapsed && (
              <Icon
                name="fa-chevron-right"
                size="xs"
                className="text-gray-400"
              />
            )}
          </button>
        ) : (
          <Link
            href={item.href}
            className={cn(
              'flex items-center rounded-lg transition-colors duration-150',
              'hover:bg-blue-50 hover:text-blue-700',
              isActive ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700',
              isCollapsed ? 'justify-center px-3 py-2' : 'space-x-3 px-3 py-2'
            )}
            title={isCollapsed ? item.name : undefined}
          >
            <Icon name={item.icon} size={isCollapsed ? 'lg' : 'md'} />
            {!isCollapsed && <span className="text-sm">{item.name}</span>}
          </Link>
        )}
      </div>
    )
  }

  // The currently open flyout content. Rendered via portal so it can
  // overlay the main content area and isn't clipped by any overflow on
  // the sidebar's ancestors.
  const openParent = openSubmenu
    ? filteredNavItems.find(item => item.name === openSubmenu.name)
    : null
  const flyoutChildren = openParent?.children?.filter(child =>
    hasPermission(userRole, child.roles)
  ) || []

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        ref={sidebarRef}
        className={cn(
          'fixed top-0 left-0 z-30 h-full bg-white border-r border-gray-200 transition-all duration-300 ease-in-out',
          'lg:translate-x-0',
          isCollapsed ? 'w-16' : 'w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          <div className={cn(
            'flex items-center border-b border-gray-200 transition-all duration-300',
            isCollapsed ? 'justify-center p-3' : 'justify-between p-4'
          )}>
            {isCollapsed ? (
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center p-1.5">
                <img
                  src="/logo-dwcc.png"
                  alt="DWCC Logo"
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center p-1.5">
                    <img
                      src="/logo-dwcc.png"
                      alt="DWCC Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-900">AccessLib</h1>
                    <p className="text-xs text-gray-500">DWCC Library</p>
                  </div>
                </div>
                <button
                  onClick={onToggle}
                  className="lg:hidden p-2 rounded-md hover:bg-gray-100"
                >
                  <Icon name="fa-times" size="md" />
                </button>
              </>
            )}
          </div>

          <nav className={cn(
            'flex-1 overflow-y-auto transition-all duration-300',
            isCollapsed ? 'px-2 py-3 space-y-1' : 'px-3 py-3 space-y-1'
          )}>
            {filteredNavItems.map(item => renderNavItem(item))}
          </nav>

          <div className={cn(
            'border-t border-gray-200 transition-all duration-300',
            isCollapsed ? 'p-2' : 'p-3'
          )}>
            <div className={cn(
              'mb-3 bg-gray-50 rounded-lg transition-all duration-300',
              isCollapsed ? 'p-2' : 'p-3'
            )}>
              {isCollapsed ? (
                <div className="flex justify-center">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {session.user.name?.charAt(0) || 'U'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {session.user.name?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {session.user.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {session.user.role?.replace('_', ' ') || 'Unknown Role'}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <SignOutButton collapsed={isCollapsed} />
          </div>
        </div>
      </aside>

      {/* Flyout panel for the open submenu. Portalled so it overlays the
          main content instead of being clipped by the sidebar's ancestors. */}
      {openSubmenu && flyoutPos && openParent && typeof document !== 'undefined' && createPortal(
        <div
          ref={flyoutRef}
          style={{
            position: 'fixed',
            top: flyoutPos.top,
            left: flyoutPos.left,
          }}
          className="z-40 w-56 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
          role="menu"
        >
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {openParent.name}
            </p>
          </div>
          <div className="p-1 max-h-80 overflow-y-auto">
            {flyoutChildren.length === 0 ? (
              <p className="text-xs text-gray-400 px-3 py-2">No items available</p>
            ) : (
              flyoutChildren.map(child => {
                const childActive = pathname === child.href
                return (
                  <Link
                    key={child.name}
                    href={child.href}
                    className={cn(
                      'flex items-center space-x-3 px-3 py-2 rounded-md text-sm transition-colors',
                      childActive
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    )}
                    role="menuitem"
                  >
                    <Icon name={child.icon} size="sm" />
                    <span className="truncate">{child.name}</span>
                  </Link>
                )
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
