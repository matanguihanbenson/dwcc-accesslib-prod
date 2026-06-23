import { prisma } from '@/lib/prisma'

/**
 * Cached "is the system already set up?" check used by the
 * setup-wizard middleware and the /api/setup/status endpoint.
 *
 * Why a cache:
 *   - The middleware runs on every page request, so the
 *     super-admin count check would otherwise hit the DB on
 *     every navigation.
 *   - The check only flips one way (no super admin -> super
 *     admin exists) so a 30s TTL is fine: a freshly created
 *     super admin will be visible to the rest of the system
 *     within 30s, and the create endpoint invalidates the
 *     cache immediately so the next /setup visit is correct.
 */

interface CachedState {
  setupRequired: boolean
  expiresAt: number
}

const CACHE_TTL_MS = 30_000 // 30 seconds

let cached: CachedState | null = null

/**
 * Read the current setup state. Returns `true` when no
 * SUPER_ADMIN account exists yet.
 */
export async function isSetupRequired(): Promise<boolean> {
  const now = Date.now()
  if (cached && cached.expiresAt > now) {
    return cached.setupRequired
  }
  const superAdminCount = await prisma.userAccount.count({
    where: { role: 'SUPER_ADMIN', is_active: true }
  })
  const setupRequired = superAdminCount === 0
  cached = { setupRequired, expiresAt: now + CACHE_TTL_MS }
  return setupRequired
}

/**
 * Drop the cached state. Called by the super-admin create
 * endpoint right after it inserts the new account so the
 * next /setup visit is treated as "already set up" without
 * waiting for the TTL.
 */
export function invalidateSetupStateCache(): void {
  cached = null
}
