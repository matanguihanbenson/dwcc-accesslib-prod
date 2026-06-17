import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    const userAccount = await prisma.userAccount.findUnique({
      where: { 
        username: username,
        is_active: true 
      },
      select: {
        role: true,
        user: {
          select: {
            full_name: true,
            email: true
          }
        }
      }
    })

    if (!userAccount) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const response = NextResponse.json({
      role: userAccount.role,
      name: userAccount.user.full_name,
      email: userAccount.user.email
    })

    // Prevent caching to ensure fresh data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response
  } catch (error) {
    console.error('Current role fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
