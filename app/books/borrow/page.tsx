'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Swal from 'sweetalert2'
import { useApiSWR, apiCache } from '@/lib/hooks/useApi'
import { notify } from '@/lib/notification'

interface User {
  user_id: number
  account_id: string
  full_name: string
  user_type: string
  status: string
  email?: string
  department_ref?: { name: string }
  program?: { name: string }
}

interface Department {
  department_id: number
  name: string
  code: string
  description?: string
}

interface Office {
  office_id: number
  name: string
  code: string
  description?: string
}

interface Book {
  book_id: number
  title: string
  book_author: string
  isbn?: string
  publisher?: string
  year_published?: number
  copies_available: number
  category?: { name: string }
  section?: { name: string }
  status: string
  location?: string
}

type BorrowerTab = 'user' | 'department' | 'office'

export default function BorrowBooksPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [authReady, setAuthReady] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Tab state
  const [activeTab, setActiveTab] = useState<BorrowerTab>('user')
  
  // Form data
  const [accessionNumber, setAccessionNumber] = useState('')
  const [accountId, setAccountId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [officeId, setOfficeId] = useState('')
  const [representative, setRepresentative] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [condition, setCondition] = useState('GOOD')
  const [notes, setNotes] = useState('')
  
  // Book and borrower data
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [bookLoading, setBookLoading] = useState(false)
  const [userLoading, setUserLoading] = useState(false)

  // Fetch departments and offices
  const { data: departmentsResponse } = useApiSWR<any>(activeTab === 'department' ? '/api/departments?status=true' : null)
  const { data: officesResponse } = useApiSWR<any>(activeTab === 'office' ? '/api/offices?status=true' : null)

  const departments = Array.isArray(departmentsResponse) ? departmentsResponse : (departmentsResponse?.data || [])
  const offices = Array.isArray(officesResponse) ? officesResponse : (officesResponse?.data || [])

  // Fetch grace period and set default due date
  useEffect(() => {
    const fetchGracePeriodAndSetDueDate = async () => {
      try {
        const response = await fetch('/api/system-settings/grace-period')
        const result = await response.json()
        
        if (response.ok && result.data) {
          const gracePeriodDays = result.data.grace_period_days || 3
          const defaultDueDate = new Date()
          defaultDueDate.setDate(defaultDueDate.getDate() + gracePeriodDays)
          const formattedDate = defaultDueDate.toISOString().split('T')[0]
          setDueDate(formattedDate)
        } else {
          const defaultDueDate = new Date()
          defaultDueDate.setDate(defaultDueDate.getDate() + 3)
          const formattedDate = defaultDueDate.toISOString().split('T')[0]
          setDueDate(formattedDate)
        }
      } catch (error) {
        const defaultDueDate = new Date()
        defaultDueDate.setDate(defaultDueDate.getDate() + 3)
        const formattedDate = defaultDueDate.toISOString().split('T')[0]
        setDueDate(formattedDate)
      }
    }

    if (authReady) {
      fetchGracePeriodAndSetDueDate()
    }
  }, [authReady])

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') {
        return
      }

      if (status === 'authenticated' && session?.user) {
        if (!['STAFF', 'ADMIN'].includes(session.user.role)) {
          router.push('/dashboard')
          return
        }
        setAuthReady(true)
      } else {
        try {
          const response = await fetch('/api/users/profile', {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          })
          
          if (response.ok) {
            const userData = await response.json()
            if (!['STAFF', 'ADMIN'].includes(userData.role)) {
              router.push('/dashboard')
              return
            }
            setAuthReady(true)
          } else {
            router.push('/login')
            return
          }
        } catch (error) {
          router.push('/login')
          return
        }
      }
    }

    checkAuth()
  }, [session, status, router])

  // Book lookup function
  const lookupBook = async (searchValue: string, showAlerts: boolean = false) => {
    if (!searchValue.trim()) {
      setSelectedBook(null)
      return
    }

    setBookLoading(true)
    try {
      let result = null
      let response = null
      
      // Try accession number lookup
      response = await fetch(`/api/books/lookup/accession/${encodeURIComponent(searchValue.toUpperCase())}`)
      result = await response.json()

      if (response?.ok && result?.data) {
        // Transform bookCopy data to match expected Book interface
        const bookCopyData = result.data
        setSelectedBook({
          ...bookCopyData.book,
          accession_number: bookCopyData.accession_number,
          copy_id: bookCopyData.copy_id,
          copy_status: bookCopyData.status,
          copy_condition: bookCopyData.condition,
          current_borrower: bookCopyData.current_borrower
        })
        
        if (showAlerts) {
          if (bookCopyData.status !== 'AVAILABLE') {
            await Swal.fire({
              icon: 'warning',
              title: 'Book Copy Not Available',
              text: `This book copy is currently ${bookCopyData.status}`,
              confirmButtonColor: '#f59e0b'
            })
          } else if (bookCopyData.current_borrower) {
            await Swal.fire({
              icon: 'warning',
              title: 'Already Borrowed',
              text: `This copy is currently borrowed by ${bookCopyData.current_borrower.name}`,
              confirmButtonColor: '#f59e0b'
            })
          }
        }
      } else {
        setSelectedBook(null)
        if (showAlerts) {
          await Swal.fire({
            icon: 'error',
            title: 'Book Copy Not Found',
            text: result?.error || 'No book found with this accession number',
            confirmButtonColor: '#ef4444'
          })
        }
      }
    } catch (error) {
      setSelectedBook(null)
      if (showAlerts) {
        await Swal.fire({
          icon: 'error',
          title: 'Lookup Failed',
          text: 'Failed to lookup book. Please try again.',
          confirmButtonColor: '#ef4444'
        })
      }
    } finally {
      setBookLoading(false)
    }
  }

  // User lookup function
  const lookupUser = async (accountIdValue: string, showAlerts: boolean = false) => {
    if (!accountIdValue.trim()) {
      setSelectedUser(null)
      return
    }

    setUserLoading(true)
    try {
      const response = await fetch(`/api/library-users/lookup/${encodeURIComponent(accountIdValue)}`)
      const result = await response.json()

      if (response.ok && result.data) {
        setSelectedUser(result.data)
        
        if (showAlerts) {
          if (result.data.status === 'INACTIVE') {
            await Swal.fire({
              icon: 'warning',
              title: 'Account Inactive',
              html: `<strong>${result.data.full_name}</strong>, your account is inactive.<br><br>Please proceed to the library office.`,
              confirmButtonColor: '#f59e0b'
            })
          } else if (result.data.status === 'SUSPENDED') {
            await Swal.fire({
              icon: 'error',
              title: 'Account Suspended',
              html: `<strong>${result.data.full_name}</strong>, your account is suspended.<br><br>Please contact the library office.`,
              confirmButtonColor: '#ef4444'
            })
          } else if (result.data.status === 'ACTIVE') {
            await Swal.fire({
              icon: 'success',
              title: 'Account Active',
              html: `<strong>${result.data.full_name}</strong><br>ID Number: ${result.data.account_id}<br>Type: ${result.data.user_type}<br>Status: ${result.data.status}`,
              confirmButtonColor: '#10b981'
            })
          }
        }
      } else {
        setSelectedUser(null)
        if (showAlerts) {
          await Swal.fire({
            icon: 'error',
            title: 'User Not Found',
            text: result.error || 'No user found with this ID number',
            confirmButtonColor: '#ef4444'
          })
        }
      }
    } catch (error) {
      setSelectedUser(null)
      if (showAlerts) {
        await Swal.fire({
          icon: 'error',
          title: 'Lookup Failed',
          text: 'Failed to lookup user. Please try again.',
          confirmButtonColor: '#ef4444'
        })
      }
    } finally {
      setUserLoading(false)
    }
  }

  // Handle Accession Number input change
  const handleAccessionNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase()
    setAccessionNumber(value)
    
    if (value.length < 3) {
      setSelectedBook(null)
    }
  }

  // Auto-lookup effect with debouncing
  useEffect(() => {
    if (accessionNumber.length >= 3) {
      const timeoutId = setTimeout(() => {
        lookupBook(accessionNumber)
      }, 500)
      
      return () => clearTimeout(timeoutId)
    }
  }, [accessionNumber])

  // Handle account ID input change
  const handleAccountIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setAccountId(value)
    
    if (value.length >= 3) {
      lookupUser(value)
    } else {
      setSelectedUser(null)
    }
  }

  // Submit borrow request
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedBook) {
      await Swal.fire({
        icon: 'warning',
        title: 'No Book Selected',
        text: 'Please enter a valid accession number to select a book',
        confirmButtonColor: '#f59e0b'
      })
      return
    }

    // Validate borrower selection based on active tab
    if (activeTab === 'user' && !selectedUser) {
      await Swal.fire({
        icon: 'warning',
        title: 'No User Selected',
        text: 'Please enter a valid ID number to select a user',
        confirmButtonColor: '#f59e0b'
      })
      return
    }

    if (activeTab === 'department' && !departmentId) {
      await Swal.fire({
        icon: 'warning',
        title: 'No Department Selected',
        text: 'Please select a department',
        confirmButtonColor: '#f59e0b'
      })
      return
    }

    if (activeTab === 'office' && !officeId) {
      await Swal.fire({
        icon: 'warning',
        title: 'No Office Selected',
        text: 'Please select an office',
        confirmButtonColor: '#f59e0b'
      })
      return
    }

    if (activeTab === 'user' && selectedUser?.status !== 'ACTIVE') {
      await Swal.fire({
        icon: 'error',
        title: 'Cannot Process Request',
        text: 'User account must be active to borrow books',
        confirmButtonColor: '#ef4444'
      })
      return
    }

    if ((selectedBook as any).copy_status !== 'AVAILABLE' || (selectedBook as any).current_borrower) {
      await Swal.fire({
        icon: 'error',
        title: 'Cannot Process Request',
        text: 'This book copy is not available for borrowing',
        confirmButtonColor: '#ef4444'
      })
      return
    }

    // Validate due date is not before today
    if (dueDate) {
      const today = new Date().toISOString().split('T')[0]
      if (dueDate < today) {
        await Swal.fire({
          icon: 'error',
          title: 'Invalid Due Date',
          text: 'Due date cannot be before today',
          confirmButtonColor: '#ef4444'
        })
        return
      }
    }

    setLoading(true)
    try {
      const requestBody: any = { 
        accession_number: (selectedBook as any).accession_number,
        due_date: dueDate || null,
        condition_on_borrow: condition,
        notes: notes.trim() || null
      }

      if (activeTab === 'user') {
        requestBody.user_id = selectedUser!.user_id
      } else if (activeTab === 'department') {
        requestBody.department_id = Number(departmentId)
        if (representative.trim()) {
          requestBody.borrower_representative = representative.trim()
        }
      } else if (activeTab === 'office') {
        requestBody.office_id = Number(officeId)
        if (representative.trim()) {
          requestBody.borrower_representative = representative.trim()
        }
      }

      const response = await fetch('/api/borrowing-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()

      if (response.ok) {
        await Swal.fire({
          icon: 'success',
          title: 'Request Submitted',
          text: 'Borrow request has been submitted for approval',
          confirmButtonColor: '#10b981'
        })
        
        // Reset form
        setAccessionNumber('')
        setAccountId('')
        setDepartmentId('')
        setOfficeId('')
        setRepresentative('')
        setCondition('GOOD')
        setNotes('')
        setSelectedBook(null)
        setSelectedUser(null)
        
        // Re-fetch grace period and set due date
        try {
          const response = await fetch('/api/system-settings/grace-period')
          const result = await response.json()
          
          if (response.ok && result.data) {
            const gracePeriodDays = result.data.grace_period_days || 3
            const defaultDueDate = new Date()
            defaultDueDate.setDate(defaultDueDate.getDate() + gracePeriodDays)
            const formattedDate = defaultDueDate.toISOString().split('T')[0]
            setDueDate(formattedDate)
          } else {
            const defaultDueDate = new Date()
            defaultDueDate.setDate(defaultDueDate.getDate() + 3)
            const formattedDate = defaultDueDate.toISOString().split('T')[0]
            setDueDate(formattedDate)
          }
        } catch (error) {
          const defaultDueDate = new Date()
          defaultDueDate.setDate(defaultDueDate.getDate() + 3)
          const formattedDate = defaultDueDate.toISOString().split('T')[0]
          setDueDate(formattedDate)
        }
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Request Failed',
          text: result.error || 'Failed to submit borrow request',
          confirmButtonColor: '#ef4444'
        })
      }
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Network Error',
        text: 'Failed to submit request. Please try again.',
        confirmButtonColor: '#ef4444'
      })
    } finally {
      setLoading(false)
    }
  }

  const clearForm = async () => {
    setAccessionNumber('')
    setAccountId('')
    setDepartmentId('')
    setOfficeId('')
    setRepresentative('')
    setCondition('GOOD')
    setNotes('')
    setSelectedBook(null)
    setSelectedUser(null)
    
    // Re-fetch grace period and set due date
    try {
      const response = await fetch('/api/system-settings/grace-period')
      const result = await response.json()
      
      if (response.ok && result.data) {
        const gracePeriodDays = result.data.grace_period_days || 3
        const defaultDueDate = new Date()
        defaultDueDate.setDate(defaultDueDate.getDate() + gracePeriodDays)
        const formattedDate = defaultDueDate.toISOString().split('T')[0]
        setDueDate(formattedDate)
      } else {
        const defaultDueDate = new Date()
        defaultDueDate.setDate(defaultDueDate.getDate() + 3)
        const formattedDate = defaultDueDate.toISOString().split('T')[0]
        setDueDate(formattedDate)
      }
    } catch (error) {
      const defaultDueDate = new Date()
      defaultDueDate.setDate(defaultDueDate.getDate() + 3)
      const formattedDate = defaultDueDate.toISOString().split('T')[0]
      setDueDate(formattedDate)
    }
  }

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Borrow Books</h1>
              <p className="mt-1 text-gray-600">Create a new book borrowing request</p>
            </div>
            <Link href="/books">
              <Button variant="outline">
                Back to Books
              </Button>
            </Link>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Book Information Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  Book Information
                  {bookLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Accession Number *
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={accessionNumber}
                      onChange={handleAccessionNumberChange}
                      onBlur={() => accessionNumber.trim() && lookupBook(accessionNumber, true)}
                      placeholder="Enter accession number (e.g., LIB-000001)"
                      disabled={loading}
                      required
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => lookupBook(accessionNumber, true)}
                      disabled={loading || bookLoading || !accessionNumber.trim()}
                      className="px-3"
                    >
                      {bookLoading ? '...' : 'Search'}
                    </Button>
                  </div>
                </div>

                {selectedBook && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <h4 className="font-semibold text-green-800 mb-2">Selected Book Copy:</h4>
                    <div className="space-y-1 text-sm">
                      <p><strong>Accession Number:</strong> {(selectedBook as any).accession_number}</p>
                      <p><strong>Title:</strong> {selectedBook.title}</p>
                      <p><strong>Author:</strong> {selectedBook.book_author}</p>
                      <p><strong>ISBN:</strong> {selectedBook.isbn || 'N/A'}</p>
                      <p><strong>Category:</strong> {selectedBook.category?.name || 'N/A'}</p>
                      <p><strong>Copy Condition:</strong> {(selectedBook as any).copy_condition || 'N/A'}</p>
                      <p><strong>Copy Status:</strong> 
                        <span className={`ml-1 px-2 py-1 rounded text-xs ${
                          (selectedBook as any).copy_status === 'AVAILABLE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {(selectedBook as any).copy_status}
                        </span>
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Borrower Information Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  Borrower Information
                  {userLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                  <button
                    type="button"
                    onClick={() => setActiveTab('user')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'user'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Individual User
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('department')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'department'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Department
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('office')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'office'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Office
                  </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'user' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ID Number *
                      </label>
                      <div className="flex gap-2">
                        <Input
                          value={accountId}
                          onChange={handleAccountIdChange}
                          onBlur={() => accountId.trim() && lookupUser(accountId, true)}
                          placeholder="Enter user ID number"
                          disabled={loading}
                          required
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => lookupUser(accountId, true)}
                          disabled={loading || userLoading || !accountId.trim()}
                          className="px-3"
                        >
                          {userLoading ? '...' : 'Search'}
                        </Button>
                      </div>
                    </div>

                    {selectedUser && (
                      <div className={`border rounded-lg p-3 ${
                        selectedUser.status === 'ACTIVE' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                      }`}>
                        <h4 className={`font-semibold mb-2 ${
                          selectedUser.status === 'ACTIVE' ? 'text-green-800' : 'text-red-800'
                        }`}>
                          Selected User:
                        </h4>
                        <div className="space-y-1 text-sm">
                          <p><strong>Name:</strong> {selectedUser.full_name}</p>
                          <p><strong>ID Number:</strong> {selectedUser.account_id}</p>
                          <p><strong>Type:</strong> {selectedUser.user_type}</p>
                          <p><strong>Status:</strong> 
                            <span className={`ml-1 px-2 py-1 rounded text-xs ${
                              selectedUser.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {selectedUser.status}
                            </span>
                          </p>
                          {selectedUser.department_ref && (
                            <p><strong>Department:</strong> {selectedUser.department_ref.name}</p>
                          )}
                          {selectedUser.program && (
                            <p><strong>Program:</strong> {selectedUser.program.name}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'department' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Department *
                      </label>
                      <select
                        value={departmentId}
                        onChange={(e) => setDepartmentId(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white"
                        disabled={loading}
                        required
                      >
                        <option value="">Select a department</option>
                        {departments.map((dept: any) => (
                          <option key={dept.department_id} value={dept.department_id}>
                            {dept.name} ({dept.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Representative Name (Optional)
                      </label>
                      <Input
                        value={representative}
                        onChange={(e) => setRepresentative(e.target.value)}
                        placeholder="Enter representative's name"
                        disabled={loading}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Person borrowing on behalf of the department
                      </p>
                    </div>

                    {departmentId && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <h4 className="font-semibold text-blue-800 mb-2">Selected Department:</h4>
                        <div className="space-y-1 text-sm">
                          {departments.find((d: any) => d.department_id === Number(departmentId)) && (
                            <>
                              <p><strong>Name:</strong> {departments.find((d: any) => d.department_id === Number(departmentId))!.name}</p>
                              <p><strong>Code:</strong> {departments.find((d: any) => d.department_id === Number(departmentId))!.code}</p>
                              {representative && (
                                <p><strong>Representative:</strong> {representative}</p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'office' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Office *
                      </label>
                      <select
                        value={officeId}
                        onChange={(e) => setOfficeId(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white"
                        disabled={loading}
                        required
                      >
                        <option value="">Select an office</option>
                        {offices.map((office: any) => (
                          <option key={office.office_id} value={office.office_id}>
                            {office.name} ({office.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Representative Name (Optional)
                      </label>
                      <Input
                        value={representative}
                        onChange={(e) => setRepresentative(e.target.value)}
                        placeholder="Enter representative's name"
                        disabled={loading}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Person borrowing on behalf of the office
                      </p>
                    </div>

                    {officeId && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <h4 className="font-semibold text-purple-800 mb-2">Selected Office:</h4>
                        <div className="space-y-1 text-sm">
                          {offices.find((o: any) => o.office_id === Number(officeId)) && (
                            <>
                              <p><strong>Name:</strong> {offices.find((o: any) => o.office_id === Number(officeId))!.name}</p>
                              <p><strong>Code:</strong> {offices.find((o: any) => o.office_id === Number(officeId))!.code}</p>
                              {representative && (
                                <p><strong>Representative:</strong> {representative}</p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Transaction Details Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Transaction Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date (Optional)
                  </label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Auto-populated based on grace period (minimum: today)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Condition at Borrowing
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white"
                    disabled={loading}
                  >
                    <option value="EXCELLENT">Excellent</option>
                    <option value="GOOD">Good</option>
                    <option value="FAIR">Fair</option>
                    <option value="POOR">Poor</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes for this transaction"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 h-20 resize-none"
                  disabled={loading}
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={clearForm}
              disabled={loading}
            >
              Clear Form
            </Button>
            <Button
              type="submit"
              disabled={loading || !selectedBook || 
                (activeTab === 'user' && !selectedUser) ||
                (activeTab === 'department' && !departmentId) ||
                (activeTab === 'office' && !officeId)
              }
              className="min-w-[120px]"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Submitting...
                </div>
              ) : (
                'Submit Request'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
