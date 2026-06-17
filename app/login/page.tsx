'use client'

import { useState, useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LoadingScreen } from '@/components/ui/loading-spinner'
import { validateLogin } from '@/lib/validations'
import { notify } from '@/lib/notification'

export default function LoginPage() {
  const { data: session, status, update } = useSession()
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const error = searchParams.get('error')
  
  // Check for error in URL parameters
  useEffect(() => {
    if (error === 'ACCOUNT_INACTIVE') {
      notify.error(
        'Account Inactive',
        'Your account is inactive. Please proceed to the ISSO Office.'
      )
    }
  }, [error])
  
  // Redirect if already authenticated - simplified logic
  useEffect(() => {
    if (status === 'authenticated' && session && !isRedirecting) {
      setIsRedirecting(true)
      // Use window.location for a clean redirect
      window.location.href = callbackUrl
    }
  }, [status, session, callbackUrl, isRedirecting])
  
  // Show loading states
  if (status === 'loading') {
    return <LoadingScreen message="Loading..." />
  }
  
  if (status === 'authenticated' && session) {
    return <LoadingScreen message="Redirecting..." />
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setLoading(true)

    const validation = validateLogin(formData)
    if (!validation.isValid) {
      const fieldErrors: Record<string, string> = {}
      validation.errors.forEach(error => {
        if (error.includes('Username')) fieldErrors.username = error
        if (error.includes('Password')) fieldErrors.password = error
      })
      setErrors(fieldErrors)
      setLoading(false)
      return
    }

    try {
      // Simplified login flow - direct NextAuth signin
      const result = await signIn('credentials', {
        username: formData.username,
        password: formData.password,
        redirect: false,
      })

      if (result?.error) {
        // Handle specific error types
        if (result.error === 'ACCOUNT_INACTIVE') {
          notify.error(
            'Account Inactive',
            'Your account is inactive. Please proceed to the ISSO Office.'
          )
        } else {
          setErrors({ general: 'Invalid username or password' })
        }
        setLoading(false)
      } else if (result?.ok) {
        // Success - wait for session to update naturally
        setIsRedirecting(true)
        // Allow NextAuth to handle the session update
        // Small delay to ensure session cookie is set
        await new Promise(resolve => setTimeout(resolve, 100))
        // Use window.location for a clean redirect that reloads the page
        window.location.href = callbackUrl
      } else {
        setErrors({ general: 'Login failed. Please try again.' })
        setLoading(false)
      }
    } catch (error) {
      setErrors({ general: 'An error occurred. Please try again.' })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <Card variant="elevated" className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center pb-6">
          <div className="mx-auto w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
            <i className="fas fa-book text-white text-2xl" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">DWCC AccessLib</CardTitle>
          <CardDescription className="text-gray-600">Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              name="username"
              type="text"
              label="Username"
              placeholder="Enter your username"
              value={formData.username}
              onChange={handleChange}
              error={errors.username}
              icon={<i className="fas fa-user text-gray-400" />}
              inputSize="md"
            />
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <i className="fas fa-lock" />
                </div>
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  className={
                    'block w-full border rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 px-3 py-2 text-sm ' +
                    (errors.password
                      ? 'border-error-500 focus:border-error-500 focus:ring-error-500'
                      : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500') +
                    ' pl-10 pr-10 placeholder:text-gray-500'
                  }
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'} />
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-error-600">{errors.password}</p>
              )}
            </div>

            {errors.general && (
              <div className="text-sm text-error-600 text-center bg-error-50 border border-error-200 rounded-md p-3">
                {errors.general}
              </div>
            )}

            <Button
              type="submit"
              variant="default"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>© 2025 Divine Word College of Calapan</p>
            <p>Library Management System</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}