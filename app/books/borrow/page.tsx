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


  // Book-lookup modal state. Lets the staff find a book by
  // title / author / ISBN instead of having to type the
  // accession number. Optimized for realtime: the modal
  // NEVER auto-loads on open. A request is only fired when:
  //   - the user has typed 2+ characters and the debounce
  //     timer fires, OR
  //   - the user explicitly clicks "Show recent" (which
  //     passes `?recent=1` to the endpoint).
  // The min-length is enforced on the client and on the
  // server (defence in depth).
  const MIN_BOOK_LOOKUP_LENGTH = 2
  const [showBookLookupModal, setShowBookLookupModal] = useState(false)
  const [bookLookupQuery, setBookLookupQuery] = useState('')
  const [bookLookupResults, setBookLookupResults] = useState<any[]>([])
  const [bookLookupLoading, setBookLookupLoading] = useState(false)
  const [bookLookupHasSearched, setBookLookupHasSearched] = useState(false)
  const [bookLookupMode, setBookLookupMode] = useState<'search' | 'recent'>(
    'search'
  )
  const bookLookupDebounceRef = React.useRef<NodeJS.Timeout | null>(null)
  // Used to ignore late responses from earlier queries so an
  // in-flight older request can't overwrite a newer result.
  const bookLookupReqIdRef = React.useRef(0)

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

  // ---------- Book lookup modal (search by title/author/ISBN) ----------
  // Debounced realtime search against /api/books/copies/search.
  // Performance contract:
  //   - The modal NEVER auto-loads on open.
  //   - A query shorter than `MIN_BOOK_LOOKUP_LENGTH` is treated
  //     as "no search" and clears the result list locally
  //     instead of hitting the server.
  //   - Each request is tagged with an incrementing id; if a
  //     newer query is fired before the older one finishes, the
  //     late response is ignored so the UI never shows stale
  //     results for a previous keystroke.
  //   - "Show recent" is opt-in (toggles `bookLookupMode`) and
  //     sends `?recent=1` to the server, which returns the most
  //     recently catalogued copies.
  useEffect(() => {
    if (!showBookLookupModal) return

    // While in "recent" mode, the search box is disabled -- the
    // server already returned the recent set when the toggle
    // was clicked, so we don't re-fire on every keystroke.
    if (bookLookupMode === 'recent') return

    // Clear any pending debounce.
    if (bookLookupDebounceRef.current) clearTimeout(bookLookupDebounceRef.current)

    const q = bookLookupQuery.trim()

    // No query (or shorter than the min) → reset results without
    // hitting the server.
    if (q.length < MIN_BOOK_LOOKUP_LENGTH) {
      setBookLookupResults([])
      setBookLookupHasSearched(false)
      setBookLookupLoading(false)
      return
    }

    // Tag the request so a late response from an older query
    // can't overwrite a newer one.
    const reqId = ++bookLookupReqIdRef.current
    bookLookupDebounceRef.current = setTimeout(async () => {
      setBookLookupLoading(true)
      try {
        const response = await fetch(
          `/api/books/copies/search?q=${encodeURIComponent(q)}&limit=20`
        )
        if (reqId !== bookLookupReqIdRef.current) return // a newer query superseded us
        if (response.ok) {
          const data = await response.json()
          setBookLookupResults(Array.isArray(data?.results) ? data.results : [])
          setBookLookupHasSearched(true)
        } else {
          setBookLookupResults([])
        }
      } catch {
        if (reqId !== bookLookupReqIdRef.current) return
        setBookLookupResults([])
      } finally {
        if (reqId === bookLookupReqIdRef.current) {
          setBookLookupLoading(false)
        }
      }
    }, 250)
    return () => {
      if (bookLookupDebounceRef.current) clearTimeout(bookLookupDebounceRef.current)
    }
  }, [bookLookupQuery, showBookLookupModal, bookLookupMode])

  // Helper to fetch the most recently catalogued copies
  // (opt-in via the "Show recent" toggle).
  const fetchRecentBookCopies = async () => {
    setBookLookupMode('recent')
    setBookLookupQuery('')
    setBookLookupLoading(true)
    const reqId = ++bookLookupReqIdRef.current
    try {
      const response = await fetch(
        `/api/books/copies/search?recent=1&limit=20`
      )
      if (reqId !== bookLookupReqIdRef.current) return
      if (response.ok) {
        const data = await response.json()
        setBookLookupResults(Array.isArray(data?.results) ? data.results : [])
        setBookLookupHasSearched(true)
      } else {
        setBookLookupResults([])
      }
    } catch {
      if (reqId !== bookLookupReqIdRef.current) return
      setBookLookupResults([])
    } finally {
      if (reqId === bookLookupReqIdRef.current) {
        setBookLookupLoading(false)
      }
    }
  }

  // Helper to switch back to the live-search mode (clears the
  // recent list so the modal goes back to its "type to search"
  // empty state).
  const switchToSearchMode = () => {
    setBookLookupMode('search')
    setBookLookupResults([])
    setBookLookupHasSearched(false)
  }

  const openBookLookupModal = () => {
    setBookLookupQuery('')
    setBookLookupResults([])
    setBookLookupMode('search')
    setBookLookupHasSearched(false)
    setShowBookLookupModal(true)
  }

  const closeBookLookupModal = () => {
    setShowBookLookupModal(false)
    setBookLookupQuery('')
    setBookLookupResults([])
  }

  // When the user picks a result, close the modal, put the
  // accession number into the form, and reuse the existing
  // lookupBook flow so the green "Selected Book Copy" panel
  // (and all validation / availability checks) populate the
  // same way they would for a manually-typed accession.
  const selectBookFromLookup = async (accession: string) => {
    closeBookLookupModal()
    setAccessionNumber(accession)
    // `true` so the user gets a toast if the copy is no
    // longer available between search and selection.
    await lookupBook(accession, true)
  }

  // Render `text` with every case-insensitive occurrence of
  // `query` wrapped in a yellow background. Splits the text
  // into an array of strings + React nodes so we can pass it
  // straight into JSX. Returns the original text when the
  // query is empty.
  const highlight = (text: string | null | undefined, query: string) => {
    if (!text) return ''
    if (!query.trim()) return text
    const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(${escaped})`, 'ig')
    const parts = text.split(re)
    return parts.map((part, i) =>
      re.test(part) ? (
        <mark
          key={i}
          className="bg-yellow-200 text-gray-900 rounded px-0.5"
        >
          {part}
        </mark>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    )
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
        // Build a friendly success summary that names the
        // book + borrower so the staff member can confirm at
        // a glance.
        const tx = result?.data || result
        const bookTitle = tx?.book?.title || (selectedBook as any)?.title || 'the book'
        const authorName =
          tx?.book?.authors?.[0]?.name ||
          (selectedBook as any)?.authors?.[0]?.name ||
          (selectedBook as any)?.book_author ||
          ''
        const dueDateLabel = tx?.due_date
          ? new Date(tx.due_date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })
          : dueDate
          ? new Date(dueDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })
          : null
        const borrowerName =
          tx?.user?.full_name ||
          selectedUser?.full_name ||
          (departmentId
            ? `Department #${departmentId}`
            : officeId
            ? `Office #${officeId}`
            : 'borrower')

        const authorSuffix = authorName ? ` by ${authorName}` : ''
        const dueSuffix = dueDateLabel ? `\nDue: ${dueDateLabel}` : ''
        await Swal.fire({
          icon: 'success',
          title: 'Book Borrowed',
          text: `"${bookTitle}"${authorSuffix} has been borrowed by ${borrowerName}.${dueSuffix}`,
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
        // Map common error codes to a friendlier title / icon
        // so the staff member gets actionable feedback.
        const code = (result && (result.code || result.error_code)) || ''
        const message = result?.error || 'Failed to process the borrow request'
        let icon: 'warning' | 'error' | 'info' = 'error'
        let title = 'Borrow Failed'
        if (code === 'COPY_NOT_AVAILABLE' || code === 'BOOK_NOT_AVAILABLE') {
          icon = 'warning'
          title = 'Book Unavailable'
        } else if (code === 'USER_INACTIVE') {
          icon = 'warning'
          title = 'User Inactive'
        } else if (code === 'DEPARTMENT_NOT_FOUND' || code === 'OFFICE_NOT_FOUND') {
          icon = 'warning'
          title = 'Department / Office Not Found'
        }
        await Swal.fire({
          icon,
          title,
          text: message,
          confirmButtonColor: '#ef4444'
        })
      }
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Network Error',
        text: 'Failed to process the request. Please try again.',
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
              <Button variant="outline" className='bg-gray-200 px-5 h-[50px]'>
                Back to Books
              </Button>
            </Link>
          </div>
        </div>
        {/* on the creation of admin accounts,  */}

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
                      placeholder="Enter accession number (e.g., LIB-000001)"
                      disabled={loading}
                      required
                      className="flex-1 h-[50px] w-full"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => lookupBook(accessionNumber, true)}
                      disabled={loading || bookLoading || !accessionNumber.trim()}
                      className="px-3 bg-primary-600 hover:bg-primary-700 h-[50px] text-white"
                    >
                      {bookLoading ? '...' : 'Search'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={openBookLookupModal}
                      disabled={loading}
                      className="px-3 h-[50px] hover:bg-primary-700 bg-primary-600 flex text-white gap-1.5"
                      title="Browse and search all books by title, author, or ISBN"
                    >
                      <i className="fas fa-search-plus"></i>
                      <span>Lookup</span>
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
                          placeholder="Enter user ID number"
                          disabled={loading}
                          required
                          className="flex-1 h-[50px]"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => lookupUser(accountId, true)}
                          disabled={loading || userLoading || !accountId.trim()}
                          className="px-3 bg-primary-600 h-[50px] text-white"
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
              className='h-[50px] bg-gray-200 w-[150px]'
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
              className="min-w-[120px] bg-primary-600 h-[50px] text-white"
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

      {/* ---------- Book Lookup Modal ---------- */}
      {/* Lets the staff find a book by title / author / ISBN /
          publisher / accession when they don't know the exact
          accession number. Realtime search (250ms debounce)
          against /api/books/copies/search. The searched text
          is highlighted in each result. Picking a result
          closes the modal, fills in the accession number, and
          triggers the same lookupBook flow used by the manual
          Search button so the green "Selected Book Copy"
          panel populates identically. */}
      {showBookLookupModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeBookLookupModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <div className="flex items-center gap-2">
                <i className="fas fa-search-plus text-blue-600"></i>
                <h2 className="text-lg font-semibold text-gray-900">Book Lookup</h2>
                <span className="text-xs text-gray-500">
                  Search by title, author, ISBN, or accession
                </span>
              </div>
              <button
                onClick={closeBookLookupModal}
                className="text-gray-400 hover:text-gray-600 p-1"
                aria-label="Close"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="px-5 py-3 border-b bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                  <input
                    autoFocus
                    type="text"
                    value={bookLookupQuery}
                    onChange={(e) => setBookLookupQuery(e.target.value)}
                    onFocus={() => {
                      // If the user clicks the search box while in
                      // "recent" mode, switch back to live search so
                      // typing actually filters.
                      if (bookLookupMode === 'recent') switchToSearchMode()
                    }}
                    placeholder={
                      bookLookupMode === 'recent'
                        ? 'Click "Search by title / ISBN" to start a new search…'
                        : 'Start typing a title, author, ISBN, or accession (min. 2 chars)…'
                    }
                    disabled={bookLookupMode === 'recent'}
                    className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  {bookLookupQuery && bookLookupMode === 'search' && (
                    <button
                      onClick={() => setBookLookupQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                      aria-label="Clear"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  )}
                </div>
                {/* "Show recent" / "Back to search" toggle. Opt-in
                    so the modal never auto-loads data on open. */}
                {bookLookupMode === 'search' ? (
                  <button
                    type="button"
                    onClick={fetchRecentBookCopies}
                    disabled={bookLookupLoading}
                    className="px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
                    title="Show the most recently catalogued book copies"
                  >
                    <i className="fas fa-clock-rotate-left"></i>
                    Show recent
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={switchToSearchMode}
                    className="px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <i className="fas fa-search"></i>
                    Search by title / ISBN
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                {bookLookupLoading
                  ? 'Searching…'
                  : bookLookupMode === 'recent'
                    ? `Showing the ${bookLookupResults.length} most recently catalogued copies.`
                    : bookLookupQuery.trim()
                      ? `${bookLookupResults.length} result${bookLookupResults.length !== 1 ? 's' : ''} for "${bookLookupQuery.trim()}"`
                      : 'Start typing to search. Or click "Show recent" to browse the newest copies.'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto">
              {bookLookupLoading ? (
                <div className="flex items-center justify-center py-12 text-sm text-gray-500">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                  {bookLookupMode === 'recent' ? 'Loading recent copies…' : 'Searching…'}
                </div>
              ) : bookLookupResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  {bookLookupMode === 'search' && !bookLookupHasSearched ? (
                    <>
                      <i className="fas fa-keyboard text-3xl mb-2 text-gray-300"></i>
                      <p className="text-sm font-medium text-gray-700">
                        Type to search
                      </p>
                      <p className="text-xs text-gray-500 mt-1 text-center max-w-xs">
                        Start typing a title, author, ISBN, or accession
                        number (at least 2 characters) to see matching copies.
                      </p>
                    </>
                  ) : bookLookupQuery.trim() ? (
                    <>
                      <i className="fas fa-inbox text-3xl mb-2 text-gray-300"></i>
                      <p className="text-sm font-medium text-gray-700">
                        No books found
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Nothing matches "{bookLookupQuery.trim()}". Try a
                        shorter or different keyword.
                      </p>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-inbox text-3xl mb-2 text-gray-300"></i>
                      <p className="text-sm font-medium text-gray-700">
                        No books available
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {bookLookupResults.map((r) => {
                    const isAvailable = r.status === 'AVAILABLE'
                    return (
                      <li
                        key={r.copy_id}
                        onClick={() => isAvailable && selectBookFromLookup(r.accession_number)}
                        className={`flex items-start gap-3 px-5 py-3 transition-colors ${
                          isAvailable
                            ? 'hover:bg-blue-50 cursor-pointer'
                            : 'opacity-60 cursor-not-allowed bg-gray-50'
                        }`}
                      >
                        <div
                          className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                            isAvailable
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          <i className="fas fa-book"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">
                              {highlight(r.book?.title, bookLookupQuery)}
                            </p>
                            {!isAvailable && (
                              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-100 text-red-700">
                                {r.status}
                              </span>
                            )}
                            {isAvailable && (
                              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-100 text-green-700">
                                Available
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600">
                            by{' '}
                            <span className="font-medium text-gray-800">
                              {highlight(r.book?.book_author, bookLookupQuery)}
                            </span>
                            {r.book?.publisher ? (
                              <>
                                <span className="mx-1.5 text-gray-300">·</span>
                                {highlight(r.book.publisher, bookLookupQuery)}
                              </>
                            ) : null}
                            {r.book?.year_published ? (
                              <>
                                <span className="mx-1.5 text-gray-300">·</span>
                                {r.book.year_published}
                              </>
                            ) : null}
                          </p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500 mt-1">
                            <span>
                              <span className="text-gray-400">Accession:</span>{' '}
                              <span className="font-mono font-medium text-gray-700">
                                {highlight(r.accession_number, bookLookupQuery)}
                              </span>
                            </span>
                            {r.book?.isbn ? (
                              <span>
                                <span className="text-gray-400">ISBN:</span>{' '}
                                <span className="font-mono">
                                  {highlight(r.book.isbn, bookLookupQuery)}
                                </span>
                              </span>
                            ) : null}
                            {r.book?.category?.name ? (
                              <span>
                                <span className="text-gray-400">Category:</span>{' '}
                                {r.book.category.name}
                              </span>
                            ) : null}
                            {r.location ? (
                              <span>
                                <span className="text-gray-400">Location:</span>{' '}
                                {r.location}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {isAvailable && (
                          <i className="fas fa-chevron-right text-gray-400 mt-1.5"></i>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="px-5 py-3 border-t bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
              <span>
                Tip: clicking an available copy auto-fills the accession
                number on the form and runs the same validation as
                manual search.
              </span>
              <button
                onClick={closeBookLookupModal}
                className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
