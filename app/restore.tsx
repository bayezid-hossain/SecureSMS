import React, { useEffect, useState, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Alert, ActivityIndicator, AppState, AppStateStatus,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { AppHeader } from '../src/components/AppHeader'
import { BottomNav } from '../src/components/BottomNav'
import { C, R, S } from '../src/theme'
import { loadBackup } from '../src/services/backup.service'
import { diffThreads } from '../src/services/diff.service'
import { restoreBackup } from '../src/services/restore.service'
import {
  isDefaultSmsApp, requestDefaultSmsApp,
  openDefaultSmsSettings, readAllSms, groupIntoThreads,
} from '../src/services/sms.service'
import { useAppStore } from '../src/store/useAppStore'
import { formatDate } from '../src/utils/date'
import type { BackupFile, DiffResult, Message } from '../src/types/sms.types'

export default function RestoreScreen() {
  const router = useRouter()
  const { filePath, encrypted } = useLocalSearchParams<{ filePath?: string; encrypted?: string }>()

  const [diff, setDiff] = useState<DiffResult | null>(null)
  const [loadedBackup, setLoadedBackup] = useState<BackupFile | null>(null)
  const [loading, setLoading] = useState(!!filePath)
  const [restoring, setRestoring] = useState(false)
  const [requestingDefault, setRequestingDefault] = useState(false)
  const [isDefault, setIsDefault] = useState<boolean | null>(null)
  const setRestoreProgress = useAppStore(s => s.setRestoreProgress)
  const sentToSettingsRef = useRef(false)

  // Re-check default SMS status whenever the app comes back to foreground
  // (user may have set it in Settings and returned)
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state: AppStateStatus) => {
      if (state === 'active' && sentToSettingsRef.current) {
        sentToSettingsRef.current = false
        const result = await isDefaultSmsApp()
        setIsDefault(result)
        if (result) {
          Alert.alert('Default App Set', 'SecureSMS is now your default SMS app. You can confirm the restore.')
        }
      }
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    // Check default app status on mount
    isDefaultSmsApp().then(setIsDefault).catch(() => setIsDefault(false))

    if (!filePath) return
    ;(async () => {
      try {
        const backup = await loadBackup(filePath)
        setLoadedBackup(backup)
        const deviceMessages = await readAllSms()
        const deviceThreads = groupIntoThreads(deviceMessages)
        const result = diffThreads(backup.threads, deviceThreads)
        setDiff(result)
      } catch {
        Alert.alert('Error', 'Failed to load backup file.')
      } finally {
        setLoading(false)
      }
    })()
  }, [filePath])

  async function handleConfirmRestore() {
    if (!loadedBackup) return

    const currentlyDefault = isDefault ?? (await isDefaultSmsApp())
    setIsDefault(currentlyDefault)

    if (!currentlyDefault) {
      Alert.alert(
        'Default SMS App Required',
        'SecureSMS must be your default SMS app to insert messages. Both options below will ask you to confirm — come back here afterwards.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Change via Dialog',
            onPress: async () => {
              sentToSettingsRef.current = true
              await requestDefaultSmsApp()   // fires ACTION_CHANGE_DEFAULT dialog
            },
          },
          {
            text: 'Open Settings',
            onPress: async () => {
              sentToSettingsRef.current = true
              await openDefaultSmsSettings() // opens Default Apps settings page
            },
          },
        ]
      )
      return
    }

    setRestoring(true)
    try {
      await restoreBackup(loadedBackup, (progress) => setRestoreProgress(progress))
      Alert.alert(
        'Restore Complete',
        'All messages have been restored successfully.',
        [{ text: 'Done', onPress: () => router.back() }]
      )
    } catch (e: any) {
      Alert.alert('Restore Failed', e?.message ?? 'Unknown error occurred.')
    } finally {
      setRestoring(false)
    }
  }

  const addedCount = diff?.added.length ?? 0
  const removedCount = diff?.removed.length ?? 0
  const conflictCount = diff?.conflicts.length ?? 0

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <AppHeader onBack={() => router.back()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Title */}
        <View style={{ gap: 4 }}>
          <Text style={styles.pageTitle}>Review Restoration</Text>
          <Text style={styles.pageSub}>Compare local state with encrypted vault backup.</Text>
        </View>

        {/* Stats Bento */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            {loading
              ? <ActivityIndicator color={C.primary} size="small" style={{ marginBottom: 8 }} />
              : <MaterialIcons name="add-circle" size={24} color={C.primary} style={{ marginBottom: 8 }} />
            }
            <Text style={[styles.statNum, { color: C.primary }]}>
              {loading ? '—' : `+${addedCount.toLocaleString()}`}
            </Text>
            <Text style={styles.statSub}>New messages found</Text>
          </View>
          <View style={styles.statCard}>
            {loading
              ? <ActivityIndicator color={C.error} size="small" style={{ marginBottom: 8 }} />
              : <MaterialIcons name="remove-circle" size={24} color={C.error} style={{ marginBottom: 8 }} />
            }
            <Text style={[styles.statNum, { color: C.error }]}>
              {loading ? '—' : `-${removedCount.toLocaleString()}`}
            </Text>
            <Text style={styles.statSub}>Messages to be removed</Text>
          </View>
          <View style={styles.statCard}>
            {loading
              ? <ActivityIndicator color={C.tertiary} size="small" style={{ marginBottom: 8 }} />
              : <MaterialIcons name="warning" size={24} color={C.tertiary} style={{ marginBottom: 8 }} />
            }
            <Text style={[styles.statNum, { color: C.tertiary }]}>
              {loading ? '—' : conflictCount.toLocaleString()}
            </Text>
            <Text style={styles.statSub}>Manual conflicts</Text>
          </View>
        </View>

        {/* Conflict Resolution */}
        <View style={{ gap: S.sm }}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Conflict Resolution</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillTxt}>
                {loading ? 'Analyzing' : conflictCount > 0 ? 'Needs Review' : 'No Conflicts'}
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={C.primary} size="small" />
              <Text style={{ color: C.textMuted, fontSize: 13, marginLeft: 10 }}>
                Reading device messages & computing diff...
              </Text>
            </View>
          ) : conflictCount === 0 ? (
            <View style={styles.emptyConflicts}>
              <MaterialIcons name="check-circle" size={36} color={C.primary} />
              <Text style={styles.emptyConflictsTxt}>
                {addedCount === 0 && removedCount === 0
                  ? 'Backup matches your device exactly — nothing to restore.'
                  : 'No conflicts detected. Safe to confirm restore.'}
              </Text>
            </View>
          ) : (
            diff!.conflicts.map((msg, i) => (
              <ConflictCard key={`${msg.id}-${i}`} message={msg} index={i} />
            ))
          )}
        </View>

        <View style={{ height: 160 }} />
      </ScrollView>

      {/* Sticky Footer */}
      <View style={styles.footer}>
        <View style={styles.footerIntegrity}>
          <MaterialIcons
            name={isDefault ? 'verified-user' : 'security'}
            size={20}
            color={isDefault ? C.primary : C.textMuted}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.footerIntegrityTitle}>
              Default SMS App:{' '}
              <Text style={{ color: isDefault ? C.primary : C.error }}>
                {isDefault === null ? 'Checking…' : isDefault ? 'This app ✓' : 'Not set — tap Confirm to fix'}
              </Text>
            </Text>
            <Text style={styles.footerIntegritySub}>
              {loadedBackup
                ? `${loadedBackup.metadata.messageCount?.toLocaleString() ?? '?'} messages · ${loadedBackup.metadata.device}`
                : 'AES-256 Encrypted Vault'}
            </Text>
          </View>
        </View>
        <View style={styles.footerBtns}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} activeOpacity={0.85}>
            <Text style={styles.cancelBtnTxt}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, (loading || restoring || requestingDefault) && { opacity: 0.6 }]}
            onPress={handleConfirmRestore}
            disabled={loading || restoring || requestingDefault}
            activeOpacity={0.85}
          >
            {restoring || requestingDefault
              ? <ActivityIndicator color={C.onPrimary} size="small" />
              : <Text style={styles.confirmBtnTxt}>Confirm Restore</Text>
            }
          </TouchableOpacity>
        </View>
      </View>

      <BottomNav />
    </View>
  )
}

