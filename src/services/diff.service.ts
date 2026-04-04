import { Message, Thread, DiffResult } from '../types/sms.types'

function messageKey(msg: Message): string {
  return `${msg.address}|${msg.date}|${msg.body}`
}

/**
 * Compare backup threads against current device messages.
 * Returns what's added (in backup but not on device),
 * removed (on device but not in backup),
 * and conflicts (same timestamp+address but different body).
 */
export function diffThreads(
  backupThreads: Thread[],
  deviceThreads: Thread[]
): DiffResult {
  const backupMessages = backupThreads.flatMap((t) => t.messages)
  const deviceMessages = deviceThreads.flatMap((t) => t.messages)

  const deviceByKey = new Map<string, Message>()
  const deviceByPartialKey = new Map<string, Message>() // address|date

  for (const msg of deviceMessages) {
    deviceByKey.set(messageKey(msg), msg)
    deviceByPartialKey.set(`${msg.address}|${msg.date}`, msg)
  }

  const backupByKey = new Map<string, Message>()
  for (const msg of backupMessages) {
    backupByKey.set(messageKey(msg), msg)
  }

  const added: Message[] = []
  const conflicts: import('../types/sms.types').MessageConflict[] = []

  for (const msg of backupMessages) {
    const key = messageKey(msg)
    if (!deviceByKey.has(key)) {
      const partialKey = `${msg.address}|${msg.date}`
      if (deviceByPartialKey.has(partialKey)) {
        conflicts.push({
          local: deviceByPartialKey.get(partialKey)!,
          backup: msg,
        })
      } else {
        added.push(msg)
      }
    }
  }

  const removed: Message[] = []
  for (const msg of deviceMessages) {
    if (!backupByKey.has(messageKey(msg))) {
      removed.push(msg)
    }
  }

  return { added, removed, conflicts }
}

export function isDuplicate(msg: Message, existingMessages: Message[]): boolean {
  return existingMessages.some(
    (e) => e.date === msg.date && e.address === msg.address && e.body === msg.body
  )
}
