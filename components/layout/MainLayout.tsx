'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Sidebar } from './Sidebar'
import { NotificationDropdown } from './NotificationDropdown'
import { cn } from '@/lib/utils'
import { useLocalStorage } from '@/lib/hooks/useLocalStorage'
import { Icon } from '@/components/ui/icon'
import { Badge } from '@/components/ui/badge'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const { data: session, status, update } = useSession()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useLocalStorage('sidebar-collapsed', false)

  // The root element is intentionally never swapped. Hiding the chrome
  // (sidebar + header) is done via CSS rules in globals.css driven by the
  // `entry-monitoring-fullscreen` body class. Keeping the tree stable is
  // critical -- swapping the root (e.g. div <-> main) causes React to
  // unmount/remount the children, which would wipe the page's state
  // (e.g. recent entries list on the entry-monitoring staff view).

  // Refresh session only once per user change to avoid infinite refresh loops
  const lastUserIdRef = useRef<string | undefined>(undefined)
  const refreshedForUserRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      const currentId = session.user.id
      // If user changed (logout -> login different) or first mount for this user, refresh once
      if (!refreshedForUserRef.current.has(currentId)) {
        refreshedForUserRef.current.add(currentId)
        lastUserIdRef.current = currentId
        // Fire and forget; no loop because subsequent renders are guarded
        update().catch(() => {})
      }
    }
  }, [status, session?.user?.id, update])

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
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-md hover:bg-gray-100"
              >
                <Icon name="fa-bars" size="md" />
              </button>
              
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="hidden lg:flex p-2 rounded-md hover:bg-gray-100"
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <Icon name={isCollapsed ? "fa-angles-right" : "fa-angles-left"} size="md" />
              </button>

              {/* Welcome message for larger screens */}
              {session?.user && (
                <div className="hidden md:block">
                  <p className="text-sm text-gray-600">
                    Welcome back, <span className="font-medium text-gray-900">{session.user.name}</span>
                  </p>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {session.user.role?.replace('_', ' ')}
                    </Badge>
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
            
            {/* Center area intentionally left minimal after removing search */}
            <div className="hidden md:flex flex-1 mx-8" />
            
            <div className="flex items-center space-x-3">
              {/* Quick Actions for different roles */}
              {session?.user?.role && (
                <div className="hidden lg:flex items-center space-x-2">
                  {/* Add Book: ADMIN, STAFF */}
                  {['ADMIN', 'STAFF'].includes(session.user.role) && (
                    <button 
                      className="p-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
                      title="Quick Add Book"
                      onClick={() => window.location.href = '/books/add'}
                    >
                      <Icon name="fa-plus" size="sm" />
                    </button>
                  )}
                  {/* Reports: ADMIN only */}
                  {['ADMIN'].includes(session.user.role) && (
                    <button 
                      className="p-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
                      title="View Reports"
                      onClick={() => window.location.href = '/reports'}
                    >
                      <Icon name="fa-chart-bar" size="sm" />
                    </button>
                  )}
                </div>
              )}

              {/* Notification dropdown */}
              <NotificationDropdown userId={session?.user?.id} />

              {/* User profile button */}
              {session?.user && (
                <button 
                  className="p-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
                  title="User Profile"
                  onClick={() => window.location.href = '/profile'}
                >
                  <Icon name="fa-user" size="md" />
                </button>
              )}
            </div>
          </div>

          {/* Search removed */}
        </header>

        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
