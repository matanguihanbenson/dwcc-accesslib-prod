'use client'

import React, { useState, useEffect } from 'react'
import { notify } from '@/lib/notification'

interface SendIndividualNotificationModalProps {
  isOpen: boolean
  onClose: () => void
  user: {
    user_id: number
    full_name: string
    account_id: string
    email: string | null
    user_type?: string
  }
  overdueType: 'BOOK' | 'LOCKER'
  itemDetails: {
    name: string
    daysOrHours: number
    penalty: number
    dueDate?: string
    isHours?: boolean
  }
  senderEmail?: string | null
}

export default function SendIndividualNotificationModal({
  isOpen,
  onClose,
  user,
  overdueType,
  itemDetails,
  senderEmail
}: SendIndividualNotificationModalProps) {
  const [emailSubject, setEmailSubject] = useState('')
  const [emailContent, setEmailContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  
  // Use SMTP_USER as sender (not editable)
  const systemSenderEmail = process.env.NEXT_PUBLIC_SMTP_FROM || 'DWCC Library <dwccaccesslib@noreply.com>'

  useEffect(() => {
    const timeLabel = itemDetails.isHours ? 'hours' : 'days'
    const itemType = overdueType === 'BOOK' ? 'book' : 'locker'

    setEmailSubject(`Overdue ${overdueType === 'BOOK' ? 'Book' : 'Locker'} Notice - DWCC AccessLib`)

    setEmailContent(`Dear ${user.full_name},

This is a friendly reminder regarding your overdue ${itemType}:

${overdueType === 'BOOK' ? `Book Title: ${itemDetails.name}` : `Locker Number: ${itemDetails.name}`}
${itemDetails.dueDate ? `Due Date: ${new Date(itemDetails.dueDate).toLocaleDateString()}` : ''}
Overdue By: ${itemDetails.daysOrHours} ${timeLabel}
**Current Fine: ₱${itemDetails.penalty.toFixed(2)}**

Please ${overdueType === 'BOOK' ? 'return the book' : 'return the locker'} and settle the pending fine at your earliest convenience to avoid further charges.

${overdueType === 'BOOK' 
  ? 'You can visit the library during operating hours to return the book and settle your penalty.'
  : 'Please come to the library to return the locker key and settle your penalty.'}

If you have already ${overdueType === 'BOOK' ? 'returned the book' : 'returned the locker'}, please disregard this notice.

For questions or concerns, please visit the library or contact us.

Thank you for your cooperation.

Best regards,
DWCC Library Staff`)
  }, [user, overdueType, itemDetails])

  const handleSendNotification = async () => {
    if (!user.email) {
      await notify.error('No Email', 'This user does not have an email address on file')
      return
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
          user_ids: [user.user_id],
          notification_type: overdueType
        })
      })

      const result = await response.json()

      if (response.ok) {
        await notify.success('Notification Sent!', `Email notification sent to ${user.full_name}`)
        onClose()
      } else {
        await notify.error('Error', result.error || 'Failed to send notification')
      }
    } catch (error) {
      console.error('Error sending notification:', error)
      await notify.error('Error', 'Network error occurred while sending notification')
    } finally {
      setIsSending(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`px-6 py-4 border-b ${
          overdueType === 'BOOK' 
            ? 'bg-gradient-to-r from-red-600 to-orange-600' 
            : 'bg-gradient-to-r from-orange-600 to-yellow-600'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">
                <i className={`fas ${overdueType === 'BOOK' ? 'fa-book' : 'fa-key'} mr-2`}></i>
                Send {overdueType === 'BOOK' ? 'Book' : 'Locker'} Overdue Notice
              </h2>
              <p className="text-sm text-white text-opacity-90 mt-1">
                To: {user.full_name} ({user.account_id})
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
          {/* User Email Warning */}
          {!user.email && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700">
              <i className="fas fa-exclamation-triangle"></i>
              <span className="text-sm font-medium">This user does not have an email address on file</span>
            </div>
          )}

          {/* Overdue Info */}
          <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-md">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Overdue Information</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">{overdueType === 'BOOK' ? 'Book:' : 'Locker:'}</span>
                <div className="font-medium">{itemDetails.name}</div>
              </div>
              <div>
                <span className="text-gray-600">Overdue:</span>
                <div className="font-medium">{itemDetails.daysOrHours} {itemDetails.isHours ? 'hours' : 'days'}</div>
              </div>
              <div className="col-span-2">
                <span className="text-gray-600">Fine:</span>
                <div className="text-xl font-bold text-red-600">₱{itemDetails.penalty.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Sender Email (Read-only) */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sender Email (System Default)
            </label>
            <input
              type="email"
              value={systemSenderEmail}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
            />
          </div>

          {/* Recipient Email */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recipient Email
            </label>
            <input
              type="email"
              value={user.email || 'No email on file'}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
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
              rows={12}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Tip: Use **text** to highlight important information like the fine amount
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {user.email ? (
              <span>
                <i className="fas fa-envelope mr-1"></i>
                Ready to send
              </span>
            ) : (
              <span className="text-red-600">
                <i className="fas fa-exclamation-circle mr-1"></i>
                Cannot send - no email
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
              onClick={handleSendNotification}
              disabled={isSending || !user.email}
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
                  Send Notification
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

