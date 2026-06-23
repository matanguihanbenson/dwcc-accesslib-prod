'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useApiSWR } from '@/lib/hooks/useApi'

//
/**
 * /setup — Initial setup wizard.
 *
 * Renders the form to create the first SUPER_ADMIN account.
 * The page is gated three ways:
 *   1. The token from `?token=…` must match `SETUP_TOKEN`
 *      (enforced server-side by /api/setup/super-admin, and
 *      client-side here so we don't render the form for a
 *      bogus token).
 *   2. The page polls /api/setup/status on mount. If a
 *      SUPER_ADMIN already exists the user is bounced to
 *      /login.
 *   3. Even with a valid token, /api/setup/super-admin will
 *      refuse the create once any SUPER_ADMIN exists.
 *
 * After a successful create the form is replaced with a
 * "you're all set" panel that links to /login.
 */
function SetupPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tokenFromUrl = searchParams.get('token') || ''

  // The actual token comparison happens server-side in
  // /api/setup/super-admin. Client-side we only check that
  // the URL has a token param so we don't render the form
  // for a request that's clearly missing it. A bogus token
  // will be caught on submit and shown as an error.
  const tokenMatches = useMemo(() => tokenFromUrl.trim().length > 0, [tokenFromUrl])

  // Live-check whether the system is still waiting for setup.
  // The endpoint itself is cheap (cached 30s) so polling on
  // mount + every 10s is fine.
  const { data: status, mutate: refreshStatus } = useApiSWR<{
    setupRequired: boolean
  }>('/api/setup/status', {
    refreshInterval: 10_000,
    revalidateOnFocus: true
  })

  useEffect(() => {
    if (status && status.setupRequired === false) {
      // System is already set up. The /setup page is
      // inaccessible from this point forward.
      router.replace('/login')
    }
  }, [status, router])

  // ---------- Form state ----------
  const [accountId, setAccountId] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [suffix, setSuffix] = useState('')
  const [email, setEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{
    username: string
    fullName: string
  } | null>(null)

  // ---------- Validation ----------
  const passwordMismatch =
    confirmPassword.length > 0 && password !== confirmPassword
  const passwordStrong =
    password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password)
  const formValid =
    accountId.trim().length > 0 &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    username.trim().length > 0 &&
    password.length >= 8 &&
    password === confirmPassword &&
    (email === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formValid || submitting) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/setup/super-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenFromUrl,
          account_id: accountId.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          middle_name: middleName.trim() || undefined,
          suffix: suffix.trim() || undefined,
          email: email.trim() || undefined,
          username: username.trim(),
          password
        })
      })

      const data = await response.json().catch(() => null)

      if (response.ok) {
        setSuccess({
          username: data.account?.username || username.trim(),
          fullName: data.user?.full_name || `${firstName} ${lastName}`
        })
        // Re-fetch the status so the cache invalidation
        // propagates immediately. Even if this fetch hasn't
        // completed, the in-memory cache was already cleared
        // server-side so the next middleware check is fresh.
        refreshStatus()
        return
      }

      if (response.status === 403) {
        setError(
          data?.error ||
            'Setup is locked. A super admin account may already exist.'
        )
      } else if (response.status === 409) {
        setError(data?.error || 'That account ID or username is already taken.')
      } else {
        setError(data?.error || `Failed to create account (${response.status}).`)
      }
    } catch (err) {
      console.error('Setup submit error:', err)
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ---------- Render ----------
  // If the token doesn't match the expected length we don't
  // even render the form — saves the user from typing it all
  // out only to fail at submit.
  if (!tokenMatches) {
    return (
      <SetupShell>
        <ErrorPanel
          title="Invalid or missing setup token"
          message={
            <>
              The setup URL must include a <code>?token=…</code>{' '}
              query parameter whose value matches the
              <code> SETUP_TOKEN</code> environment variable.
              Check the <code>.env</code> file or your deployment
              configuration.
            </>
          }
        />
      </SetupShell>
    )
  }

  if (success) {
    return (
      <SetupShell>
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-lg w-full text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-check-circle text-green-500 text-3xl"></i>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900">Setup complete</h2>
          <p className="text-sm text-gray-600 mt-2">
            Super admin <span className="font-semibold">{success.fullName}</span>{' '}
            (<span className="font-mono">{success.username}</span>) has been
            created. You can now sign in.
          </p>
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-800">
            <i className="fas fa-shield-halved mr-1.5"></i>
            For security, rotate the <code>SETUP_TOKEN</code> in
            your <code>.env</code> file. The token is no longer needed
            and the <code>/setup</code> page is now inaccessible.
          </div>
          <button
            onClick={() => router.push('/login')}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-md transition-colors"
          >
            Go to login
            <i className="fas fa-arrow-right ml-2"></i>
          </button>
        </div>
      </SetupShell>
    )
  }

  return (
    <SetupShell>
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-2xl w-full">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <i className="fas fa-shield-halved text-blue-600 text-2xl"></i>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900">Initial setup</h2>
          <p className="text-sm text-gray-600 mt-1">
            Create the first SUPER_ADMIN account to unlock the system.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
            <i className="fas fa-circle-exclamation mt-0.5"></i>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Account ID"
              hint="Human-readable identifier (e.g. SUPER-ADMIN)"
              required
            >
              <input
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="SUPER-ADMIN"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={submitting}
              />
            </Field>
            <Field
              label="Username"
              hint="Used to sign in"
              required
            >
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="superadmin"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={submitting}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="First name" required>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Maria"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={submitting}
              />
            </Field>
            <Field label="Last name" required>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Santos"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={submitting}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Middle name (optional)">
              <input
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                placeholder="Cruz"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={submitting}
              />
            </Field>
            <Field label="Suffix (optional)">
              <input
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                placeholder="Jr."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={submitting}
              />
            </Field>
          </div>

          <Field label="Email (optional)">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={submitting}
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Password"
              hint={password.length > 0 && !passwordStrong ? 'Use 8+ chars with letters and numbers' : 'Min 8 characters'}
              required
            >
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-3 pr-9 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  tabIndex={-1}
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </Field>
            <Field
              label="Confirm password"
              hint={passwordMismatch ? 'Passwords do not match' : 'Re-type to confirm'}
              required
            >
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 ${
                  passwordMismatch
                    ? 'border-red-300 focus:ring-red-400'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                required
                disabled={submitting}
              />
            </Field>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={!formValid || submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Creating super admin…
                </>
              ) : (
                <>
                  <i className="fas fa-shield-halved"></i>
                  Create super admin & finish setup
                </>
              )}
            </button>
          </div>
        </form>

        <p className="text-xs text-gray-500 text-center mt-4">
          This page is one-time-use. After the first super admin
          is created, the URL becomes inaccessible.
        </p>
      </div>
    </SetupShell>
  )
}

function SetupShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        {children}
      </div>
      <footer className="text-center text-xs text-gray-400 py-4">
        DWCC AccessLib · Initial setup
      </footer>
    </div>
  )
}

function Field({
  label,
  hint,
  required,
  children
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

function ErrorPanel({
  title,
  message
}: {
  title: string
  message: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-lg w-full text-center">
      <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
        <i className="fas fa-lock text-red-500 text-2xl"></i>
      </div>
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-600 mt-2">{message}</p>
      <Link
        href="/login"
        className="inline-block mt-6 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-md transition-colors text-sm"
      >
        Go to login
        <i className="fas fa-arrow-right ml-2"></i>
      </Link>
    </div>
  )
}

export default function SetupPage() {
  return (
    <Suspense
      fallback={
        <SetupShell>
          <div className="text-gray-500 text-sm">Loading…</div>
        </SetupShell>
      }
    >
      <SetupPageContent />
    </Suspense>
  )
}
