import { useState, useCallback } from 'react'
import { createBackup, listBackups, checkRedundancy } from '../services/backup.service'
import { useAppStore } from '../store/useAppStore'

export function useBackup() {
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setBackupList = useAppStore((s) => s.setBackupList)
  const setEncryptionStatus = useAppStore((s) => s.setEncryptionStatus)
  const setBackupFetchedCount = useAppStore((s) => s.setBackupFetchedCount)
  const setBackupTotalCount = useAppStore((s) => s.setBackupTotalCount)

  const startBackup = useCallback(
    async (password?: string) => {
      setIsRunning(true)
      setError(null)
      if (password) setEncryptionStatus('encrypting')

      try {
        await createBackup({
          password,
          onProgress: (fetched, total) => {
            setBackupFetchedCount(fetched)
            if (total !== undefined) setBackupTotalCount(total)
          },
        })
        if (password) setEncryptionStatus('done')
        const list = await listBackups()
        setBackupList(list)
      } catch (e: any) {
        setError(e.message ?? 'Backup failed')
        setEncryptionStatus('error')
      } finally {
        setIsRunning(false)
      }
    },
    [setBackupList, setEncryptionStatus, setBackupFetchedCount]
  )

  const refreshList = useCallback(async () => {
    const list = await listBackups()
    setBackupList(list)
  }, [setBackupList])

  return { startBackup, refreshList, isRunning, error, checkRedundancy }
}
