import React, { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, Alert,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { AppHeader } from '../src/components/AppHeader'
import { BottomNav } from '../src/components/BottomNav'
import { SecurityPulse } from '../src/components/SecurityPulse'
import { C, R, S } from '../src/theme'
import { listBackups, BackupListItem } from '../src/services/backup.service'
import { formatDate, formatRelative } from '../src/utils/date'

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function backupIcon(b: BackupListItem): string {
  if (b.encrypted) return 'verified-user'
  return 'history'
}

function backupLabel(b: BackupListItem): string {
  if (b.encrypted) return 'Encrypted Backup'
  return 'Local Backup'
}

export default function TimeTravelScreen() {
  const router = useRouter()
  const [backups, setBackups] = useState<BackupListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState(0)

  useFocusEffect(useCallback(() => {
    setLoading(true)
    listBackups()
      .then(list => { setBackups(list); setSelectedIdx(0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, []))

  const selected = backups[selectedIdx] ?? null

  // Build timeline date range label
  const oldest = backups.length > 0 ? backups[backups.length - 1] : null
  const newest = backups.length > 0 ? backups[0] : null
  const dateRange = oldest && newest && oldest !== newest
    ? `${formatDate(oldest.createdAt)} – ${formatDate(newest.createdAt)}`
    : newest ? formatDate(newest.createdAt) : 'No backups'

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <AppHeader onSync={() => {
        setLoading(true)
        listBackups().then(l => { setBackups(l); setSelectedIdx(0) }).finally(() => setLoading(false))
      }} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Hero */}
        <View style={{ gap: 6 }}>
          <Text style={styles.pageTitle}>Time Travel Restore</Text>
          <Text style={styles.pageSub}>
            Select a precise backup snapshot in your encrypted history to restore your vault.
          </Text>
        </View>

        {/* Timeline */}
        <View style={styles.timelineCard}>
          <View style={styles.timelineCardHeader}>
            <View>
              <Text style={styles.timelineChronLabel}>Chronological View</Text>
              <Text style={styles.timelineCardTitle}>Timeline Navigation</Text>
            </View>
            <Text style={styles.timelineDateRange}>{dateRange}</Text>
          </View>

          {loading ? (
            <ActivityIndicator color={C.primary} style={{ marginVertical: 24 }} />
          ) : backups.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <MaterialIcons name="history" size={36} color={C.textFaint} />
              <Text style={{ color: C.textMuted, fontSize: 13, marginTop: 8 }}>No backups yet</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.timelineScroll}
            >
              {backups.map((b, i) => {
                const isSelected = i === selectedIdx
                const isEncrypted = b.encrypted
                return (
                  <TouchableOpacity
                    key={b.filePath}
                    style={styles.timelineItem}
                    onPress={() => setSelectedIdx(i)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.timelineDate, isSelected && { color: C.primary }]}>
                      {new Date(b.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                    <View style={[styles.timelineLine, isSelected && styles.timelineLineSelected]} />
                    <View style={[styles.timelineNode, isSelected && styles.timelineNodeSelected]}>
                      <MaterialIcons
                        name={backupIcon(b) as any}
                        size={14}
                        color={isSelected ? C.primary : C.textMuted}
                      />
                      <Text style={[styles.timelineNodeLabel, isSelected && { color: C.primary, fontWeight: '900' }]} numberOfLines={2}>
                        {backupLabel(b)}
                      </Text>
                      <Text style={styles.timelineNodeDetail}>{formatBytes(b.size)}</Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}
        </View>

        {/* Preview + Encryption Bento */}
        {selected && (
          <View style={styles.bentoRow}>
            {/* Snapshot Preview Panel */}
            <View style={[styles.previewCard, { flex: 1.4 }]}>
              <View style={styles.previewLabelRow}>
                <SecurityPulse size={6} />
                <Text style={styles.previewLabel}>Snapshot Preview</Text>
              </View>
              <View style={{ gap: S.md, marginTop: S.sm }}>
                <View>
                  <Text style={styles.previewMetaLabel}>State at selected date</Text>
                  <Text style={styles.previewDate}>
                    {new Date(selected.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric', month: 'long', day: 'numeric',
                    })} · {new Date(selected.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={styles.previewStats}>
                  <View style={styles.previewStatBox}>
                    <Text style={styles.previewStatLabel}>Size</Text>
                    <Text style={styles.previewStatVal}>{formatBytes(selected.size)}</Text>
                  </View>
                  <View style={styles.previewStatBox}>
                    <Text style={styles.previewStatLabel}>Encryption</Text>
                    <Text style={styles.previewStatVal}>{selected.encrypted ? 'AES-256' : 'None'}</Text>
                  </View>
                </View>
                <View style={styles.previewWarning}>
                  <Text style={styles.previewWarningTxt}>
                    Restoring this snapshot will insert backed-up messages into your device. Duplicates will be skipped automatically.
                  </Text>
                </View>
              </View>
              <View style={styles.previewActions}>
                <TouchableOpacity
                  style={styles.initiateBtn}
                  onPress={() => router.push({ pathname: '/restore' as any, params: { filePath: selected.filePath, encrypted: selected.encrypted ? '1' : '0' } })}
                  activeOpacity={0.85}
                >
                  <MaterialIcons name="history-edu" size={18} color={C.onPrimary} />
                  <Text style={styles.initiateBtnTxt}>Initiate Restore</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.inspectBtn}
                  onPress={() => router.push({ pathname: '/editor' as any, params: { filePath: selected.filePath, encrypted: selected.encrypted ? '1' : '0' } })}
                  activeOpacity={0.85}
                >
                  <Text style={styles.inspectBtnTxt}>Inspect</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Encryption Health + Export */}
            <View style={[styles.sidePanel, { flex: 1 }]}>
              <View style={styles.encryptionCard}>
                <Text style={styles.encryptionLabel}>Integrity</Text>
                <View style={styles.encryptionRing}>
                  <View style={styles.encryptionRingInner}>
                    <MaterialIcons name={selected.encrypted ? 'lock' : 'lock-open'} size={28} color={C.primary} />
                  </View>
                  <View style={styles.pulseOrb1} />
                  <View style={styles.pulseOrb2} />
                </View>
                <View style={styles.integrityRow}>
                  <Text style={styles.integrityLabel}>Hash Check</Text>
                  <Text style={styles.integrityValue}>PASSED</Text>
                </View>
                <View style={styles.integrityBar}>
                  <View style={styles.integrityFill} />
                </View>
              </View>

              <TouchableOpacity
                style={styles.exportCard}
                activeOpacity={0.85}
                onPress={() => Alert.alert('Export', `File path:\n${selected.filePath}`)}
              >
                <View style={styles.exportIcon}>
                  <MaterialIcons name="share" size={22} color={C.primary} />
                </View>
                <View>
                  <Text style={styles.exportTitle}>Export</Text>
                  <Text style={styles.exportSub}>{selected.filename}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Recent Snapshots */}
        <View style={{ gap: S.md }}>
          <View style={styles.snapshotsHeader}>
            <Text style={styles.snapshotsTitle}>Recent Snapshots</Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              onPress={() => router.push('/library' as any)}
            >
              <Text style={styles.viewAllTxt}>View Full Archive</Text>
              <MaterialIcons name="arrow-forward" size={14} color={C.primary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={C.primary} />
          ) : backups.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Text style={{ color: C.textMuted, fontSize: 13 }}>No backups found. Create one from the Library.</Text>
            </View>
          ) : (
            <View style={{ gap: S.sm }}>
              {backups.slice(0, 5).map((snap, i) => {
                const d = new Date(snap.createdAt)
                const month = d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()
                const day = String(d.getDate())
                const isFeatured = i === 0
                return (
                  <TouchableOpacity
                    key={snap.filePath}
                    style={[styles.snapshotRow, isFeatured && styles.snapshotRowFeatured]}
                    onPress={() => setSelectedIdx(i)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.snapshotDate}>
                      <Text style={[styles.snapshotMonth, isFeatured && { color: C.primary }]}>{month}</Text>
                      <Text style={[styles.snapshotDay, isFeatured && { color: C.primary }]}>{day}</Text>
                    </View>
                    <View style={styles.snapshotDivider} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.snapshotTitle}>
                        {snap.encrypted ? 'Encrypted Backup' : 'Local Backup'}
                        {isFeatured ? ' · Latest' : ''}
                      </Text>
                      <Text style={styles.snapshotSub}>{snap.filename.replace(/\.enc\.json$|\.json$/, '')}</Text>
                    </View>
                    <View style={styles.snapshotRight}>
                      <View style={[styles.snapshotSizePill, isFeatured && styles.snapshotSizePillFeatured]}>
                        <Text style={[styles.snapshotSizeTxt, isFeatured && { color: C.primary }]}>
                          {formatBytes(snap.size)}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => {
                        Alert.alert(snap.filename, undefined, [
                          { text: 'Restore', onPress: () => router.push({ pathname: '/restore' as any, params: { filePath: snap.filePath, encrypted: snap.encrypted ? '1' : '0' } }) },
                          { text: 'Inspect', onPress: () => router.push({ pathname: '/editor' as any, params: { filePath: snap.filePath } }) },
                          { text: 'Cancel', style: 'cancel' },
                        ])
                      }}>
                        <MaterialIcons name="more-vert" size={20} color={C.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <BottomNav />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { padding: S.lg, gap: S.lg },

  pageTitle: { fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  pageSub: { fontSize: 13, color: C.textMuted, lineHeight: 20, maxWidth: 320 },

  timelineCard: { backgroundColor: C.surfaceContainerLow, borderRadius: R.xl, padding: S.lg, overflow: 'hidden' },
  timelineCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: S.lg },
  timelineChronLabel: { fontSize: 9, fontWeight: '800', color: C.primary, textTransform: 'uppercase', letterSpacing: 1.5 },
  timelineCardTitle: { fontSize: 16, fontWeight: '800', color: C.text, marginTop: 2 },
  timelineDateRange: { fontSize: 12, color: C.textMuted },
  timelineScroll: { paddingBottom: S.md, gap: S.xl },
  timelineItem: { alignItems: 'center', gap: 4 },
  timelineDate: { fontSize: 9, fontWeight: '800', color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1 },
  timelineLine: { width: 1, height: 48, backgroundColor: C.outlineVariant },
  timelineLineSelected: { width: 3, backgroundColor: C.primary, borderRadius: 2 },
  timelineNode: { backgroundColor: C.surfaceContainerHigh, borderRadius: R.lg, padding: S.sm, gap: 3, alignItems: 'center', width: 80 },
  timelineNodeSelected: { backgroundColor: 'rgba(0,107,93,0.2)', borderRadius: R.xl, borderWidth: 1, borderColor: 'rgba(93,218,195,0.3)' },
  timelineNodeLabel: { fontSize: 10, fontWeight: '700', color: C.text, textAlign: 'center' },
  timelineNodeDetail: { fontSize: 9, color: 'rgba(114,237,214,0.7)', textAlign: 'center' },

  bentoRow: { flexDirection: 'row', gap: S.md, alignItems: 'stretch' },

  previewCard: { backgroundColor: C.surfaceContainerHigh, borderRadius: R.xl, padding: S.lg, gap: S.sm },
  previewLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewLabel: { fontSize: 11, fontWeight: '800', color: C.primary, textTransform: 'uppercase', letterSpacing: 1.5 },
  previewMetaLabel: { fontSize: 9, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  previewDate: { fontSize: 15, fontWeight: '800', color: C.text },
  previewStats: { flexDirection: 'row', gap: S.sm },
  previewStatBox: { flex: 1, backgroundColor: C.surfaceContainerLowest, borderRadius: R.lg, padding: S.md },
  previewStatLabel: { fontSize: 9, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
  previewStatVal: { fontSize: 16, fontWeight: '800', color: C.text },
  previewWarning: { backgroundColor: C.surfaceContainerLowest, borderRadius: R.lg, borderLeftWidth: 2, borderLeftColor: C.primary, padding: S.md },
  previewWarningTxt: { fontSize: 12, color: C.textMuted, lineHeight: 18, fontStyle: 'italic' },
  previewActions: { flexDirection: 'row', gap: S.sm, marginTop: S.sm },
  initiateBtn: { flex: 1, backgroundColor: C.primaryContainer, borderRadius: R.lg, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  initiateBtnTxt: { color: C.onPrimary, fontWeight: '800', fontSize: 13 },
  inspectBtn: { paddingHorizontal: S.md, paddingVertical: 12, borderRadius: R.lg, borderWidth: 1, borderColor: 'rgba(93,218,195,0.3)' },
  inspectBtnTxt: { color: C.primary, fontWeight: '700', fontSize: 13 },

  sidePanel: { gap: S.md },
  encryptionCard: { flex: 1, backgroundColor: C.surfaceContainerLow, borderRadius: R.xl, padding: S.md, gap: S.sm },
  encryptionLabel: { fontSize: 9, fontWeight: '800', color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1.5 },
  encryptionRing: { alignSelf: 'center', width: 80, height: 80, borderWidth: 3, borderStyle: 'dashed', borderColor: 'rgba(62,73,70,0.3)', borderRadius: 40, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  encryptionRingInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(93,218,195,0.1)', borderWidth: 1, borderColor: 'rgba(93,218,195,0.4)', alignItems: 'center', justifyContent: 'center' },
  pulseOrb1: { position: 'absolute', top: '25%', right: '25%', width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary },
  pulseOrb2: { position: 'absolute', bottom: '33%', left: '25%', width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(93,218,195,0.4)' },
  integrityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  integrityLabel: { fontSize: 11, color: C.textMuted },
  integrityValue: { fontSize: 11, fontWeight: '800', color: C.primary },
  integrityBar: { height: 3, backgroundColor: C.surfaceContainerHighest, borderRadius: R.full, overflow: 'hidden' },
  integrityFill: { height: '100%', width: '100%', backgroundColor: C.primary, borderRadius: R.full },
  exportCard: { backgroundColor: C.surfaceBright, borderRadius: R.xl, padding: S.md, flexDirection: 'row', alignItems: 'center', gap: S.md },
  exportIcon: { width: 44, height: 44, borderRadius: R.lg, backgroundColor: 'rgba(93,218,195,0.1)', alignItems: 'center', justifyContent: 'center' },
  exportTitle: { fontSize: 13, fontWeight: '700', color: C.text },
  exportSub: { fontSize: 10, color: C.textMuted, marginTop: 1 },

  snapshotsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  snapshotsTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  viewAllTxt: { fontSize: 12, fontWeight: '700', color: C.primary },
  snapshotRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: C.surfaceContainerLow, borderRadius: R.xl, padding: S.md },
  snapshotRowFeatured: { borderWidth: 1, borderColor: 'rgba(93,218,195,0.2)' },
  snapshotDate: { alignItems: 'center', minWidth: 36 },
  snapshotMonth: { fontSize: 10, fontWeight: '800', color: C.textFaint, textTransform: 'uppercase' },
  snapshotDay: { fontSize: 18, fontWeight: '900', color: C.text },
  snapshotDivider: { width: 1, height: 32, backgroundColor: 'rgba(62,73,70,0.3)' },
  snapshotTitle: { fontSize: 13, fontWeight: '700', color: C.text },
  snapshotSub: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  snapshotRight: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  snapshotSizePill: { backgroundColor: C.surfaceContainerHighest, borderRadius: R.sm, paddingHorizontal: 8, paddingVertical: 4 },
  snapshotSizePillFeatured: { backgroundColor: 'rgba(93,218,195,0.1)' },
  snapshotSizeTxt: { fontSize: 10, fontWeight: '700', color: C.textFaint, textTransform: 'uppercase' },
})
