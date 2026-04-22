import React, { useEffect, useState, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, AppState, AppStateStatus,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { AppHeader } from '../src/components/AppHeader'
import { BottomNav } from '../src/components/BottomNav'
import { PasswordUnlockModal } from '../src/components/PasswordUnlockModal'
import { C, R, S } from '../src/theme'
import { loadBackup } from '../src/services/backup.service'
import { diffThreads } from '../src/services/diff.service'
import { restoreBackup } from '../src/services/restore.service'
import {
  isDefaultSmsApp, requestDefaultSmsApp,
  openDefaultSmsSettings, readAllSms, groupIntoThreads,
} from '../src/services/sms.service'
import { useAppStore } from '../src/store/useAppStore'
import { useAlert } from '../src/hooks/useAlert'
import { formatDate, formatTime } from '../src/utils/date'
import type { BackupFile, DiffResult, Message, MessageConflict } from '../src/types/sms.types'

type TabKey = 'added' | 'removed' | 'conflicts'
type ViewMode = 'side' | 'stack'

// ---------- helpers ----------

/** Find changed span in `str` relative to `other`. Returns [prefix, changed, suffix] */
function spanDiff(str: string, other: string): [string, string, string] {
  let s = 0
  const minLen = Math.min(str.length, other.length)
  while (s < minLen && str[s] === other[s]) s++
  // expand back to word boundary
  while (s > 0 && str[s - 1] !== ' ' && str[s - 1] !== '\n') s--

  let eS = str.length - 1
  let eO = other.length - 1
  while (eS >= s && eO >= s && str[eS] === other[eO]) { eS--; eO-- }
  // expand forward to word boundary
  while (eS < str.length - 1 && str[eS + 1] !== ' ' && str[eS + 1] !== '\n') eS++

  return [str.slice(0, s), str.slice(s, eS + 1), str.slice(eS + 1)]
}

// ---------- sub-components ----------

function TabBar({
  active, counts, onSelect,
}: {
  active: TabKey
  counts: { added: number; removed: number; conflicts: number }
  onSelect: (t: TabKey) => void
}) {
  const tabs: { key: TabKey; label: string; color: string; icon: string }[] = [
    { key: 'added', label: 'Added', color: C.primary, icon: 'add-circle-outline' },
    { key: 'removed', label: 'Removed', color: C.error, icon: 'remove-circle-outline' },
    { key: 'conflicts', label: 'Conflicts', color: C.tertiary, icon: 'warning-amber' },
  ]
  return (
    <View style={tab.row}>
      {tabs.map(t => {
        const isActive = active === t.key
        const count = counts[t.key]
        return (
          <TouchableOpacity
            key={t.key}
            style={[tab.btn, isActive && { borderBottomColor: t.color, borderBottomWidth: 2 }]}
            onPress={() => onSelect(t.key)}
            activeOpacity={0.7}
          >
            <MaterialIcons name={t.icon as any} size={14} color={isActive ? t.color : C.textFaint} />
            <Text style={[tab.label, isActive && { color: t.color }]}>{t.label}</Text>
            <View style={[tab.badge, { backgroundColor: `${t.color}22` }]}>
              <Text style={[tab.badgeTxt, { color: t.color }]}>{count}</Text>
            </View>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const tab = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: C.surfaceContainerHigh,
    borderRadius: R.xl, padding: 3, gap: 2,
  },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 10, paddingHorizontal: 6,
    borderRadius: R.lg, borderBottomWidth: 0,
  },
  label: { fontSize: 11, fontWeight: '700', color: C.textFaint },
  badge: {
    minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeTxt: { fontSize: 10, fontWeight: '800' },
})

function MessageCard({ msg, accent }: { msg: Message; accent: string }) {
  const isSent = msg.type === 2
  return (
    <View style={[card.wrap, { borderLeftColor: accent, borderLeftWidth: 3 }]}>
      <View style={card.header}>
        <View style={[card.avatar, { backgroundColor: `${accent}22` }]}>
          <MaterialIcons name="person" size={14} color={accent} />
        </View>
        <Text style={card.addr} numberOfLines={1}>{msg.address ?? 'Unknown'}</Text>
        <Text style={card.date}>{formatDate(msg.date)}</Text>
        <Text style={card.time}>{formatTime(msg.date)}</Text>
        <View style={[card.typeBadge, { backgroundColor: `${accent}15` }]}>
          <Text style={[card.typeTxt, { color: accent }]}>{isSent ? 'Sent' : 'Recv'}</Text>
        </View>
      </View>
      <Text style={card.body}>{msg.body}</Text>
    </View>
  )
}

const card = StyleSheet.create({
  wrap: {
    backgroundColor: C.surfaceContainerLow,
    borderRadius: R.xl, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(62,73,70,0.08)',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: S.md, paddingVertical: 10,
    backgroundColor: C.surfaceContainerHigh,
  },
  avatar: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  addr: { flex: 1, fontSize: 13, fontWeight: '700', color: C.text },
  date: { fontSize: 10, color: C.textFaint },
  time: { fontSize: 10, color: C.textFaint },
  typeBadge: { borderRadius: R.sm, paddingHorizontal: 6, paddingVertical: 2 },
  typeTxt: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  body: { fontSize: 13, color: C.text, lineHeight: 20, padding: S.md },
})

function DiffText({
  local, vault, which,
}: { local: string; vault: string; which: 'local' | 'vault' }) {
  const str = which === 'local' ? local : vault
  const other = which === 'local' ? vault : local
  const [prefix, changed, suffix] = spanDiff(str, other)
  const highlightColor = which === 'local' ? C.error : C.primary
  const highlightBg = which === 'local' ? 'rgba(147,0,10,0.18)' : 'rgba(93,218,195,0.18)'

  return (
    <Text style={diff.bodyText}>
      {prefix}
      {changed.length > 0 && (
        <Text style={[diff.highlight, { color: highlightColor, backgroundColor: highlightBg }]}>
          {changed}
        </Text>
      )}
      {suffix}
    </Text>
  )
}

const diff = StyleSheet.create({
  bodyText: { fontSize: 13, color: C.text, lineHeight: 20 },
  highlight: { fontWeight: '700', borderRadius: 3 },
})

function ConflictCard({
  conflict, index, viewMode,
}: { conflict: MessageConflict; index: number; viewMode: ViewMode }) {
  const name = conflict.local.address ?? `Unknown #${index + 1}`
  const shortName = name.length > 24 ? name.slice(0, 22) + '…' : name
  const sameText = conflict.local.body === conflict.backup.body

  if (viewMode === 'side') {
    return (
      <View style={cs.card}>
        <View style={cs.header}>
          <View style={cs.avatar}>
            <MaterialIcons name="person" size={16} color={C.tertiary} />
          </View>
          <Text style={cs.name}>{shortName}</Text>
          <Text style={cs.dateSmall}>{formatDate(conflict.local.date)}</Text>
          {sameText && (
            <View style={cs.pill}>
              <Text style={cs.pillTxt}>DATE DIFF</Text>
            </View>
          )}
        </View>
        <View style={cs.sideRow}>
          <View style={[cs.side, cs.sideLocal]}>
            <Text style={cs.sideLabel}>Device</Text>
            <Text style={cs.sideBody} numberOfLines={6}>{conflict.local.body}</Text>
            <Text style={cs.sideTime}>{formatDate(conflict.local.date)}</Text>
          </View>
          <View style={cs.divider} />
          <View style={[cs.side, cs.sideVault]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
              <Text style={[cs.sideLabel, { color: C.primary }]}>Vault</Text>
              <MaterialIcons name="verified-user" size={10} color={C.primary} />
            </View>
            <Text style={cs.sideBody} numberOfLines={6}>{conflict.backup.body}</Text>
            <Text style={[cs.sideTime, { color: 'rgba(114,237,214,0.5)' }]}>
              {formatDate(conflict.backup.dateSent ?? conflict.backup.date)}
            </Text>
          </View>
        </View>
      </View>
    )
  }

  // Stacked view with diff highlighting
  return (
    <View style={cs.card}>
      <View style={cs.header}>
        <View style={cs.avatar}>
          <MaterialIcons name="person" size={16} color={C.tertiary} />
        </View>
        <Text style={cs.name}>{shortName}</Text>
        <Text style={cs.dateSmall}>{formatDate(conflict.local.date)}</Text>
      </View>

      {/* Local */}
      <View style={cs.stackSide}>
        <Text style={cs.stackLabel}>Local Device</Text>
        <View style={cs.stackBubbleLocal}>
          <DiffText local={conflict.local.body} vault={conflict.backup.body} which="local" />
          <Text style={[cs.sideTime, { marginTop: 6 }]}>{formatDate(conflict.local.date)} {formatTime(conflict.local.date)}</Text>
        </View>
      </View>

      {/* Arrow */}
      <View style={cs.stackArrow}>
        <View style={cs.stackArrowLine} />
        <MaterialIcons name="arrow-downward" size={16} color={C.textFaint} />
        <View style={cs.stackArrowLine} />
      </View>

      {/* Vault */}
      <View style={cs.stackSide}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={[cs.stackLabel, { color: C.primary }]}>Vault Backup</Text>
          <MaterialIcons name="verified-user" size={10} color={C.primary} />
        </View>
        <View style={cs.stackBubbleVault}>
          <DiffText local={conflict.local.body} vault={conflict.backup.body} which="vault" />
          <Text style={[cs.sideTime, { color: 'rgba(114,237,214,0.5)', marginTop: 6 }]}>
            {formatDate(conflict.backup.dateSent ?? conflict.backup.date)} {formatTime(conflict.backup.dateSent ?? conflict.backup.date)}
          </Text>
        </View>
      </View>
    </View>
  )
}

const cs = StyleSheet.create({
  card: {
    backgroundColor: C.surfaceContainerLow,
    borderRadius: R.xl, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(62,73,70,0.1)',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.surfaceContainerHigh,
    paddingHorizontal: S.md, paddingVertical: 10,
  },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(93,218,195,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  name: { flex: 1, fontSize: 13, fontWeight: '700', color: C.text },
  dateSmall: { fontSize: 10, color: C.textFaint },
  pill: {
    backgroundColor: 'rgba(93,218,195,0.1)', borderRadius: R.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  pillTxt: { fontSize: 8, fontWeight: '800', color: C.tertiary, letterSpacing: 0.5 },

  // Side-by-side
  sideRow: { flexDirection: 'row' },
  side: { flex: 1, padding: S.md },
  sideLocal: { backgroundColor: 'rgba(147,0,10,0.04)' },
  sideVault: { backgroundColor: 'rgba(93,218,195,0.04)' },
  divider: { width: 1, backgroundColor: 'rgba(62,73,70,0.1)' },
  sideLabel: {
    fontSize: 9, fontWeight: '800', color: C.textFaint,
    textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8,
  },
  sideBody: { fontSize: 12, color: C.text, lineHeight: 18, flex: 1 },
  sideTime: {
    fontSize: 9, color: 'rgba(226,226,229,0.4)',
    marginTop: 6, fontStyle: 'italic',
  },

  // Stacked
  stackSide: { paddingHorizontal: S.md, paddingVertical: S.sm },
  stackLabel: {
    fontSize: 9, fontWeight: '800', color: C.textFaint,
    textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6,
  },
  stackBubbleLocal: {
    backgroundColor: 'rgba(147,0,10,0.07)',
    borderRadius: R.lg, borderBottomLeftRadius: 4,
    padding: S.md,
    borderWidth: 1, borderColor: 'rgba(147,0,10,0.12)',
  },
  stackBubbleVault: {
    backgroundColor: 'rgba(93,218,195,0.07)',
    borderRadius: R.lg, borderBottomRightRadius: 4,
    padding: S.md,
    borderWidth: 1, borderColor: 'rgba(93,218,195,0.15)',
  },
  stackArrow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.lg,
    gap: 8, opacity: 0.4,
  },
  stackArrowLine: { flex: 1, height: 1, backgroundColor: C.textFaint },
})

// ---------- main screen ----------

export default function RestoreScreen() {
  const router = useRouter()
  const { alert } = useAlert()
  const { filePath, encrypted } = useLocalSearchParams<{ filePath?: string; encrypted?: string }>()

  const [diff, setDiff] = useState<DiffResult | null>(null)
  const [loadedBackup, setLoadedBackup] = useState<BackupFile | null>(null)
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [isDefault, setIsDefault] = useState<boolean | null>(null)
  const [unlockVisible, setUnlockVisible] = useState(encrypted === '1')
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)

  const [activeTab, setActiveTab] = useState<TabKey>('added')
  const [viewMode, setViewMode] = useState<ViewMode>('stack')

  const setRestoreProgress = useAppStore(s => s.setRestoreProgress)
  const sentToSettingsRef = useRef(false)

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state: AppStateStatus) => {
      if (state === 'active' && sentToSettingsRef.current) {
        sentToSettingsRef.current = false
        const result = await isDefaultSmsApp()
        setIsDefault(result)
        if (result) {
          alert('Default App Set', 'SecureSMS is now your default SMS app. You can confirm the restore.', undefined, 'verified-user')
        }
      }
    })
    return () => sub.remove()
  }, [])

  async function loadAndDiff(password?: string) {
    if (!filePath) return
    setLoading(true)
    try {
      const backup = await loadBackup(filePath, password)
      setLoadedBackup(backup)
      const deviceMessages = await readAllSms()
      const deviceThreads = groupIntoThreads(deviceMessages)
      const result = diffThreads(backup.threads, deviceThreads)
      setDiff(result)
      // Auto-select tab with most content
      if (result.added.length >= result.removed.length && result.added.length >= result.conflicts.length) {
        setActiveTab('added')
      } else if (result.removed.length >= result.conflicts.length) {
        setActiveTab('removed')
      } else {
        setActiveTab('conflicts')
      }
    } catch (eValue: any) {
      throw eValue
    } finally {
      setLoading(false)
    }
  }

  async function handleUnlock(password: string) {
    setUnlocking(true)
    setUnlockError(null)
    try {
      await loadAndDiff(password)
      setUnlockVisible(false)
    } catch (eError: any) {
      setUnlockError(eError?.message ?? 'Failed to decrypt.')
    } finally {
      setUnlocking(false)
    }
  }

  useEffect(() => {
    isDefaultSmsApp().then(setIsDefault).catch(() => setIsDefault(false))
    if (encrypted !== '1') {
      loadAndDiff().catch(() => alert('Error', 'Failed to load backup file.'))
    }
  }, [filePath])

  async function handleConfirmRestore() {
    if (!loadedBackup) return
    const currentlyDefault = isDefault ?? (await isDefaultSmsApp())
    setIsDefault(currentlyDefault)
    if (!currentlyDefault) {
      const result = await requestDefaultSmsApp()
      if (!result) return // User cancelled again, stay on screen
      setIsDefault(true)
    }
    setRestoring(true)
    try {
      await restoreBackup(loadedBackup, (progress) => setRestoreProgress(progress))
      alert('Restore Complete', 'All messages have been restored successfully.', [{ text: 'Done', onPress: () => router.back() }], 'check-circle')
    } catch (eVal: any) {
      alert('Restore Failed', eVal?.message ?? 'Unknown error occurred.', [{ text: 'OK', style: 'cancel' }], 'error')
    } finally {
      setRestoring(false)
    }
  }

  const addedCount = diff?.added.length ?? 0
  const removedCount = diff?.removed.length ?? 0
  const conflictCount = diff?.conflicts.length ?? 0

  function renderContent() {
    if (loading) {
      return (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={C.primary} size="small" />
          <Text style={{ color: C.textMuted, fontSize: 13, marginLeft: 12 }}>
            Reading device messages & computing diff…
          </Text>
        </View>
      )
    }
    if (!diff) return null

    if (activeTab === 'added') {
      if (diff.added.length === 0) return <EmptyState icon="inbox" text="No new messages — backup matches device." />
      return diff.added.map((msg, i) => (
        <MessageCard key={`a-${msg.date}-${i}`} msg={msg} accent={C.primary} />
      ))
    }

    if (activeTab === 'removed') {
      if (diff.removed.length === 0) return <EmptyState icon="check-circle" text="No messages removed since backup." />
      return diff.removed.map((msg, i) => (
        <MessageCard key={`r-${msg.date}-${i}`} msg={msg} accent={C.error} />
      ))
    }

    // conflicts
    if (diff.conflicts.length === 0) return <EmptyState icon="verified-user" text="No conflicts — timestamps match exactly." />
    return diff.conflicts.map((conflict, i) => (
      <ConflictCard key={`c-${conflict.local.id}-${i}`} conflict={conflict} index={i} viewMode={viewMode} />
    ))
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <AppHeader onBack={() => router.back()} />
      <PasswordUnlockModal
        visible={unlockVisible}
        filename={filePath?.split('/').pop()}
        loading={unlocking}
        error={unlockError}
        onUnlock={handleUnlock}
        onChange={() => setUnlockError(null)}
        onCancel={() => { setUnlockVisible(false); router.back() }}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Title */}
        <View>
          <Text style={styles.pageTitle}>Diff Viewer</Text>
          <Text style={styles.pageSub}>Compare backup against current device messages.</Text>
        </View>

        {/* Stat bento */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statCard} onPress={() => setActiveTab('added')} activeOpacity={0.8}>
            {loading
              ? <ActivityIndicator color={C.primary} size="small" style={{ marginBottom: 6 }} />
              : <MaterialIcons name="add-circle" size={22} color={C.primary} style={{ marginBottom: 6 }} />
            }
            <Text style={[styles.statNum, { color: C.primary }]}>{loading ? '—' : `+${addedCount}`}</Text>
            <Text style={styles.statSub}>Added</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.statCard} onPress={() => setActiveTab('removed')} activeOpacity={0.8}>
            {loading
              ? <ActivityIndicator color={C.error} size="small" style={{ marginBottom: 6 }} />
              : <MaterialIcons name="remove-circle" size={22} color={C.error} style={{ marginBottom: 6 }} />
            }
            <Text style={[styles.statNum, { color: C.error }]}>{loading ? '—' : `-${removedCount}`}</Text>
            <Text style={styles.statSub}>Removed</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.statCard} onPress={() => setActiveTab('conflicts')} activeOpacity={0.8}>
            {loading
              ? <ActivityIndicator color={C.tertiary} size="small" style={{ marginBottom: 6 }} />
              : <MaterialIcons name="warning" size={22} color={C.tertiary} style={{ marginBottom: 6 }} />
            }
            <Text style={[styles.statNum, { color: C.tertiary }]}>{loading ? '—' : conflictCount}</Text>
            <Text style={styles.statSub}>Conflicts</Text>
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <TabBar
          active={activeTab}
          counts={{ added: addedCount, removed: removedCount, conflicts: conflictCount }}
          onSelect={setActiveTab}
        />

        {/* View mode toggle — only for conflicts */}
        {activeTab === 'conflicts' && !loading && conflictCount > 0 && (
          <View style={styles.viewToggleRow}>
            <Text style={styles.viewToggleLabel}>View mode</Text>
            <View style={styles.viewToggleBtns}>
              <TouchableOpacity
                style={[styles.viewToggleBtn, viewMode === 'stack' && styles.viewToggleBtnActive]}
                onPress={() => setViewMode('stack')}
              >
                <MaterialIcons name="view-agenda" size={14} color={viewMode === 'stack' ? C.primary : C.textFaint} />
                <Text style={[styles.viewToggleTxt, viewMode === 'stack' && { color: C.primary }]}>Stacked</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewToggleBtn, viewMode === 'side' && styles.viewToggleBtnActive]}
                onPress={() => setViewMode('side')}
              >
                <MaterialIcons name="view-column" size={14} color={viewMode === 'side' ? C.primary : C.textFaint} />
                <Text style={[styles.viewToggleTxt, viewMode === 'side' && { color: C.primary }]}>Side by Side</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Content */}
        <View style={{ gap: S.md }}>
          {renderContent()}
        </View>

        <View style={{ height: 160 }} />
      </ScrollView>

      {/* Sticky footer */}
      <View style={styles.footer}>
        <View style={styles.footerIntegrity}>
          <MaterialIcons
            name={isDefault ? 'verified-user' : 'security'}
            size={18}
            color={isDefault ? C.primary : C.textMuted}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.footerIntegrityTitle}>
              Default SMS:{' '}
              <Text style={{ color: isDefault ? C.primary : C.error }}>
                {isDefault === null ? 'Checking…' : isDefault ? 'This app ✓' : 'Not set'}
              </Text>
            </Text>
            <Text style={styles.footerIntegritySub}>
              {loadedBackup
                ? `${loadedBackup.metadata.messageCount?.toLocaleString() ?? '?'} messages · ${loadedBackup.metadata.device}`
                : encrypted === '1' ? 'AES-256 Encrypted Vault' : 'Local backup'}
            </Text>
          </View>
        </View>
        <View style={styles.footerBtns}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} activeOpacity={0.85}>
            <Text style={styles.cancelBtnTxt}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, (loading || restoring) && { opacity: 0.55 }]}
            onPress={handleConfirmRestore}
            disabled={loading || restoring}
            activeOpacity={0.85}
          >
            {restoring
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

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.emptyState}>
      <MaterialIcons name={icon as any} size={36} color={C.textFaint} />
      <Text style={styles.emptyStateTxt}>{text}</Text>
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
    borderRadius: R.xl, padding: S.md, alignItems: 'flex-start',
  },
  statNum: { fontSize: 22, fontWeight: '800' },
  statSub: { fontSize: 10, color: C.textMuted, marginTop: 2 },

  viewToggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  viewToggleLabel: { fontSize: 11, fontWeight: '700', color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1 },
  viewToggleBtns: { flexDirection: 'row', gap: 4 },
  viewToggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: R.lg,
    backgroundColor: C.surfaceContainerHigh,
  },
  viewToggleBtnActive: {
    backgroundColor: 'rgba(93,218,195,0.12)',
    borderWidth: 1, borderColor: 'rgba(93,218,195,0.25)',
  },
  viewToggleTxt: { fontSize: 11, fontWeight: '700', color: C.textFaint },

  loadingCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surfaceContainerLow, borderRadius: R.xl, padding: S.lg,
  },

  emptyState: {
    alignItems: 'center', paddingVertical: 40, gap: 12,
    backgroundColor: C.surfaceContainerLow, borderRadius: R.xl,
  },
  emptyStateTxt: {
    fontSize: 13, color: C.textMuted, textAlign: 'center',
    paddingHorizontal: S.lg, lineHeight: 20,
  },

  footer: {
    backgroundColor: 'rgba(18,20,22,0.97)',
    paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.sm,
    borderTopWidth: 1, borderTopColor: 'rgba(62,73,70,0.1)',
    gap: S.sm,
  },
  footerIntegrity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
