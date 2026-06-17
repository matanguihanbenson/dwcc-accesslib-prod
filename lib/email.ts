import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

// Lazy-initialized transporter
let transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (!transporter) {
    try {
      // Remove spaces from app password
      const appPassword = (process.env.SMTP_PASS || 'zgginfdtnbkslkzx').replace(/\s/g, '')

      
      transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // Use TLS
        auth: {
          user: process.env.SMTP_USER || 'bangat2707@gmail.com',
          pass: appPassword,
        },
        tls: {
          rejectUnauthorized: false // For development
        }
      })

      // Verify connection configuration (async, but don't wait)
      transporter.verify((error) => {
        if (error) {
          console.log('SMTP Connection Error:', error)
        } else {
          console.log('SMTP Server is ready to send emails')
        }
      })
    } catch (error) {
      console.error('Failed to create email transporter:', error)
      throw error
    }
  }
  
  return transporter
}

export interface SendEmailOptions {
  from?: string
  to: string
  subject: string
  html?: string
  text?: string
  attachments?: any[]
}

export async function sendEmail(options: SendEmailOptions) {
  try {

    
    const emailTransporter = getTransporter()
    console.log('   ✓ Transporter obtained')
    
    const mailOptions = {
      from: options.from || process.env.SMTP_FROM || 'DWCC Library <dwccaccesslib@noreply.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html?.replace(/<[^>]*>/g, ''),
      attachments: options.attachments || []
    }

    const info = await emailTransporter.sendMail(mailOptions)
  
    
    return { 
      success: true, 
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected
    }
  } catch (error) {

    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}


export function formatEmailContent(content: string): string {
  // Replace **text** with bold
  let formatted = content.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #DC2626; font-size: 1.1em;">$1</strong>')
  
  // Replace newlines with <br> and wrap paragraphs
  formatted = formatted
    .split('\n\n')
    .map(para => `<p style="margin: 0 0 15px 0;">${para.replace(/\n/g, '<br>')}</p>`)
    .join('')
  
return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 0;"><div style="max-width: 600px; margin: 20px auto; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"><div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; padding: 30px 20px; text-align: center;"><img src="cid:dwcc-logo" alt="DWCC Logo" style="width: 100px; height: 100px; margin: 0 auto 15px; display: block; object-fit: contain; border-radius: 12px; background: transparent; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);" /><h1 style="margin: 0; font-size: 24px; font-weight: bold;">DWCC Library Notice</h1></div><div style="padding: 30px;">${formatted}</div><div style="background: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #e5e5e5;"><p style="margin: 5px 0; font-size: 12px; color: #666;"><strong>Divine Word College of Calapan</strong></p><p style="margin: 5px 0; font-size: 12px; color: #666;">Library Management System</p><p style="margin-top: 10px; margin-bottom: 5px; font-size: 12px; color: #666;">This is an automated message. Please do not reply to this email.</p></div></div></body></html>`}
