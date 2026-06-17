import { prisma } from '@/lib/prisma'
import { NotificationType, NotificationStatus } from '@/types'

export interface CreateNotificationData {
  user_id: number
  type: NotificationType
  title: string
  message: string
  metadata?: any
}

export class NotificationService {
  static async createNotification(data: CreateNotificationData) {
    try {
      const notification = await prisma.notificationLog.create({
        data: {
          user_id: data.user_id,
          type: data.type,
          title: data.title,
          message: data.message,
          status: NotificationStatus.QUEUED,
          metadata: data.metadata
        }
      })

      return { success: true, data: notification }
    } catch (error) {
      console.error('Error creating notification:', error)
      return { success: false, error: 'Failed to create notification' }
    }
  }

  static async createBulkNotifications(notifications: CreateNotificationData[]) {
    try {
      const createdNotifications = await prisma.notificationLog.createMany({
        data: notifications.map(notif => ({
          ...notif,
          status: NotificationStatus.QUEUED,
          metadata: notif.metadata ? JSON.stringify(notif.metadata) : null
        }))
      })

      return { success: true, count: createdNotifications.count }
    } catch (error) {
      console.error('Error creating bulk notifications:', error)
      return { success: false, error: 'Failed to create notifications' }
    }
  }

  static async notifyBookOverdue(userId: number, bookTitle: string, dueDate: Date) {
    const daysOverdue = Math.floor(
      (new Date().getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    return this.createNotification({
      user_id: userId,
      type: NotificationType.BOOK_OVERDUE,
      title: 'Book Overdue',
      message: `"${bookTitle}" is ${daysOverdue} day(s) overdue. Please return it as soon as possible.`,
      metadata: { bookTitle, dueDate: dueDate.toISOString(), daysOverdue }
    })
  }

  static async notifyLockerOverdue(userId: number, lockerNumber: string, dueDate: Date) {
    const daysOverdue = Math.floor(
      (new Date().getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    return this.createNotification({
      user_id: userId,
      type: NotificationType.LOCKER_OVERDUE,
      title: 'Locker Overdue',
      message: `Locker ${lockerNumber} is ${daysOverdue} day(s) overdue. Please return the key.`,
      metadata: { lockerNumber, dueDate: dueDate.toISOString(), daysOverdue }
    })
  }

  static async notifyBookApproved(userId: number, bookTitle: string, dueDate: Date) {
    return this.createNotification({
      user_id: userId,
      type: NotificationType.BOOK_APPROVED,
      title: 'Book Request Approved',
      message: `Your request for "${bookTitle}" has been approved. Please pick it up before ${dueDate.toLocaleDateString()}.`,
      metadata: { bookTitle, dueDate: dueDate.toISOString() }
    })
  }

  static async notifyBookRejected(userId: number, bookTitle: string, reason: string) {
    return this.createNotification({
      user_id: userId,
      type: NotificationType.BOOK_REJECTED,
      title: 'Book Request Rejected',
      message: `Your request for "${bookTitle}" has been rejected. Reason: ${reason}`,
      metadata: { bookTitle, reason }
    })
  }

  static async notifyLockerAssigned(userId: number, lockerNumber: string, dueDate: Date) {
    return this.createNotification({
      user_id: userId,
      type: NotificationType.LOCKER_ASSIGNED,
      title: 'Locker Assigned',
      message: `Locker ${lockerNumber} has been assigned to you. Please return the key by ${dueDate.toLocaleDateString()}.`,
      metadata: { lockerNumber, dueDate: dueDate.toISOString() }
    })
  }

  static async notifySystemAlert(userId: number, title: string, message: string, metadata?: any) {
    return this.createNotification({
      user_id: userId,
      type: NotificationType.SYSTEM_ALERT,
      title,
      message,
      metadata
    })
  }

  static async notifyAccountUpdate(userId: number, updateType: string, details: string) {
    return this.createNotification({
      user_id: userId,
      type: NotificationType.ACCOUNT_UPDATE,
      title: 'Account Updated',
      message: `Your account has been updated: ${updateType}. ${details}`,
      metadata: { updateType, details }
    })
  }

  static async markNotificationAsSent(notificationId: number) {
    try {
      await prisma.notificationLog.update({
        where: { notification_id: notificationId },
        data: { 
          status: NotificationStatus.SENT,
          sent_at: new Date()
        }
      })
      return { success: true }
    } catch (error) {
      console.error('Error marking notification as sent:', error)
      return { success: false, error: 'Failed to update notification status' }
    }
  }
}

export const notificationService = NotificationService
