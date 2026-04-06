import * as FileSystem from 'expo-file-system/legacy'
import * as Device from 'expo-device'
import { useAppStore } from '../store/useAppStore'
import { useDriveStore } from '../store/drive.store'
import { BackupFile, BackupMetadata, Thread, Message } from '../types/sms.types'
import { hashBackupPayload } from '../utils/hash'
import { readAllSms, groupIntoThreads, getLatestMessageDate, getSmsCount } from './sms.service'
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
    latestMessageDate: messages.length > 0 ? Math.max(...messages.map(m => m.date)) : 0,
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

  // 7. Auto Upload if configured
  const driveEnabled = useAppStore.getState().driveEnabled
  const activeAccount = useDriveStore.getState().activeAccount

  if (driveEnabled && activeAccount) {
    try {
      const { signInSilently, getAccessToken, getOrCreateFolder, uploadFile } = await import('./drive.service')
      const user = await signInSilently()
      if (user) {
        const token = await getAccessToken()
        const folderId = await getOrCreateFolder(token)
        await uploadFile(filename, content, folderId, token)
        useDriveStore.getState().setLastSyncAt(Date.now())
      }
    } catch (e) {
      console.error('Auto upload failed:', e)
      // We don't throw here to avoid failing the local backup if only upload failed
    }
  }

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

/**
 * Returns the metadata of the most recent local backup by reading just the meta section.
 */
export async function getLatestBackupMetadata(): Promise<BackupMetadata | null> {
  const list = await listBackups()
  if (list.length === 0) return null

  const first = list[0]
  try {
    const raw = await FileSystem.readAsStringAsync(first.filePath, { encoding: FileSystem.EncodingType.UTF8 })
    const json = JSON.parse(raw)
    // If encrypted, we can't easily read metadata without password unless we change format.
    // For now, if encrypted, we assume we need a full read or skip optimization.
    if (first.encrypted) return null 
    return (json as BackupFile).metadata
  } catch {
    return null
  }
}

/**
 * Checks if a new backup is actually needed by comparing device stats 
 * with the latest backup's metadata.
 */
export async function checkRedundancy(): Promise<{ needed: boolean; reason?: string }> {
  const latestMeta = await getLatestBackupMetadata()
  if (!latestMeta) return { needed: true, reason: 'No previous unencrypted backup found' }

  const [currentCount, currentLatestDate] = await Promise.all([
    getSmsCount(),
    getLatestMessageDate()
  ])

  if (currentCount > latestMeta.messageCount) {
    return { needed: true, reason: 'New messages detected' }
  }

  if (currentLatestDate > (latestMeta.latestMessageDate ?? 0)) {
      return { needed: true, reason: 'Recent messages updated' }
  }

  return { needed: false, reason: 'No new messages since last backup' }
}
