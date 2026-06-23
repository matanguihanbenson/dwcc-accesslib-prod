'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserRole, UserType, UserStatus } from '@/types'
import { notify } from '@/lib/notification'

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  middle_name: '',
  suffix: '',
  account_id: '',
  user_type: 'STUDENT' as UserType,
  email: '',
  student_category: '',
  basic_ed_level: '',
  department_id: '',
  program_id: '',
  office_id: '',
  grade_level_id: '',
  section_id: '',
  strand_id: '',
  year_level: '',
  contact_number: '',
  rfid_code: '',
  purpose: '',
  status: 'ACTIVE' as UserStatus
}

export default function AddLibraryUserPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [submitting, setSubmitting] = useState(false)
  const [departments, setDepartments] = useState<any[]>([])
  const [programs, setPrograms] = useState<any[]>([])
  const [offices, setOffices] = useState<any[]>([])
  const [gradeLevels, setGradeLevels] = useState<any[]>([])
  const [sections, setSections] = useState<any[]>([])
  const [strands, setStrands] = useState<any[]>([])
  const [authReady, setAuthReady] = useState(false)
  const [accountIdStatus, setAccountIdStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [checkingTimer, setCheckingTimer] = useState<NodeJS.Timeout | null>(null)
  const [mode, setMode] = useState<'create' | 'edit'>('create')
  const [loadedUserId, setLoadedUserId] = useState<number | null>(null)
  const [loadedUserSnapshot, setLoadedUserSnapshot] = useState<any | null>(null)
  const [retrieveId, setRetrieveId] = useState('')
  const [retrieving, setRetrieving] = useState(false)
  const [showRetrieveModal, setShowRetrieveModal] = useState(false)
  const [rfidInput, setRfidInput] = useState('')
  const [rfidBusy, setRfidBusy] = useState(false)

  const isFormValid = useMemo(() => {
    const hasBasicFields =
      formData.first_name.trim() !== '' &&
      formData.last_name.trim() !== '' &&
      formData.account_id.trim() !== '' &&
      formData.user_type.trim() !== '' &&
      formData.status.trim() !== ''

    if (!hasBasicFields) return false

    if (formData.user_type === 'STUDENT') {
      if (formData.student_category === 'COLLEGE') {
        return (
          formData.department_id?.toString().trim() !== '' &&
          formData.program_id?.toString().trim() !== '' &&
          formData.year_level.trim() !== ''
        )
      }

      if (formData.student_category === 'BASIC_EDUCATION') {
        const hasBase =
          formData.basic_ed_level.trim() !== '' &&
          formData.grade_level_id?.toString().trim() !== ''

        if (!hasBase) return false

        const selectedGrade = gradeLevels.find(
          (g) => g.grade_level_id.toString() === formData.grade_level_id.toString()
        )

        const isSeniorHigh = selectedGrade?.education_level === 'SENIOR_HIGH'

        if (isSeniorHigh) {
          return (
            formData.strand_id?.toString().trim() !== '' &&
            formData.section_id?.toString().trim() !== ''
          )
        }

        return formData.section_id?.toString().trim() !== ''
      }
    }

    if (formData.user_type === 'EMPLOYEE') {
      return (
        (formData.department_id?.toString().trim() || '').length > 0 ||
        (formData.office_id?.toString().trim() || '').length > 0
      )
    }

    if (formData.user_type === 'ALUMNI') {
      return (
        formData.department_id?.toString().trim() !== '' &&
        formData.program_id?.toString().trim() !== ''
      )
    }

    return true
  }, [formData, gradeLevels])

  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') {
        return
      }

      if (status === 'authenticated' && session?.user) {
        const userRole = session.user.role as UserRole
        if (
          userRole !== UserRole.SUPER_ADMIN &&
          userRole !== UserRole.ADMIN &&
          userRole !== UserRole.STAFF
        ) {
          router.push('/dashboard')
          return
        }
        setAuthReady(true)
      } else {
        router.push('/login')
        return
      }
    }

    checkAuth()
  }, [session, status, router])

  useEffect(() => {
    if (authReady) {
      fetchDepartments()
      fetchOffices()
    }
  }, [authReady])

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const result = await response.json()
        setDepartments(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
  }

  const fetchOffices = async () => {
    try {
      const response = await fetch('/api/offices', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const result = await response.json()
        setOffices(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching offices:', error)
    }
  }

  const fetchPrograms = async (departmentId: string) => {
    try {
      const response = await fetch(`/api/programs?departmentId=${departmentId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const result = await response.json()
        setPrograms(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching programs:', error)
    }
  }

  const fetchGradeLevels = async (educationLevel: string) => {
    try {
      const response = await fetch(`/api/grade-levels?education_level=${educationLevel}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const result = await response.json()
        const grades = Array.isArray(result) ? result : (result.data || [])
        setGradeLevels(grades)
      }
    } catch (error) {
      console.error('Error fetching grade levels:', error)
    }
  }

  const fetchStrands = async () => {
    try {
      const response = await fetch('/api/strands', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const result = await response.json()
        const strandsData = Array.isArray(result) ? result : (result.data || [])
        setStrands(strandsData)
      }
    } catch (error) {
      console.error('Error fetching strands:', error)
    }
  }

  const fetchSections = async (gradeLevelId: string, strandId?: string) => {
    try {
      let url = `/api/student-sections?grade_level_id=${gradeLevelId}`
      if (strandId) {
        url += `&strand_id=${strandId}`
      }
      
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        const result = await response.json()
        const sectionsData = Array.isArray(result) ? result : (result.data || [])
        setSections(sectionsData)
      }
    } catch (error) {
      console.error('Error fetching sections:', error)
    }
  }

  const checkAccountIdAvailability = async (accountId: string) => {
    if (!accountId || accountId.length < 2) {
      setAccountIdStatus('idle')
      return
    }

    try {
      setAccountIdStatus('checking')
      const response = await fetch(`/api/library-users/check-account-id?account_id=${encodeURIComponent(accountId)}`, {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setAccountIdStatus(data.available ? 'available' : 'taken')
      } else {
        setAccountIdStatus('idle')
      }
    } catch (error) {
      console.error('Error checking account ID:', error)
      setAccountIdStatus('idle')
    }
  }

  const capitalizeWords = (str: string): string => {
    if (!str) return ''
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => {
      let processedValue = value
      if (field === 'first_name' || field === 'middle_name' || field === 'last_name' || field === 'suffix') {
        processedValue = capitalizeWords(value)
      }

      const newData = {
        ...prev,
        [field]: processedValue
      }
      
      if (field === 'first_name' || field === 'last_name') {
        const firstName = field === 'first_name' ? processedValue : prev.first_name
        const lastName = field === 'last_name' ? processedValue : prev.last_name
        
        if (firstName && lastName) {
          const formattedFirstName = firstName.toLowerCase().trim().replace(/\s+/g, '')
          const formattedLastName = lastName.toLowerCase().trim().replace(/\s+/g, '')
          newData.email = `${formattedFirstName}.${formattedLastName}@dwcc.edu.ph`
        }
      }
      
      if (field === 'user_type') {
        newData.student_category = ''
        newData.basic_ed_level = ''
        newData.department_id = ''
        newData.program_id = ''
        newData.grade_level_id = ''
        newData.section_id = ''
        newData.strand_id = ''
        newData.year_level = ''
      }

      if (field === 'student_category') {
        newData.basic_ed_level = ''
        newData.department_id = ''
        newData.program_id = ''
        newData.grade_level_id = ''
        newData.section_id = ''
        newData.strand_id = ''
        newData.year_level = ''
      }

      if (field === 'basic_ed_level') {
        newData.grade_level_id = ''
        newData.section_id = ''
        newData.strand_id = ''
      }

      if (field === 'grade_level_id') {
        newData.section_id = ''
        newData.strand_id = ''
      }

      if (field === 'strand_id') {
        newData.section_id = ''
      }

      if (field === 'department_id') {
        newData.program_id = ''
      }
      
      return newData
    })

    if (field === 'account_id') {
      if (checkingTimer) {
        clearTimeout(checkingTimer)
      }
      
      if (value.length < 2) {
        setAccountIdStatus('idle')
      } else {
        setAccountIdStatus('checking')
        const timer = setTimeout(() => {
          checkAccountIdAvailability(value)
        }, 500)
        setCheckingTimer(timer)
      }
    }
  }

  useEffect(() => {
    return () => {
      if (checkingTimer) {
        clearTimeout(checkingTimer)
      }
    }
  }, [checkingTimer])

  useEffect(() => {
    if (formData.department_id) {
      fetchPrograms(formData.department_id)
    } else {
      setPrograms([])
    }
  }, [formData.department_id])

  useEffect(() => {
    if (formData.basic_ed_level) {
      fetchGradeLevels(formData.basic_ed_level)
    } else {
      setGradeLevels([])
    }
  }, [formData.basic_ed_level])

  useEffect(() => {
    const selectedGrade = gradeLevels.find(g => g.grade_level_id.toString() === formData.grade_level_id.toString())
    if (selectedGrade && selectedGrade.education_level === 'SENIOR_HIGH') {
      fetchStrands()
    } else {
      setStrands([])
      setFormData(prev => ({ ...prev, strand_id: '' }))
    }
  }, [formData.grade_level_id, gradeLevels])

  useEffect(() => {
    if (formData.grade_level_id) {
      const selectedGrade = gradeLevels.find(g => g.grade_level_id.toString() === formData.grade_level_id.toString())
      if (selectedGrade && selectedGrade.education_level === 'SENIOR_HIGH') {
        if (formData.strand_id) {
          fetchSections(formData.grade_level_id, formData.strand_id)
        } else {
          setSections([])
        }
      } else {
        fetchSections(formData.grade_level_id)
      }
    } else {
      setSections([])
    }
  }, [formData.grade_level_id, formData.strand_id, gradeLevels])

  const populateFromUser = (user: any) => {
    const isStudent = user.user_type === 'STUDENT'
    const isBasicEd = isStudent && user.education_level && user.education_level !== 'COLLEGE' && user.education_level !== 'GRADUATE_SCHOOL'
    const isCollege = isStudent && (user.education_level === 'COLLEGE' || user.education_level === 'GRADUATE_SCHOOL' || (!user.education_level && (user.program_id || user.department_id)))

    setFormData({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      middle_name: user.middle_name || '',
      suffix: user.suffix || '',
      account_id: user.account_id || '',
      user_type: (user.user_type || 'STUDENT') as UserType,
      email: user.email || '',
      student_category: isStudent ? (isBasicEd ? 'BASIC_EDUCATION' : (isCollege ? 'COLLEGE' : '')) : '',
      basic_ed_level: isBasicEd ? (user.education_level || '') : '',
      department_id: user.department_id ? user.department_id.toString() : '',
      program_id: user.program_id ? user.program_id.toString() : '',
      office_id: user.office_id ? user.office_id.toString() : '',
      grade_level_id: user.grade_level_id ? user.grade_level_id.toString() : '',
      section_id: user.section_id ? user.section_id.toString() : '',
      strand_id: user.strand_id ? user.strand_id.toString() : '',
      year_level: user.year_level || '',
      contact_number: user.contact_number || '',
      rfid_code: user.rfid_code || '',
      purpose: user.purpose || '',
      status: (user.status || 'ACTIVE') as UserStatus
    })

    setLoadedUserSnapshot({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      middle_name: user.middle_name || '',
      suffix: user.suffix || '',
      account_id: user.account_id || '',
      user_type: (user.user_type || 'STUDENT') as UserType,
      email: user.email || '',
      student_category: isStudent ? (isBasicEd ? 'BASIC_EDUCATION' : (isCollege ? 'COLLEGE' : '')) : '',
      basic_ed_level: isBasicEd ? (user.education_level || '') : '',
      department_id: user.department_id ? user.department_id.toString() : '',
      program_id: user.program_id ? user.program_id.toString() : '',
      office_id: user.office_id ? user.office_id.toString() : '',
      grade_level_id: user.grade_level_id ? user.grade_level_id.toString() : '',
      section_id: user.section_id ? user.section_id.toString() : '',
      strand_id: user.strand_id ? user.strand_id.toString() : '',
      year_level: user.year_level || '',
      contact_number: user.contact_number || '',
      rfid_code: user.rfid_code || '',
      purpose: user.purpose || '',
      status: (user.status || 'ACTIVE') as UserStatus
    })

    if (isBasicEd && user.education_level) {
      fetchGradeLevels(user.education_level)
    }
    if (user.grade_level_id) {
      const gradeIdStr = user.grade_level_id.toString()
      const timer = setTimeout(() => {
        const selectedGrade = gradeLevels.find(g => g.grade_level_id.toString() === gradeIdStr)
        if (selectedGrade && selectedGrade.education_level === 'SENIOR_HIGH' && user.strand_id) {
          fetchSections(gradeIdStr, user.strand_id.toString())
        } else if (selectedGrade) {
          fetchSections(gradeIdStr)
        }
      }, 200)
      return () => clearTimeout(timer)
    }
  }

  const handleRetrieve = async () => {
    const id = retrieveId.trim()
    if (!id) {
      notify.warning('ID Number Required', 'Please enter an ID number to retrieve.')
      return
    }

    try {
      setRetrieving(true)
      const response = await fetch(`/api/library-users/lookup/${encodeURIComponent(id)}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.status === 404) {
        await notify.info(
          'No Existing User',
          `No library user found with ID "${id}". You can continue filling out the form to create a new user.`
        )
        setFormData(prev => ({ ...prev, account_id: id }))
        setAccountIdStatus('taken')
        setMode('create')
        setLoadedUserId(null)
        setLoadedUserSnapshot(null)
        setRfidInput('')
        setShowRetrieveModal(false)
        setRetrieveId('')
        return
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to retrieve user')
      }

      const payload = await response.json()
      const user = payload.data || payload
      populateFromUser(user)
      setMode('edit')
      setLoadedUserId(user.user_id)
      setAccountIdStatus('available')
      setRfidInput('')
      setShowRetrieveModal(false)
      setRetrieveId('')
      await notify.success('User Retrieved', `Loaded information for ${user.full_name || user.account_id}.`)
    } catch (error: any) {
      console.error('Error retrieving user:', error)
      await notify.error('Retrieve Failed', error?.message || 'An error occurred while retrieving the user.')
    } finally {
      setRetrieving(false)
    }
  }

  const openRetrieveModal = () => {
    setRetrieveId('')
    setShowRetrieveModal(true)
  }

  const closeRetrieveModal = () => {
    if (retrieving) return
    setShowRetrieveModal(false)
    setRetrieveId('')
  }

  const handleClearLoaded = () => {
    setMode('create')
    setLoadedUserId(null)
    setLoadedUserSnapshot(null)
    setRetrieveId('')
    setRfidInput('')
    setFormData({ ...EMPTY_FORM })
    setAccountIdStatus('idle')
  }

  const handleBindRfid = async () => {
    if (!loadedUserId) return
    const trimmed = rfidInput.trim()
    if (!trimmed) {
      notify.warning('RFID Required', 'Please enter an RFID code to bind.')
      return
    }

    try {
      setRfidBusy(true)
      const response = await fetch(`/api/users/${loadedUserId}/bind-rfid`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rfidCode: trimmed })
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok) {
        await notify.success(
          loadedUserSnapshot?.rfid_code ? 'RFID Updated' : 'RFID Bound',
          loadedUserSnapshot?.rfid_code
            ? `RFID code has been updated for ${formData.first_name} ${formData.last_name}.`
            : `RFID code has been bound to ${formData.first_name} ${formData.last_name}.`
        )
        setFormData(prev => ({ ...prev, rfid_code: trimmed }))
        setLoadedUserSnapshot((prev: any) => prev ? { ...prev, rfid_code: trimmed } : prev)
        setRfidInput('')
      } else if (response.status === 409) {
        await notify.error('RFID Already Bound', data.message || data.error || 'This RFID is already assigned to another user.')
      } else {
        await notify.error('Error', data.error || data.message || 'Failed to bind RFID.')
      }
    } catch (error) {
      console.error('Error binding RFID:', error)
      await notify.error('Error', 'Network error occurred while binding RFID.')
    } finally {
      setRfidBusy(false)
    }
  }

  const handleUnbindRfid = async () => {
    if (!loadedUserId) return
    const confirmed = await notify.confirm(
      'Unbind RFID',
      `Are you sure you want to remove the RFID binding from ${formData.first_name} ${formData.last_name}? This action cannot be undone.`
    )
    if (!confirmed) return

    try {
      setRfidBusy(true)
      const response = await fetch(`/api/users/${loadedUserId}/unbind-rfid`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok) {
        await notify.success('RFID Unbound', `RFID code has been removed from ${formData.first_name} ${formData.last_name}.`)
        setFormData(prev => ({ ...prev, rfid_code: '' }))
        setLoadedUserSnapshot((prev: any) => prev ? { ...prev, rfid_code: '' } : prev)
        setRfidInput('')
      } else {
        await notify.error('Error', data.error || data.message || 'Failed to unbind RFID.')
      }
    } catch (error) {
      console.error('Error unbinding RFID:', error)
      await notify.error('Error', 'Network error occurred while unbinding RFID.')
    } finally {
      setRfidBusy(false)
    }
  }

  const buildFullName = () => {
    const nameParts = [formData.first_name, formData.middle_name, formData.last_name]
      .filter(part => part.trim())
      .join(' ')
    return formData.suffix && formData.suffix.trim()
      ? `${nameParts}, ${formData.suffix.trim()}`
      : nameParts
  }

  const handleCreateSubmit = async () => {
    const full_name = buildFullName()
    const response = await fetch('/api/library-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...formData,
        full_name,
        department_id: formData.department_id ? parseInt(formData.department_id) : null,
        program_id: formData.program_id ? parseInt(formData.program_id) : null,
        office_id: formData.office_id ? parseInt(formData.office_id) : null,
      }),
    })

    if (response.ok) {
      await notify.success('User Created', 'The library user has been added successfully.')
      router.push('/library-users')
      return true
    }
    const error = await response.json()
    await notify.error('Failed to Create User', error.error || error.message || 'Unknown error')
    return false
  }

  const handleUpdateSubmit = async () => {
    if (!loadedUserId) {
      await notify.error('Error', 'No user loaded for update.')
      return false
    }

    const full_name = buildFullName()
    const response = await fetch(`/api/library-users/${loadedUserId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...formData,
        full_name,
        department_id: formData.department_id ? parseInt(formData.department_id) : null,
        program_id: formData.program_id ? parseInt(formData.program_id) : null,
        office_id: formData.office_id ? parseInt(formData.office_id) : null,
      }),
    })

    if (response.ok) {
      await notify.success('User Updated', `Information for ${formData.first_name} ${formData.last_name} has been saved.`)
      router.push('/library-users')
      return true
    }
    const error = await response.json()
    await notify.error('Failed to Update User', error.error || error.message || 'Unknown error')
    return false
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      notify.loading(mode === 'edit' ? 'Updating user...' : 'Creating user...', 'Please wait while we save the record')
      const ok = mode === 'edit' ? await handleUpdateSubmit() : await handleCreateSubmit()
      if (ok) notify.close()
    } catch {
      await notify.error('Network Error', 'An error occurred while saving the user.')
    } finally {
      setSubmitting(false)
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

  return (
    <>
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
                  {mode === 'edit' ? 'Edit Library User' : 'Add Library User'}
                </h1>
                <nav className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                  <span>Library Users</span>
                  <i className="fas fa-chevron-right text-xs"></i>
                  <span className="text-gray-900 font-medium">{mode === 'edit' ? 'Edit User' : 'Add User'}</span>
                </nav>
              </div>
            </div>
            {mode === 'edit' && (
              <span className="inline-flex items-center px-4 py-4 rounded-md text-xs font-semibold bg-amber-100 text-amber-800">
                <i className="fas fa-pen-to-square mr-1.5" />
                Editing existing user
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-sm text-gray-600">
            {mode === 'edit'
              ? `Editing existing user ${formData.first_name} ${formData.last_name} (${formData.account_id}).`
              : 'Fill in the form below to create a new library user.'}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className='bg-primary-600 py-5 px-5 text-white hover:bg-primary-800'
              onClick={openRetrieveModal}
            >
              <i className="fas fa-magnifying-glass mr-2" />
              Retrieve Existing User
            </Button>
            {mode === 'edit' && (
              <Button
                type="button"
                variant="outline"
                onClick={handleClearLoaded}
                className='bg-gray-200 hover:bg-gray-300 px-4 py-5'
              >
                <i className="fas fa-rotate-left mr-2" />
                New
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{mode === 'edit' ? 'Edit User Information' : 'Create New Library User'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input
                  label={<>First Name <span className="text-red-500">*</span></>}
                  placeholder="Enter first name"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  required
                />
                <Input
                  label={<>Last Name <span className="text-red-500">*</span></>}
                  placeholder="Enter last name"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  required
                />
                <Input
                  label="Middle Name (Optional)"
                  placeholder="Enter middle name"
                  value={formData.middle_name}
                  onChange={(e) => handleInputChange('middle_name', e.target.value)}
                />
                <Input
                  label="Suffix (Optional)"
                  placeholder="Jr., Sr., III, etc."
                  value={formData.suffix}
                  onChange={(e) => handleInputChange('suffix', e.target.value)}
                  maxLength={10}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Input
                    label={<>ID Number <span className="text-red-500">*</span></>}
                    placeholder="Enter ID number"
                    value={formData.account_id}
                    onChange={(e) => handleInputChange('account_id', e.target.value)}
                    required
                    error={accountIdStatus === 'taken' && mode === 'create' ? 'This ID Number is already taken' : undefined}
                  />
                  {formData.account_id.length >= 2 && mode === 'create' && (
                    <div className="absolute right-3 top-9 flex items-center">
                      {accountIdStatus === 'checking' && (
                        <div className="flex items-center text-gray-500 text-sm">
                          <i className="fas fa-spinner fa-spin mr-1"></i>
                          <span>Checking...</span>
                        </div>
                      )}
                      {accountIdStatus === 'available' && (
                        <div className="flex items-center text-green-600 text-sm font-medium">
                          <i className="fas fa-check-circle mr-1"></i>
                          <span>Available</span>
                        </div>
                      )}
                      {accountIdStatus === 'taken' && (
                        <div className="flex items-center text-red-600 text-sm font-medium">
                          <i className="fas fa-times-circle mr-1"></i>
                          <span>Already exists</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <Input
                  label="Email"
                  type="email"
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    User Type <span className="text-red-500">*</span>
                  </label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={formData.user_type}
                    onChange={(e) => handleInputChange('user_type', e.target.value)}
                    required
                  >
                    <option value="">Select user type</option>
                    <option value="STUDENT">Student</option>
                    <option value="EMPLOYEE">Employee</option>
                    <option value="ALUMNI">Alumni</option>
                    <option value="GUEST">Guest</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Contact Number"
                  placeholder="Enter contact number"
                  value={formData.contact_number}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '' || /^[0-9]+$/.test(value)) {
                      handleInputChange('contact_number', value)
                    }
                  }}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    required
                  >
                    <option value="">Select status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="SUSPENDED">Suspended</option>
                  </select>
                </div>
                <Input
                  label="Purpose"
                  placeholder="Enter purpose (e.g., Research, Reading)"
                  value={formData.purpose}
                  onChange={(e) => handleInputChange('purpose', e.target.value)}
                />
              </div>

              {formData.user_type === 'STUDENT' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Student Category <span className="text-red-500">*</span>
                      </label>
                      <select 
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        value={formData.student_category}
                        onChange={(e) => handleInputChange('student_category', e.target.value)}
                        required
                      >
                        <option value="">Select Category</option>
                        <option value="COLLEGE">College</option>
                        <option value="BASIC_EDUCATION">Basic Education</option>
                      </select>
                    </div>
                  </div>

                  {formData.student_category === 'COLLEGE' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Department <span className="text-red-500">*</span>
                        </label>
                        <select 
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={formData.department_id}
                          onChange={(e) => handleInputChange('department_id', e.target.value)}
                          required
                        >
                          <option value="">Select Department</option>
                          {departments.map((dept) => (
                            <option key={dept.department_id} value={dept.department_id}>
                              {dept.name} ({dept.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Program <span className="text-red-500">*</span>
                        </label>
                        <select 
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={formData.program_id}
                          onChange={(e) => handleInputChange('program_id', e.target.value)}
                          disabled={!formData.department_id}
                          required
                        >
                          <option value="">Select Program</option>
                          {programs.map((program) => (
                            <option key={program.program_id} value={program.program_id}>
                              {program.name} ({program.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Year Level <span className="text-red-500">*</span>
                        </label>
                        <select 
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={formData.year_level}
                          onChange={(e) => handleInputChange('year_level', e.target.value)}
                          required
                        >
                          <option value="">Select Year Level</option>
                          <option value="1st Year">1st Year</option>
                          <option value="2nd Year">2nd Year</option>
                          <option value="3rd Year">3rd Year</option>
                          <option value="4th Year">4th Year</option>
                          <option value="5th Year">5th Year</option>
                          <option value="1st Year Graduate">1st Year Graduate</option>
                          <option value="2nd Year Graduate">2nd Year Graduate</option>
                          <option value="3rd Year Graduate">3rd Year Graduate</option>
                          <option value="Thesis Writing">Thesis Writing</option>
                          <option value="Dissertation Writing">Dissertation Writing</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {formData.student_category === 'BASIC_EDUCATION' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Education Level <span className="text-red-500">*</span>
                          </label>
                          <select 
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            value={formData.basic_ed_level}
                            onChange={(e) => handleInputChange('basic_ed_level', e.target.value)}
                            required
                          >
                            <option value="">Select Education Level</option>
                            <option value="KINDERGARTEN">Kindergarten</option>
                            <option value="ELEMENTARY">Elementary</option>
                            <option value="JUNIOR_HIGH">Junior High School</option>
                            <option value="SENIOR_HIGH">Senior High School</option>
                          </select>
                        </div>
                      </div>

                      {formData.basic_ed_level && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Grade Level <span className="text-red-500">*</span>
                            </label>
                            <select 
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              value={formData.grade_level_id}
                              onChange={(e) => handleInputChange('grade_level_id', e.target.value)}
                              required
                            >
                              <option value="">Select Grade Level</option>
                              {gradeLevels.map((grade) => (
                                <option key={grade.grade_level_id} value={grade.grade_level_id}>
                                  {grade.name} ({grade.code})
                                </option>
                              ))}
                            </select>
                          </div>

                          {formData.grade_level_id && gradeLevels.find(g => g.grade_level_id.toString() === formData.grade_level_id.toString())?.education_level === 'SENIOR_HIGH' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Strand <span className="text-red-500">*</span>
                              </label>
                              <select 
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                value={formData.strand_id}
                                onChange={(e) => handleInputChange('strand_id', e.target.value)}
                                required
                              >
                                <option value="">Select Strand</option>
                                {strands.map((strand) => (
                                  <option key={strand.strand_id} value={strand.strand_id}>
                                    {strand.name} ({strand.code})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {formData.grade_level_id && (
                            gradeLevels.find(g => g.grade_level_id.toString() === formData.grade_level_id.toString())?.education_level === 'SENIOR_HIGH' 
                              ? formData.strand_id && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Section <span className="text-red-500">*</span>
                                  </label>
                                  <select 
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                    value={formData.section_id}
                                    onChange={(e) => handleInputChange('section_id', e.target.value)}
                                    required
                                  >
                                    <option value="">Select Section</option>
                                    {sections.map((section) => (
                                      <option key={section.section_id} value={section.section_id}>
                                        {section.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )
                              : (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Section <span className="text-red-500">*</span>
                                  </label>
                                  <select 
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                    value={formData.section_id}
                                    onChange={(e) => handleInputChange('section_id', e.target.value)}
                                    required
                                  >
                                    <option value="">Select Section</option>
                                    {sections.map((section) => (
                                      <option key={section.section_id} value={section.section_id}>
                                        {section.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {formData.user_type === 'EMPLOYEE' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Department
                    </label>
                    <select 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      value={formData.department_id}
                      onChange={(e) => handleInputChange('department_id', e.target.value)}
                    >
                      <option value="">Select Department</option>
                      {departments.map((dept) => (
                        <option key={dept.department_id} value={dept.department_id}>
                          {dept.name} ({dept.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Office
                    </label>
                    <select 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      value={formData.office_id}
                      onChange={(e) => handleInputChange('office_id', e.target.value)}
                    >
                      <option value="">Select Office</option>
                      {offices.map((office) => (
                        <option key={office.office_id} value={office.office_id}>
                          {office.name} ({office.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {formData.user_type === 'ALUMNI' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Department
                    </label>
                    <select 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      value={formData.department_id}
                      onChange={(e) => handleInputChange('department_id', e.target.value)}
                    >
                      <option value="">Select Department</option>
                      {departments.map((dept) => (
                        <option key={dept.department_id} value={dept.department_id}>
                          {dept.name} ({dept.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Program
                    </label>
                    <select 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      value={formData.program_id}
                      onChange={(e) => handleInputChange('program_id', e.target.value)}
                      disabled={!formData.department_id}
                    >
                      <option value="">Select Program</option>
                      {programs.map((program) => (
                        <option key={program.program_id} value={program.program_id}>
                          {program.name} ({program.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <Button 
                  type="button"
                  variant="outline" 
                  className="py-5 px-4 bg-gray-100 hover:bg-gray-200"
                  onClick={() => router.back()}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  className='bg-primary-600 hover:bg-primary-700 py-5 px-4 text-white' 
                  disabled={
                    submitting ||
                    !isFormValid ||
                    (mode === 'create' && (accountIdStatus === 'taken' || accountIdStatus === 'checking'))
                  }
                >
                  {submitting 
                    ? (mode === 'edit' ? 'Saving...' : 'Adding...') 
                    : (mode === 'edit' ? 'Update User' : 'Add User')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {mode === 'edit' && loadedUserId && (
          <Card>
            <CardHeader>
              <CardTitle>RFID Binding</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">User:</span>{' '}
                    {formData.first_name} {formData.last_name} ({formData.account_id})
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    <span className="font-medium">Current RFID:</span>{' '}
                    {formData.rfid_code ? (
                      <span className="font-mono font-semibold text-blue-700">{formData.rfid_code}</span>
                    ) : (
                      <span className="text-gray-500 italic">No RFID bound</span>
                    )}
                  </p>
                </div>

                {formData.rfid_code ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleUnbindRfid}
                        disabled={rfidBusy}
                        className="border-red-600 text-red-600 hover:bg-red-50"
                      >
                        <i className="fas fa-unlink mr-2" />
                        Unbind Current RFID
                      </Button>
                    </div>

                    <div className="border-t pt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Change RFID Code
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={rfidInput}
                          onChange={(e) => setRfidInput(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Scan or enter new RFID code"
                          maxLength={50}
                          disabled={rfidBusy}
                        />
                        <Button
                          type="button"
                          onClick={handleBindRfid}
                          disabled={rfidBusy || !rfidInput.trim() || rfidInput.trim() === formData.rfid_code}
                        >
                          {rfidBusy ? (
                            <>
                              <i className="fas fa-spinner fa-spin mr-2" />
                              Updating...
                            </>
                          ) : (
                            <>
                              <i className="fas fa-id-card mr-2" />
                              Update RFID
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Scan a new RFID card to replace the current binding.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bind RFID Code <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={rfidInput}
                        onChange={(e) => setRfidInput(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Scan RFID card..."
                        maxLength={50}
                        autoFocus
                        disabled={rfidBusy}
                      />
                      <Button
                        type="button"
                        onClick={handleBindRfid}
                        className='bg-primary-600 hover:bg-primary-700 py-5 px-4 text-white'
                        disabled={rfidBusy || !rfidInput.trim()}
                      >
                        {rfidBusy ? (
                          <>
                            <i className="fas fa-spinner fa-spin mr-2" />
                            Binding...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-id-card mr-2" />
                            Bind RFID
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Scan the RFID card or manually enter the code to bind it to this user.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {showRetrieveModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeRetrieveModal()
          }}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Retrieve Existing User</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Enter an ID number to load an existing library user into the form.
                </p>
              </div>
              <button
                type="button"
                onClick={closeRetrieveModal}
                disabled={retrieving}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                aria-label="Close"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleRetrieve()
              }}
            >
              <div className="px-6 py-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={retrieveId}
                    onChange={(e) => setRetrieveId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter ID number to retrieve"
                    maxLength={20}
                    disabled={retrieving}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    If no user is found, the ID will be kept in the form so you can create a new record.
                  </p>
                </div>
              </div>

              <div className="px-6 py-3 border-t border-gray-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeRetrieveModal}
                  disabled={retrieving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={retrieving || !retrieveId.trim()}
                >
                  {retrieving ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2" />
                      Retrieving...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-magnifying-glass mr-2" />
                      Retrieve
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