function ConflictCard({ message, index }: { message: Message; index: number }) {
  const isEdited = message.type === 1 // inbound = might be locally-edited version
  const label = isEdited ? 'Edited' : 'Conflict'
  const pillStyle = isEdited ? styles.editedPill : styles.removedPill
  const pillTxtStyle = isEdited ? styles.editedPillTxt : styles.removedPillTxt
  const name = message.address ?? `Unknown #${index + 1}`
  const shortName = name.length > 20 ? name.slice(0, 18) + '…' : name

  return (
    <View style={styles.conflictCard}>
      <View style={styles.conflictHeader}>
        <View style={[styles.conflictAvatar, isEdited ? styles.conflictAvatarPrimary : styles.conflictAvatarError]}>
          <MaterialIcons name="person" size={16} color={isEdited ? C.primary : C.error} />
        </View>
        <Text style={styles.conflictName}>{shortName}</Text>
        <View style={pillStyle}>
          <Text style={pillTxtStyle}>{label}</Text>
        </View>
      </View>
      <View style={styles.diffRow}>
        <View style={[styles.diffSide, { backgroundColor: C.surfaceContainerLowest + '4D' }]}>
          <Text style={styles.diffSideLabel}>Local Device</Text>
          <View style={styles.localBubble}>
            <Text style={styles.diffMsgText} numberOfLines={4}>{message.body}</Text>
            <Text style={styles.diffTimestamp}>{formatDate(message.date)}</Text>
          </View>
        </View>
        <View style={[styles.diffSide, { backgroundColor: 'rgba(0,107,93,0.05)' }]}>
          <View style={styles.diffSideLabelRow}>
            <Text style={[styles.diffSideLabel, { color: C.primary }]}>Vault Backup</Text>
            <MaterialIcons name="verified-user" size={14} color={C.primary} />
          </View>
          <View style={styles.vaultBubble}>
            <Text style={styles.diffMsgText} numberOfLines={4}>{message.body}</Text>
            <Text style={[styles.diffTimestamp, { color: 'rgba(114,237,214,0.6)' }]}>
              {formatDate(message.dateSent ?? message.date)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { padding: S.lg, gap: S.lg },

  pageTitle: { fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  pageSub: { fontSize: 14, color: C.textMuted, lineHeight: 22 },

  statsRow: { flexDirection: 'row', gap: S.sm },
  statCard: {
    flex: 1, backgroundColor: C.surfaceContainerHigh,
    borderRadius: R.xl, padding: S.md,
  },
  statNum: { fontSize: 22, fontWeight: '800' },
  statSub: { fontSize: 11, color: C.textMuted, marginTop: 2, lineHeight: 16 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 4,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  statusPill: {
    backgroundColor: C.surfaceContainer, borderRadius: R.sm,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  statusPillTxt: {
    fontSize: 9, fontWeight: '900', color: C.textFaint,
    textTransform: 'uppercase', letterSpacing: 1.5,
  },

  loadingCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surfaceContainerLow, borderRadius: R.xl, padding: S.lg,
  },

  emptyConflicts: {
    alignItems: 'center', paddingVertical: 32, gap: 12,
    backgroundColor: C.surfaceContainerLow, borderRadius: R.xl,
  },
  emptyConflictsTxt: {
    fontSize: 13, color: C.textMuted, textAlign: 'center',
    paddingHorizontal: S.lg, lineHeight: 20,
  },

  conflictCard: {
    backgroundColor: C.surfaceContainerLow,
    borderRadius: R.xl, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(62,73,70,0.1)',
  },
  conflictHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.surfaceContainerHigh,
    paddingHorizontal: S.md, paddingVertical: 12,
  },
  conflictAvatar: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  conflictAvatarPrimary: { backgroundColor: 'rgba(93,218,195,0.15)' },
  conflictAvatarError: { backgroundColor: 'rgba(147,0,10,0.2)' },
  conflictName: { flex: 1, fontSize: 13, fontWeight: '700', color: C.text },
  editedPill: {
    backgroundColor: 'rgba(93,218,195,0.1)', borderRadius: R.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  editedPillTxt: {
    fontSize: 9, fontWeight: '800', color: C.primary,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  removedPill: {
    backgroundColor: 'rgba(255,180,171,0.1)', borderRadius: R.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  removedPillTxt: {
    fontSize: 9, fontWeight: '800', color: C.error,
    textTransform: 'uppercase', letterSpacing: 1,
  },

  diffRow: { flexDirection: 'row' },
  diffSide: { flex: 1, padding: S.md, gap: 8 },
  diffSideLabel: {
    fontSize: 9, fontWeight: '800', color: C.textFaint,
    textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4,
  },
  diffSideLabelRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 4,
  },
  localBubble: {
    backgroundColor: C.surfaceVariant,
    borderRadius: R.xl, borderBottomLeftRadius: 3, padding: S.md,
  },
  vaultBubble: {
    backgroundColor: C.primaryContainer,
    borderRadius: R.xl, borderBottomRightRadius: 3, padding: S.md,
  },
  diffMsgText: { fontSize: 12, color: C.text, lineHeight: 18 },
  diffTimestamp: {
    fontSize: 9, color: 'rgba(226,226,229,0.5)',
    marginTop: 4, textAlign: 'right', fontStyle: 'italic',
  },

  footer: {
    backgroundColor: 'rgba(18,20,22,0.97)',
    paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.sm,
    borderTopWidth: 1, borderTopColor: 'rgba(62,73,70,0.1)',
    gap: S.sm,
  },
  footerIntegrity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footerIntegrityTitle: { fontSize: 13, fontWeight: '700', color: C.text },
  footerIntegritySub: { fontSize: 10, color: C.textMuted },
  footerBtns: { flexDirection: 'row', gap: S.sm },
  cancelBtn: {
    flex: 1, backgroundColor: C.surfaceBright, borderRadius: R.xl,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(62,73,70,0.15)',
  },
  cancelBtnTxt: { color: C.text, fontWeight: '700', fontSize: 14 },
  confirmBtn: {
    flex: 2, backgroundColor: C.primaryContainer,
    borderRadius: R.xl, paddingVertical: 14, alignItems: 'center',
  },
  confirmBtnTxt: { color: C.text, fontWeight: '800', fontSize: 14 },
})
