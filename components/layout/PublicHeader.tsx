'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'

interface PublicHeaderProps {
  showSubtitle?: boolean
  subtitle?: string
  showBrowseLink?: boolean
}

export function PublicHeader({ showSubtitle = false, subtitle, showBrowseLink = false }: PublicHeaderProps) {
  const { data: session, status } = useSession()

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side - Title and optional subtitle or browse link */}
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-2xl font-bold text-gray-900 hover:text-green-600 transition-colors">
              DWCC AccessLib
            </Link>
            {showSubtitle && subtitle && (
              <>
                <span className="text-gray-500">|</span>
                <span className="text-gray-700 font-medium">{subtitle}</span>
              </>
            )}
            {showBrowseLink && (
              <>
                <span className="text-gray-500">|</span>
                <Link href="/browse" className="text-gray-700 font-medium hover:text-green-600 transition-colors">
                  Browse Books
                </Link>
              </>
            )}
          </div>
          
          {/* Right side - Login/User info */}
          <div>
            {status === 'loading' ? (
              <div className="w-24 h-9 bg-gray-200 animate-pulse rounded-md"></div>
            ) : session ? (
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{session.user?.name}</p>
                  <p className="text-xs text-gray-600">{session.user?.role}</p>
                </div>
                <div className="flex space-x-2">
                  <Link
                    href="/dashboard"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center"
                  >
                    <i className="fas fa-tachometer-alt mr-2"></i>
                    Dashboard
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center"
                  >
                    <i className="fas fa-sign-out-alt mr-2"></i>
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <Link
                href="/login"
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center"
              >
                <i className="fas fa-sign-in-alt mr-2"></i>
                Staff Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
