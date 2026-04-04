import { BackupFile, Message, RestoreProgress } from '../types/sms.types'
import { isDefaultSmsApp, readAllSms, groupIntoThreads, insertSmsBatch } from './sms.service'
import { isDuplicate } from './diff.service'

export async function restoreBackup(
  backup: BackupFile,
  onProgress?: (progress: RestoreProgress) => void
): Promise<RestoreProgress> {
  // 1. Must be default SMS app
  const isDefault = await isDefaultSmsApp()
  if (!isDefault) {
    throw new Error('App must be set as default SMS app before restoring')
  }

  // 2. Read existing device messages for dedup check
  const existingMessages = await readAllSms()

  // 3. Collect all backup messages
  const allBackupMessages: Message[] = backup.threads.flatMap((t) => t.messages)

  // 4. Filter out duplicates
  const toInsert = allBackupMessages.filter((msg) => !isDuplicate(msg, existingMessages))
  const skipped = allBackupMessages.length - toInsert.length

  const progress: RestoreProgress = {
    total: toInsert.length,
    current: 0,
    skipped,
    failed: 0,
    status: 'running',
  }

  onProgress?.(progress)

  // 5. Insert in batches, tracking progress
  const result = await insertSmsBatch(toInsert, (done, total) => {
    progress.current = done
    onProgress?.({ ...progress })
  })

  progress.current = toInsert.length
  progress.failed = result.failed
  progress.status = result.failed === 0 ? 'done' : 'error'

  onProgress?.(progress)
  return progress
}
