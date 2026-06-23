'use client'

import { useSession } from 'next-auth/react'
import { UserRole } from '@/types'
import { useApiSWR } from './useApi'

interface PendingBorrowCount {
  count: number
}

/**
 * Realtime count of `PENDING_APPROVAL` book-borrow transactions.
 *
 * Used by the Sidebar "Books" badge so the Library Admin sees a
 * live count of borrow requests waiting for approval. Polls the
 * lightweight `/api/borrowing-transactions/pending-count` endpoint
 * every 3 seconds (matching the books page's tab badge cadence) so
 * a freshly submitted borrow request shows up almost immediately
 * without requiring a manual refresh.
 *
 * Returns 0 for users who can't see the endpoint (the SWR key is
 * `null` in that case, so no request is fired).
 */
export function usePendingBorrowCount(): number {
  const { data: session } = useSession()
  const userRole = session?.user?.role

  // Only ADMIN and STAFF can see the underlying transactions
  // endpoint. Other roles (USER, SUPER_ADMIN) get a static 0.
  const enabled =
    userRole === UserRole.ADMIN || userRole === UserRole.STAFF

  const { data } = useApiSWR<PendingBorrowCount>(
    enabled ? '/api/borrowing-transactions/pending-count' : null,
    {
      refreshInterval: 3000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 1000
    }
  )

  return data?.count ?? 0
}
