'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingScreen } from '@/components/ui/loading-spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { UserRole } from '@/types'
import { formatDate } from '@/lib/utils'

interface Program {
  program_id: number
  name: string
  code: string
  description?: string
  department_id: number
  is_active: boolean
  created_at: string
  updated_at: string
  archived_at?: string
  department?: {
    department_id: number
    name: string
    code: string
    is_active: boolean
  }
  users?: {
    user_id: number
    account_id: string
    full_name: string
    user_type: string
    status: string
  }[]
}

export default function ProgramViewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const programId = params.id as string

  const [program, setProgram] = useState<Program | null>(null)
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') {
        return
      }

      if (!session) {
        router.push('/login')
        return
      }

      const userRole = session.user.role as UserRole
      if (userRole !== UserRole.SUPER_ADMIN) {
        router.push('/dashboard')
        return
      }

      setAuthReady(true)
    }

    checkAuth()
  }, [session, status, router])

  useEffect(() => {
    if (authReady && programId) {
      fetchProgram()
    }
  }, [authReady, programId])

  const fetchProgram = async () => {
    try {
      setLoading(true)
      
      const response = await fetch(`/api/programs/${programId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setProgram(data.data)
      } else if (response.status === 404) {
        router.push('/programs')
        return
      } else {
        console.error('Failed to fetch program:', response.status)
        alert('Failed to fetch program details')
      }
    } catch (error) {
      console.error('Error fetching program:', error)
      alert('Error fetching program details')
    } finally {
      setLoading(false)
    }
  }

  if (!authReady) {
    return (
      <div className="px-6 py-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Checking authentication...</div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="px-6 py-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Loading program details...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!program) {
    return (
      <div className="px-6 py-4">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900">Program Not Found</h1>
          <p className="text-gray-600 mt-2">The program you're looking for doesn't exist.</p>
          <Button onClick={() => router.push('/programs')} className="mt-4">
            Back to Programs
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <i className="fas fa-arrow-left text-lg"></i>
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-800">
                  {program.name}
                </h1>
                {/* Breadcrumb */}
                <nav className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                  <span>Programs</span>
                  <i className="fas fa-chevron-right text-xs"></i>
                  <span className="text-gray-900 font-medium">{program.name}</span>
                </nav>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={() => router.push(`/programs/${programId}/edit`)}
              >
                <i className="fas fa-edit mr-2" />
                Edit Program
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4 space-y-6">
        {/* Program Details */}
        <Card>
          <CardHeader>
            <CardTitle>Program Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Program Name
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                  <span className="text-gray-900 font-medium">{program.name}</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Program Code
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                  <Badge variant="outline" className="text-sm">
                    {program.code}
                  </Badge>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-900">{program.department?.name || 'Unknown'}</span>
                    {program.department && (
                      <Badge variant="outline" className="text-xs">
                        {program.department.code}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                  <Badge variant={program.is_active ? 'success' : 'default'}>
                    {program.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Created Date
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                  <span className="text-gray-900">{formatDate(program.created_at)}</span>
                </div>
              </div>
              
              {program.description && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                    <span className="text-gray-900">{program.description}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Users */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Users ({program.users?.length || 0})</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(`/library-users?program=${programId}`)}
              >
                <i className="fas fa-external-link-alt mr-2" />
                View All Users
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {program.users && program.users.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>ID Number</TableHead>
                    <TableHead>User Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {program.users.slice(0, 5).map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.account_id}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">{user.user_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.status === 'ACTIVE' ? 'success' : 'default'}>
                          {user.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No users found for this program.
              </div>
            )}
            {program.users && program.users.length > 5 && (
              <div className="text-center mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/library-users?program=${programId}`)}
                >
                  View {program.users.length - 5} more users
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
