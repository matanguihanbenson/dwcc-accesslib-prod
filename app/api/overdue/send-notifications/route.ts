import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/types'
import { sendEmail, formatEmailContent } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['ADMIN', 'STAFF', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { 
      email_subject,
      email_content,
      user_ids,
      notification_type 
    } = body

    const senderEmail = process.env.SMTP_USER

    if (!email_subject || !email_content || !user_ids || !Array.isArray(user_ids)) {
      return NextResponse.json({ 
        error: 'email_subject, email_content, and user_ids are required' 
      }, { status: 400 })
    }

    if (user_ids.length === 0) {
      return NextResponse.json({ 
        error: 'No users selected to send notifications' 
      }, { status: 400 })
    }

    const users = await prisma.user.findMany({
      where: {
        user_id: { in: user_ids.map(id => parseInt(id)) }
      },
      select: {
        user_id: true,
        full_name: true,
        email: true,
        account_id: true,
        user_type: true
      }
    })

    const results = {
      total: users.length,
      sent: 0,
      failed: 0,
      errors: [] as string[]
    }

    for (const user of users) {
      try {
        if (!user.email) {
          results.failed++
          results.errors.push(`User ${user.full_name} (${user.account_id}) has no email`)
          continue
        }

        const emailResult = await sendEmail({
          from: senderEmail,
          to: user.email,
          subject: email_subject,
          html: formatEmailContent(email_content),
          attachments: [{
            filename: 'logo-dwcc.png',
            path: './public/logo-dwcc.png',
            cid: 'dwcc-logo'
          }]
        })

        if (emailResult.success) {
          results.sent++
        } else {
          results.failed++
          results.errors.push(`Failed for ${user.full_name}: ${emailResult.error}`)
        }
      } catch (error) {
        results.failed++
        results.errors.push(`Exception for ${user.full_name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    try {
      const currentUser = await prisma.userAccount.findUnique({
        where: { username: session.user.username },
        include: { user: true }
      })

      if (currentUser?.user) {
        await prisma.reportLog.create({
          data: {
            generated_by: currentUser.user.user_id,
            module: 'SYSTEM',
            title: `Overdue Notifications Sent (${notification_type})`,
            parameters: JSON.stringify({
              action: 'SEND_OVERDUE_NOTIFICATIONS',
              description: `Sent ${results.sent} overdue notification emails (${notification_type}). Failed: ${results.failed}`,
              sender_email: senderEmail,
              subject: email_subject,
              user_count: users.length,
              sent_count: results.sent,
              failed_count: results.failed,
              errors: results.errors
            })
          }
        })
      }
    } catch (logError) {
    }

    return NextResponse.json({
      success: true,
      message: `Notifications sent to ${results.sent} user(s). ${results.failed} failed.`,
      data: results
    }, {
      headers: {
        'Cache-Control': 'no-store'
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

