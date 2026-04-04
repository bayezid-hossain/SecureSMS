import { create } from 'zustand'
import { BackupFile, EncryptionStatus, RestoreProgress } from '../types/sms.types'
import { BackupListItem } from '../services/backup.service'

interface AppState {
  // Backup list
  backupList: BackupListItem[]
  setBackupList: (list: BackupListItem[]) => void

  // Currently loaded backup
  selectedBackup: BackupFile | null
  setSelectedBackup: (backup: BackupFile | null) => void

  // Restore progress
  restoreProgress: RestoreProgress
  setRestoreProgress: (progress: RestoreProgress) => void

  // Encryption
  encryptionStatus: EncryptionStatus
  setEncryptionStatus: (status: EncryptionStatus) => void

  // Backup creation progress
  backupFetchedCount: number
  setBackupFetchedCount: (count: number) => void

  // Reset
  reset: () => void
}

const defaultProgress: RestoreProgress = {
  total: 0,
  current: 0,
  skipped: 0,
  failed: 0,
  status: 'idle',
}

export const useAppStore = create<AppState>((set) => ({
  backupList: [],
  setBackupList: (list) => set({ backupList: list }),

  selectedBackup: null,
  setSelectedBackup: (backup) => set({ selectedBackup: backup }),

  restoreProgress: defaultProgress,
  setRestoreProgress: (progress) => set({ restoreProgress: progress }),

  encryptionStatus: 'idle',
  setEncryptionStatus: (status) => set({ encryptionStatus: status }),

  backupFetchedCount: 0,
  setBackupFetchedCount: (count) => set({ backupFetchedCount: count }),

  reset: () =>
    set({
      selectedBackup: null,
      restoreProgress: defaultProgress,
      encryptionStatus: 'idle',
      backupFetchedCount: 0,
    }),
}))
