import { NextRequest } from 'next/server'
import { authMiddleware } from './lib/auth-middleware'

export async function middleware(request: NextRequest) {
  return authMiddleware(request)
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
