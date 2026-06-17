'use client'

import React, { useState, useEffect } from 'react'
import { notify } from '@/lib/notification'

interface UserWithOverdue {
  user_id: number
  full_name: string
  account_id: string
  email: string | null
  user_type: string
  penalty_amount: number
  overdue_type: 'BOOK' | 'LOCKER'
  item_details: string
}

interface SendOverdueNotificationModalProps {
  isOpen: boolean
  onClose: () => void
  overdueBooks: any[]
  overdueLockers: any[]
  userEmail?: string | null
}

export default function SendOverdueNotificationModal({
  isOpen,
  onClose,
  overdueBooks,
  overdueLockers,
  userEmail
}: SendOverdueNotificationModalProps) {
  const [activeTab, setActiveTab] = useState<'books' | 'lockers' | 'all'>('all')
  const [emailSubject, setEmailSubject] = useState('Overdue Item Notice - DWCC AccessLib')
  const [emailContent, setEmailContent] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [isSending, setIsSending] = useState(false)
  
  // Use SMTP_USER as sender (not editable)
  const senderEmail = process.env.NEXT_PUBLIC_SMTP_FROM || 'DWCC Library <dwccaccesslib@noreply.com>'

  // Group users by their overdue items
  const bookUsers = new Map<number, UserWithOverdue>()
  const lockerUsers = new Map<number, UserWithOverdue>()
  
  console.log('Overdue Books received:', overdueBooks?.length || 0)
  console.log('Sample book:', overdueBooks?.[0])
  
  overdueBooks?.forEach((book: any) => {
    // Try to get user_id from different possible locations
    const userId = book.user?.user_id || book.user_id
    
    console.log('Processing book:', {
      title: book.book?.title,
      userId: userId,
      hasUser: !!book.user,
      userKeys: book.user ? Object.keys(book.user) : [],
      remaining_balance: book.remaining_balance
    })
    
    if (!userId) {
      console.warn('Book missing user_id:', book)
      return
    }
    
    const existing = bookUsers.get(userId)
    if (existing) {
      existing.penalty_amount += book.remaining_balance || 0
      existing.item_details += `, ${book.book?.title || 'Unknown'}`
    } else {
      bookUsers.set(userId, {
        user_id: userId,
        full_name: book.user?.full_name || 'Unknown',
        account_id: book.user?.account_id || '',
        email: book.user?.email || null,
        user_type: book.user?.user_type || '',
        penalty_amount: book.remaining_balance || 0,
        overdue_type: 'BOOK',
        item_details: book.book?.title || 'Unknown'
      })
    }
  })
  
  console.log('Book users map size:', bookUsers.size)

  overdueLockers?.forEach((locker: any) => {
    // Try to get user_id from different possible locations
    const userId = locker.user?.user_id || locker.user_id
    
    if (!userId) {
      console.warn('Locker missing user_id:', locker)
      return
    }
    
    const existing = lockerUsers.get(userId)
    if (existing) {
      existing.penalty_amount += locker.remaining_balance || 0
      existing.item_details += `, ${locker.locker?.locker_number || 'Unknown'}`
    } else {
      lockerUsers.set(userId, {
        user_id: userId,
        full_name: locker.user?.full_name || 'Unknown',
        account_id: locker.user?.account_id || '',
        email: locker.user?.email || null,
        user_type: locker.user?.user_type || '',
        penalty_amount: locker.remaining_balance || 0,
        overdue_type: 'LOCKER',
        item_details: locker.locker?.locker_number || 'Unknown'
      })
    }
  })
  
  console.log('Locker users map size:', lockerUsers.size)

  const allUsers = new Map<number, UserWithOverdue>()
  bookUsers.forEach((user, id) => allUsers.set(id, user))
  lockerUsers.forEach((user, id) => {
    if (allUsers.has(id)) {
      const existing = allUsers.get(id)!
      existing.penalty_amount += user.penalty_amount
      existing.item_details += `, ${user.item_details}`
    } else {
      allUsers.set(id, user)
    }
  })

  const bookUsersList = Array.from(bookUsers.values())
  const lockerUsersList = Array.from(lockerUsers.values())
  const allUsersList = Array.from(allUsers.values())

  const getCurrentList = () => {
    switch (activeTab) {
      case 'books': return bookUsersList
      case 'lockers': return lockerUsersList
      default: return allUsersList
    }
  }

  const currentList = getCurrentList()

  // Initialize default content
  useEffect(() => {
    setEmailContent(`Dear [Student/User],

This is a friendly reminder that you have overdue items with the Divine Word College of Calapan Library (DWCC AccessLib).

Please return the overdue items and settle any pending penalties at your earliest convenience to avoid further charges.

If you have already returned the items, please disregard this notice.

For questions or concerns, please visit the library or contact us.

Thank you for your cooperation.

Best regards,
DWCC Library Staff`)
  }, [])

  // Select all on tab change
  useEffect(() => {
    setSelectedUsers(currentList.map(u => u.user_id))
  }, [activeTab])

  const toggleUser = (userId: number) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedUsers.length === currentList.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(currentList.map(u => u.user_id))
    }
  }

  const getTotalPenalty = () => {
    return currentList
      .filter(u => selectedUsers.includes(u.user_id))
      .reduce((sum, u) => sum + u.penalty_amount, 0)
  }

  const handleSendNotifications = async () => {
    if (selectedUsers.length === 0) {
      await notify.error('No Users Selected', 'Please select at least one user to send notifications')
      return
    }

    const usersWithoutEmail = currentList.filter(u => 
      selectedUsers.includes(u.user_id) && !u.email
    )

    if (usersWithoutEmail.length > 0) {
      const proceed = window.confirm(
        `${usersWithoutEmail.length} user(s) don't have email addresses. Do you want to continue sending to the rest?`
      )
      if (!proceed) return
    }

    setIsSending(true)
    try {
      const response = await fetch('/api/overdue/send-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email_subject: emailSubject,
          email_content: emailContent,
          user_ids: selectedUsers,
          notification_type: activeTab === 'all' ? 'ALL' : activeTab.toUpperCase()
        })
      })

      const result = await response.json()

      if (response.ok) {
        await notify.success(
          'Notifications Sent!', 
          `Successfully sent ${result.data.sent} notification(s). ${result.data.failed > 0 ? `Failed: ${result.data.failed}` : ''}`
        )
        onClose()
      } else {
        await notify.error('Error', result.error || 'Failed to send notifications')
      }
    } catch (error) {
      console.error('Error sending notifications:', error)
      await notify.error('Error', 'Network error occurred while sending notifications')
    } finally {
      setIsSending(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-red-600 to-orange-600">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">
                <i className="fas fa-envelope mr-2"></i>
                Send Overdue Notifications
              </h2>
              <p className="text-sm text-white text-opacity-90 mt-1">
                Send email notifications to users with overdue items
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 p-1"
              disabled={isSending}
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Sender Email (Read-only) */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sender Email (System Default)
            </label>
            <input
              type="email"
              value={senderEmail}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
            />
          </div>

          {/* Subject */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Email Content */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Content <span className="text-red-500">*</span>
            </label>
            <textarea
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 font-mono text-sm"
            />
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-4">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'all'
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                All ({allUsersList.length})
              </button>
              <button
                onClick={() => setActiveTab('books')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'books'
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <i className="fas fa-book mr-1"></i>
                Books ({bookUsersList.length})
              </button>
              <button
                onClick={() => setActiveTab('lockers')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'lockers'
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <i className="fas fa-key mr-1"></i>
                Lockers ({lockerUsersList.length})
              </button>
            </div>
          </div>

          {/* User List */}
          <div className="border border-gray-200 rounded-md">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedUsers.length === currentList.length && currentList.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  Select All ({selectedUsers.length}/{currentList.length})
                </span>
              </div>
              <span className="text-sm text-gray-600">
                Total Penalty: ₱{getTotalPenalty().toFixed(2)}
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {currentList.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <i className="fas fa-inbox text-4xl mb-2"></i>
                  <p>No users with overdue items</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left w-12"></th>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">ID Number</th>
                      <th className="px-4 py-2 text-left">Email</th>
                      <th className="px-4 py-2 text-right">Penalty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentList.map((user) => (
                      <tr
                        key={user.user_id}
                        className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                          selectedUsers.includes(user.user_id) ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => toggleUser(user.user_id)}
                      >
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(user.user_id)}
                            onChange={() => {}}
                            className="rounded"
                          />
                        </td>
                        <td className="px-4 py-2 font-medium">{user.full_name}</td>
                        <td className="px-4 py-2 text-gray-600">{user.account_id}</td>
                        <td className="px-4 py-2">
                          {user.email ? (
                            <span className="text-gray-600">{user.email}</span>
                          ) : (
                            <span className="text-red-500 text-xs">
                              <i className="fas fa-exclamation-circle mr-1"></i>
                              No email
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-red-600">
                          ₱{user.penalty_amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selectedUsers.length > 0 && (
              <span>
                <i className="fas fa-info-circle mr-1"></i>
                {selectedUsers.length} recipient(s) selected
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSendNotifications}
              disabled={isSending || selectedUsers.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSending ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Sending...
                </>
              ) : (
                <>
                  <i className="fas fa-paper-plane"></i>
                  Send Notifications
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

