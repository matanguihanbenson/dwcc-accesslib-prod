import { EventEmitter } from 'events'

declare global {
  var __entryLogEmitter: EventEmitter | undefined
}

export const entryLogEmitter: EventEmitter = global.__entryLogEmitter || new EventEmitter()
if (!global.__entryLogEmitter) {
  global.__entryLogEmitter = entryLogEmitter
  entryLogEmitter.setMaxListeners(100)
}

export function broadcastEntryLog(log: any) {
  try {
    entryLogEmitter.emit('entry-log', log)
  } catch (e) {
    console.error('broadcastEntryLog error', e)
  }
}
