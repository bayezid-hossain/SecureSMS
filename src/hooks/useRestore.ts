import { useState, useCallback } from 'react'
import { BackupFile } from '../types/sms.types'
import { restoreBackup } from '../services/restore.service'
import { useAppStore } from '../store/useAppStore'

export function useRestore() {
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setRestoreProgress = useAppStore((s) => s.setRestoreProgress)

  const startRestore = useCallback(
    async (backup: BackupFile) => {
      setIsRunning(true)
      setError(null)
      try {
        await restoreBackup(backup, setRestoreProgress)
      } catch (e: any) {
        setError(e.message ?? 'Restore failed')
      } finally {
        setIsRunning(false)
      }
    },
    [setRestoreProgress]
  )

  return { startRestore, isRunning, error }
}
