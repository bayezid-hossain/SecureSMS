import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { BackupFile, EncryptionStatus, RestoreProgress } from '../types/sms.types'
import { AppAlertProps } from '../components/AppAlert'
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
  backupTotalCount: number
  setBackupTotalCount: (count: number) => void

  // Global custom alert
  alert: Partial<AppAlertProps> & { visible: boolean }
  showAlert: (props: Omit<AppAlertProps, 'visible'>) => void
  hideAlert: () => void

  // Settings
  autoBackupEnabled: boolean
  setAutoBackupEnabled: (enabled: boolean) => Promise<void>
  autoBackupIntervalDays: number
  setAutoBackupIntervalDays: (days: number) => Promise<void>
  lastAutoBackupAt: number | null
  setLastAutoBackupAt: (ts: number) => Promise<void>
  driveEnabled: boolean
  setDriveEnabled: (enabled: boolean) => Promise<void>

  loadSettings: () => Promise<void>

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

  backupTotalCount: 0,
  setBackupTotalCount: (count) => set({ backupTotalCount: count }),

  alert: { visible: false, title: '' },
  showAlert: (props) => set({ alert: { ...props, visible: true } }),
  hideAlert: () => set((state) => ({ alert: { ...state.alert, visible: false } })),

  autoBackupEnabled: false,
  setAutoBackupEnabled: async (enabled) => {
    set({ autoBackupEnabled: enabled })
    await AsyncStorage.setItem('pref_auto_backup', enabled ? '1' : '0')
  },
  autoBackupIntervalDays: 1,
  setAutoBackupIntervalDays: async (days) => {
    set({ autoBackupIntervalDays: days })
    await AsyncStorage.setItem('pref_auto_interval', String(days))
  },
  lastAutoBackupAt: null,
  setLastAutoBackupAt: async (ts) => {
    set({ lastAutoBackupAt: ts })
    await AsyncStorage.setItem('pref_last_auto_backup', String(ts))
  },
  driveEnabled: false,
  setDriveEnabled: async (enabled) => {
    set({ driveEnabled: enabled })
    await AsyncStorage.setItem('pref_drive_enabled', enabled ? '1' : '0')
  },

  loadSettings: async () => {
    try {
      const auto = await AsyncStorage.getItem('pref_auto_backup')
      const interval = await AsyncStorage.getItem('pref_auto_interval')
      const last = await AsyncStorage.getItem('pref_last_auto_backup')
      const drive = await AsyncStorage.getItem('pref_drive_enabled')

      set({
        autoBackupEnabled: auto === '1',
        autoBackupIntervalDays: interval ? parseInt(interval, 10) : 1,
        lastAutoBackupAt: last ? parseInt(last, 10) : null,
        driveEnabled: drive === '1',
      })
    } catch { /* ignore */ }
  },

  reset: () =>
    set({
      selectedBackup: null,
      restoreProgress: defaultProgress,
      encryptionStatus: 'idle',
      backupFetchedCount: 0,
      backupTotalCount: 0,
      alert: { visible: false, title: '' },
    }),
}))
