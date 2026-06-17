import { NextRequest } from 'next/server'
import { UserRole } from '@/types'
import { withAuth, createSuccessResponse, validateId, getUserIdFromSession } from '@/lib/api-utils'
import { bookService } from '@/lib/services/book.service'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ transaction_id: string }> }
) {
  const resolvedParams = await params
  const handler = withAuth(
    async (req: NextRequest, session) => {
      const transactionId = validateId(resolvedParams.transaction_id, 'Transaction ID')
    const body = await req.json().catch(() => ({}))
    const { condition_on_return, notes } = body || {}

    // Get the correct user_id from session
    const userId = await getUserIdFromSession(session)
    
    if (!userId) {
      throw new Error('Unable to identify user from session')
    }

    const result = await bookService.returnBook(
      transactionId,
      userId,
      session.user.role,
      condition_on_return,
      notes
    )

    if (!result.success) {
      throw new Error(result.error)
    }

      return createSuccessResponse(null, result.message)
    },
    [UserRole.ADMIN, UserRole.STAFF]
  )
  
  return handler(req)
}