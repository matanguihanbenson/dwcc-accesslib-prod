import { NextResponse } from 'next/server'
import { isSetupRequired } from '@/lib/setup-state'

/**
 * GET /api/setup/status
 *
 * Public endpoint (no auth required) that reports whether the
 * system still needs the initial setup wizard. Used by:
 *   - The middleware to decide whether to redirect every
 *     incoming request to /setup.
 *   - The /setup page itself to detect "setup already done"
 *     and bounce the user to /login.
 *
 * Response shape:
 *   { setupRequired: boolean, timestamp: number }
 *
 * The endpoint is intentionally cheap so the middleware can
 * call it on every request. The actual DB count is cached in
 * `lib/setup-state` for ~30s.
 */
export async function GET() {
  try {
    const setupRequired = await isSetupRequired()
    return NextResponse.json({
      setupRequired,
      timestamp: Date.now()
    })
  } catch (error) {
    // If the DB is unreachable we err on the side of "already
    // set up" so the middleware doesn't trap the user in an
    // unbreakable redirect loop.
    console.error('Failed to read setup state:', error)
    return NextResponse.json(
      { setupRequired: false, timestamp: Date.now(), error: 'state-unavailable' },
      { status: 200 }
    )
  }
}
