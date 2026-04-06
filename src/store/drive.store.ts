/**
 * Zustand store for Google Drive multi-account management + sync state.
 * Accounts are persisted in AsyncStorage.
 */
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { CustomRule } from '../utils/rules'

const STORAGE_KEY = 'drive_active_account'
const RULES_STORAGE_KEY = 'cleanup_custom_rules'

export interface DriveAccount {
  email: string
  displayName?: string
  photo?: string | null
  connectedAt: number
}

interface DriveState {
  activeAccount: DriveAccount | null
  syncStatus: 'idle' | 'syncing' | 'done' | 'error'
  syncError: string | null
  lastSyncAt: number | null
  customRules: CustomRule[]

  // Actions
  loadStore: () => Promise<void>
  setActiveAccount: (account: DriveAccount | null) => Promise<void>
  setCustomRules: (rules: CustomRule[]) => Promise<void>
  addCustomRule: (rule: CustomRule) => Promise<void>
  updateCustomRule: (id: string, updates: Partial<CustomRule>) => Promise<void>
  deleteCustomRule: (id: string) => Promise<void>
  setSyncStatus: (status: DriveState['syncStatus'], error?: string | null) => void
  setLastSyncAt: (ts: number) => void
}

export const useDriveStore = create<DriveState>((set, get) => ({
  activeAccount: null,
  syncStatus: 'idle',
  syncError: null,
  lastSyncAt: null,
  customRules: [],

  loadStore: async () => {
    try {
      const activeRaw = await AsyncStorage.getItem(STORAGE_KEY)
      if (activeRaw) {
        set({ activeAccount: JSON.parse(activeRaw) })
      }
      const rulesRaw = await AsyncStorage.getItem(RULES_STORAGE_KEY)
      if (rulesRaw) {
        set({ customRules: JSON.parse(rulesRaw) })
      }
    } catch { /* ignore */ }
  },

  setActiveAccount: async (account) => {
    set({ activeAccount: account })
    if (account) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(account))
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY)
    }
  },

  setCustomRules: async (rules) => {
    set({ customRules: rules })
    await AsyncStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules))
  },

  addCustomRule: async (rule) => {
    const rules = [...get().customRules, rule]
    set({ customRules: rules })
    await AsyncStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules))
  },

  updateCustomRule: async (id, updates) => {
    const rules = get().customRules.map(r => r.id === id ? { ...r, ...updates } : r)
    set({ customRules: rules })
    await AsyncStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules))
  },

  deleteCustomRule: async (id) => {
    const rules = get().customRules.filter(r => r.id !== id)
    set({ customRules: rules })
    await AsyncStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules))
  },

  setSyncStatus: (status, error = null) =>
    set({ syncStatus: status, syncError: error }),

  setLastSyncAt: (ts) => set({ lastSyncAt: ts }),
}))
