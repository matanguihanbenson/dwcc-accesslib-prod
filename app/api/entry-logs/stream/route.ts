import { NextRequest } from 'next/server'
import { entryLogEmitter } from '@/lib/realtime'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Server-Sent Events endpoint for real-time entry logs
export async function GET(req: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: any) => {
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`)
      }
      const onLog = (log: any) => send({ type: 'entry-log', payload: log })
      entryLogEmitter.on('entry-log', onLog)
      // Heartbeat to keep connection alive (30s)
      const heartbeat = setInterval(() => controller.enqueue(':\n\n'), 30000)
      // Initial hello
      send({ type: 'hello', ts: Date.now() })
      // Close handling
      ;(req as any).signal?.addEventListener('abort', () => {
        clearInterval(heartbeat)
        entryLogEmitter.off('entry-log', onLog)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  })
}
