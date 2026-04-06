import * as FileSystem from 'expo-file-system/legacy'
import * as Device from 'expo-device'
import { BackupFile, BackupMetadata, Thread } from '../types/sms.types'
import { hashBackupPayload } from '../utils/hash'
import { readAllSms, groupIntoThreads } from './sms.service'
import { encrypt, EncryptedPayload } from './encryption.service'

export const BACKUP_DIR = `${FileSystem.documentDirectory}backups/`
const BACKUP_VERSION = '1.0.0'

export async function ensureBackupDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(BACKUP_DIR)
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true })
  }
}

export async function createBackup(
  options: {
    password?: string
    onProgress?: (fetched: number, total: number) => void
  } = {}
): Promise<string> {
  await ensureBackupDir()

  // 1. Read all SMS
  const messages = await readAllSms(options.onProgress)

  // 2. Group into threads
  const threads = groupIntoThreads(messages)

  // 3. Build index: threadId -> position
  const index: Record<string, number> = {}
  threads.forEach((t, i) => {
    index[t.id] = i
  })

  // 4. Hash the payload
  const hash = await hashBackupPayload(threads)

  // 5. Build metadata
  const metadata: BackupMetadata = {
    version: BACKUP_VERSION,
    createdAt: Date.now(),
    device: `${Device.brand ?? 'Unknown'} ${Device.modelName ?? ''}`.trim(),
    hash,
    messageCount: messages.length,
    threadCount: threads.length,
  }

  const backup: BackupFile = { metadata, threads, index }
  const json = JSON.stringify(backup)

  // 6. Optionally encrypt
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  let filename: string
  let content: string

  if (options.password) {
    const encrypted: EncryptedPayload = await encrypt(json, options.password)
    content = JSON.stringify(encrypted)
    filename = `backup_${timestamp}.enc.json`
  } else {
    content = json
    filename = `backup_${timestamp}.json`
  }

  const filePath = `${BACKUP_DIR}${filename}`
  await FileSystem.writeAsStringAsync(filePath, content, {
    encoding: FileSystem.EncodingType.UTF8,
  })

  return filePath
}

export interface BackupListItem {
  filename: string
  filePath: string
  createdAt: number
  encrypted: boolean
  size: number
}

export async function listBackups(): Promise<BackupListItem[]> {
  await ensureBackupDir()
  const files = await FileSystem.readDirectoryAsync(BACKUP_DIR)

  const items = await Promise.all(
    files
      .filter((f) => f.endsWith('.json'))
      .map(async (filename) => {
        const filePath = `${BACKUP_DIR}${filename}`
        const info = await FileSystem.getInfoAsync(filePath)
        return {
          filename,
          filePath,
          createdAt: info.exists ? ((info as any).modificationTime ?? 0) * 1000 : 0,
          encrypted: filename.endsWith('.enc.json'),
          size: info.exists ? (info as any).size ?? 0 : 0,
        }
      })
  )

  return items.sort((a, b) => b.createdAt - a.createdAt)
}

export async function loadBackup(filePath: string, password?: string): Promise<BackupFile> {
  const raw = await FileSystem.readAsStringAsync(filePath, {
    encoding: FileSystem.EncodingType.UTF8,
  })

  const isEncrypted = filePath.endsWith('.enc.json')

  if (isEncrypted) {
    if (!password) throw new Error('Password required to decrypt backup')
    const { decrypt } = await import('./encryption.service')
    const payload = JSON.parse(raw) as EncryptedPayload
    const json = await decrypt(payload, password)
    try {
      return JSON.parse(json) as BackupFile
    } catch {
      throw new Error('Incorrect password. Please try again.')
    }
  }

  return JSON.parse(raw) as BackupFile
}

export async function deleteBackup(filePath: string): Promise<void> {
  await FileSystem.deleteAsync(filePath, { idempotent: true })
}
