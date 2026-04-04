/**
 * Bridge to the Kotlin SmsModule native module.
 * All SMS I/O flows through this file.
 */
import { NativeModules } from 'react-native'
import { Message, Thread } from '../types/sms.types'

const { SmsModule } = NativeModules

const BATCH_SIZE = 400

export async function isDefaultSmsApp(): Promise<boolean> {
  return SmsModule.isDefaultSmsApp()
}

/**
 * Show the system "Change default SMS app" dialog (ACTION_CHANGE_DEFAULT).
 * Resolves immediately after launching — use AppState to detect when the
 * user returns and call isDefaultSmsApp() to check the result.
 */
export async function requestDefaultSmsApp(): Promise<void> {
  return SmsModule.requestDefaultSmsApp()
}

/**
 * Opens Android's Default Apps settings screen (Q+) or the legacy
 * ACTION_CHANGE_DEFAULT dialog (pre-Q) so the user can manually set
 * this app as the default SMS handler.
 * Resolves immediately — use AppState/useFocusEffect to re-check afterwards.
 */
export async function openDefaultSmsSettings(): Promise<void> {
  return SmsModule.openDefaultSmsSettings()
}

export async function readSmsPage(offset: number, limit: number): Promise<Message[]> {
  const json: string = await SmsModule.readSmsPage(offset, limit)
  return JSON.parse(json) as Message[]
}

export async function readAllSms(
  onProgress?: (fetched: number, total: number) => void
): Promise<Message[]> {
  const all: Message[] = []
  let offset = 0

  while (true) {
    const batch = await readSmsPage(offset, BATCH_SIZE)
    if (batch.length === 0) break
    all.push(...batch)
    offset += batch.length
    onProgress?.(all.length, all.length) // total unknown until done
    if (batch.length < BATCH_SIZE) break
  }

  return all
}

export function groupIntoThreads(messages: Message[]): Thread[] {
  const threadMap = new Map<string, Thread>()

  for (const msg of messages) {
    const key = msg.threadId
    if (!threadMap.has(key)) {
      threadMap.set(key, {
        id: key,
        address: msg.address,
        messages: [],
      })
    }
    threadMap.get(key)!.messages.push(msg)
  }

  // Sort messages within each thread by date ascending
  for (const thread of threadMap.values()) {
    thread.messages.sort((a, b) => a.date - b.date)
    thread.lastMessage = thread.messages[thread.messages.length - 1]
    thread.unreadCount = thread.messages.filter((m) => m.read === 0).length
  }

  // Sort threads by last message date descending
  return Array.from(threadMap.values()).sort(
    (a, b) => (b.lastMessage?.date ?? 0) - (a.lastMessage?.date ?? 0)
  )
}

export async function insertSms(message: Message): Promise<void> {
  if (!(await isDefaultSmsApp())) {
    throw new Error('App must be default SMS handler to restore messages')
  }
  await SmsModule.insertSms(JSON.stringify(message))
}

export async function insertSmsBatch(
  messages: Message[],
  onProgress?: (done: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0

  for (let i = 0; i < messages.length; i++) {
    try {
      await insertSms(messages[i])
      success++
    } catch {
      failed++
    }
    onProgress?.(i + 1, messages.length)
  }

  return { success, failed }
}
