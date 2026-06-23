'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { EditProfileModal } from '@/components/modals/EditProfileModal'
import { ChangePasswordModal } from '@/components/modals/ChangePasswordModal'

interface User {
  id: string
  account_id: string
  name: string
  email: string
  contact_number?: string
  role: string
  avatar?: string
}

function Profile() {
  const { status } = useSession()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/users/profile', {
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setUser(data.data)
          } else {
            console.error('Profile fetch failed:', data.message)
            router.push('/login')
          }
        } else {
          console.error('Profile fetch failed with status:', response.status)
          router.push('/login')
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    if (status !== 'loading') {
      fetchProfile()
    }
  }, [status, router])

  if (loading || status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <div className="text-sm text-gray-500">Loading profile…</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const initials = (user.name || user.id).trim().charAt(0).toUpperCase()
  const roleLabel = user.role?.replace('_', ' ') || 'User'

  return (
    <div className="min-h-screen bg-gray-50/60">
      <div className="px-4 sm:px-6 lg:px-8 py-10">
        {/* Header card: solid white, thin top accent stripe (blue-700) instead
            of a full gradient, plain avatar with no decorative ring/online-dot. */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="h-1 bg-blue-700" />
          <div className="px-6 sm:px-8 py-6 sm:py-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div className="flex items-center gap-5 min-w-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-900 text-white flex items-center justify-center text-2xl sm:text-3xl font-semibold shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 truncate">
                    {user.name || user.id}
                  </h1>
                  <p className="text-sm text-gray-500 mt-0.5">@{user.id}</p>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                      {roleLabel}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons live ONLY in the header. No duplicated
                  "Quick Actions" card. */}
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowUpdateModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Edit profile
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
                >
                  Change password
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Two info cards side-by-side: solid white, plain border, no
            gradient headers. Each field is a label/value pair with a
            bottom divider (clean definition-list style). */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InfoCard title="Personal information">
            <InfoRow label="Full name" value={user.name} />
            <InfoRow label="ID number" value={user.account_id} mono />
            <InfoRow label="Email" value={user.email} fallback="Not provided" />
            <InfoRow
              label="Contact number"
              value={user.contact_number}
              fallback="Not provided"
              last
            />
          </InfoCard>

          <InfoCard title="Account">
            <InfoRow label="Username" value={user.id} mono />
            <InfoRow label="Role" value={roleLabel} />
            <InfoRow
              label="Status"
              value={
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              }
              last
            />
          </InfoCard>
        </div>
      </div>

      {/* Modals — now reusable components in /components/modals. */}
      <EditProfileModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onSaved={(updated) => setUser(updated)}
      />
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </div>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{title}</h2>
      </div>
      <dl className="px-6 py-2">{children}</dl>
    </section>
  )
}

function InfoRow({
  label,
  value,
  fallback = '—',
  mono = false,
  last = false,
}: {
  label: string
  value?: React.ReactNode
  fallback?: React.ReactNode
  mono?: boolean
  last?: boolean
}) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-3 ${last ? '' : 'border-b border-gray-100'}`}>
      <dt className="text-sm text-gray-500 shrink-0">{label}</dt>
      <dd className={`text-sm text-gray-900 text-right ${mono ? 'font-mono' : ''} truncate`}>
        {value || <span className="text-gray-400">{fallback}</span>}
      </dd>
    </div>
  )
}

export default Profile
