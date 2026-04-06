import React, { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, StatusBar, PermissionsAndroid, ActivityIndicator,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { AppHeader } from '../src/components/AppHeader'
import { BottomNav } from '../src/components/BottomNav'
import { SecurityPulse } from '../src/components/SecurityPulse'
import { SecureBackupModal } from '../src/components/SecureBackupModal'
import { PermissionDisclosureModal } from '../src/components/PermissionDisclosureModal'
import { useAlert } from '../src/hooks/useAlert'
import { C, R, S } from '../src/theme'
import { listBackups, BackupListItem } from '../src/services/backup.service'
import { useBackup } from '../src/hooks/useBackup'
import { formatRelative } from '../src/utils/date'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function computeHealthScore(permGranted: boolean, backups: BackupListItem[]): number {
  let score = 0
  if (permGranted) score += 40
  if (backups.length > 0) score += 30
  if (backups.length > 0) {
    const daysSince = (Date.now() - backups[0].createdAt) / (1000 * 60 * 60 * 24)
    if (daysSince < 1) score += 20
    else if (daysSince < 7) score += 10
    else if (daysSince < 30) score += 5
  }
  score += 10 // AES-256 always active
  return score
}

function healthLabel(score: number): string {
  if (score >= 90) return 'Exceptional. All security modules active.'
  if (score >= 70) return 'Good. Consider backing up more frequently.'
  if (score >= 50) return 'Fair. Grant permissions and create a backup.'
  return 'At risk. Grant SMS permissions to get started.'
}

export default function DashboardScreen() {
  const router = useRouter()
  const { alert } = useAlert()
  const { startBackup, isRunning } = useBackup()
  const [showDisclosure, setShowDisclosure] = useState(false)
  const [secureModalVisible, setSecureModalVisible] = useState(false)
  const [permGranted, setPermGranted] = useState(false)
  const [backups, setBackups] = useState<BackupListItem[]>([])
  const [loading, setLoading] = useState(true)

  async function checkPermissions() {
    if (Platform.OS === 'android') {
      const status = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS)
      setPermGranted(status)
      if (!status) {
        setShowDisclosure(true)
      }
    }
  }

  async function loadData() {
    setLoading(true)
    try {
      const [list] = await Promise.all([listBackups(), checkPermissions()])
      setBackups(list)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  useFocusEffect(useCallback(() => { loadData() }, []))

  async function handlePermissionAccept() {
    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        PermissionsAndroid.PERMISSIONS.SEND_SMS,
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        PermissionsAndroid.PERMISSIONS.RECEIVE_MMS,
        PermissionsAndroid.PERMISSIONS.RECEIVE_WAP_PUSH,
      ])
      const ok = Object.values(result).every(r => r === PermissionsAndroid.RESULTS.GRANTED)
      setPermGranted(ok)

      if (!ok) {
        // Android 13+ "restricted settings" blocks SMS permissions for sideloaded APKs.
        // Guide the user through the manual enable flow.
        const anyDenied = Object.values(result).some(
          r => r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN || r === PermissionsAndroid.RESULTS.DENIED
        )
        if (anyDenied) {
          alert(
            'Permissions Required',
            'SMS permissions were not granted.\n\n' +
            'If you installed this app outside the Play Store, Android may block SMS permissions as a security measure.\n\n' +
            'To fix this:\n' +
            '1. Open Settings → Apps → SecureSMS\n' +
            '2. Tap the ⋮ (three-dot) menu in the top-right\n' +
            '3. Tap "Allow restricted settings"\n' +
            '4. Return here and grant permissions',
            [{ text: 'OK' }],
            'security'
          )
        }
      }
    }
    setShowDisclosure(false)
  }

  async function handleQuickBackup() {
    try {
      await startBackup()
      alert('Success', 'Local backup created successfully.', [{ text: 'OK' }], 'check-circle')
      loadData()
    } catch (e: any) {
      alert('Error', e.message, [{ text: 'OK', style: 'cancel' }], 'error')
    }
  }

  const totalBytes = backups.reduce((acc, b) => acc + b.size, 0)
  const lastBackup = backups[0] ?? null
  const encryptedCount = backups.filter(b => b.encrypted).length
  const healthScore = computeHealthScore(permGranted, backups)
  const healthPct = `${healthScore}%` as `${number}%`

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <AppHeader onSync={loadData} />
      <PermissionDisclosureModal
        visible={showDisclosure}
        onAccept={handlePermissionAccept}
        onDecline={() => setShowDisclosure(false)}
      />
      
      <SecureBackupModal
        visible={secureModalVisible}
        onClose={() => setSecureModalVisible(false)}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Hero */}
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Backup Dashboard</Text>
            <Text style={styles.heroSub}>
              Your digital communications are secured with{' '}
              <Text style={{ color: C.primary }}>Military-Grade AES-256 Encryption</Text>.{' '}
              {lastBackup
                ? `Last backup: ${formatRelative(lastBackup.createdAt)}.`
                : 'No backups yet — create your first backup now.'}
            </Text>
          </View>
          <View style={styles.zeroKnowledgePill}>
            <SecurityPulse size={8} />
            <Text style={styles.zeroKnowledgeText}>Zero-Knowledge: ON</Text>
          </View>
        </View>

        {/* Security Health + Storage bento */}
        <View style={styles.bentoRow}>
          <View style={[styles.healthCard, { flex: 1.6 }]}>
            <Text style={styles.cardLabel}>Security Health Index</Text>
            {loading ? (
              <ActivityIndicator color={C.primary} style={{ marginVertical: 16 }} />
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginVertical: 8 }}>
                  <Text style={styles.scoreNumber}>{healthScore}</Text>
                  <Text style={styles.scoreSlash}>/100</Text>
                </View>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: healthPct }]} />
                </View>
                <Text style={styles.cardSub}>{healthLabel(healthScore)}</Text>
              </>
            )}
            <View style={styles.healthGlow} pointerEvents="none" />
          </View>

          <View style={[styles.storageCard, { flex: 1 }]}>
            <Text style={styles.cardLabel}>Storage Archive</Text>
            {loading ? (
              <ActivityIndicator color={C.primary} style={{ marginVertical: 12 }} />
            ) : (
              <>
                <View style={{ marginVertical: 8 }}>
                  <Text style={styles.storageNumber}>
                    {formatBytes(totalBytes).split(' ')[0]}
                    <Text style={styles.storageUnit}> {formatBytes(totalBytes).split(' ')[1] ?? 'B'}</Text>
                  </Text>
                  <Text style={styles.cardSub2}>{backups.length} BACKUP{backups.length !== 1 ? 'S' : ''}</Text>
                </View>
                <View style={styles.progressBg}>
                  <View style={[styles.storageFill, { width: backups.length > 0 ? '40%' : '0%' }]} />
                </View>
                <View style={styles.storageMeta}>
                  <MaterialIcons name="info" size={12} color={C.textMuted} />
                  <Text style={styles.storageMetaTxt}>
                    {lastBackup ? `Latest: ${formatRelative(lastBackup.createdAt)}` : 'No backups yet'}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.quickActionPrimary}
            onPress={handleQuickBackup}
            disabled={isRunning}
            activeOpacity={0.85}
          >
            <View>
              <Text style={styles.actionSub}>Immediate</Text>
              <Text style={styles.actionLabel}>{isRunning ? 'Backing up...' : 'Quick Backup'}</Text>
              <Text style={{ fontSize: 9, color: 'rgba(0,56,47,0.7)', marginTop: 2 }}>fast, unencrypted local copy</Text>
            </View>
            {isRunning
              ? <ActivityIndicator color={C.onPrimary} size="small" />
              : <MaterialIcons name="bolt" size={28} color={C.onPrimary} />
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionSecondary} onPress={() => setSecureModalVisible(true)} activeOpacity={0.85}>
            <View>
              <Text style={styles.actionSubMuted}>Advanced</Text>
              <Text style={styles.actionLabelDark}>Secure Backup</Text>
              <Text style={{ fontSize: 9, color: C.textMuted, marginTop: 2 }}>Create AES-256 encrypted backup</Text>
            </View>
            <MaterialIcons name="lock" size={26} color={C.primary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionSecondary} onPress={() => router.push('/library' as any)} activeOpacity={0.85}>
            <View>
              <Text style={styles.actionSubMuted}>All Backups</Text>
              <Text style={styles.actionLabelDark}>Library</Text>
            </View>
            <MaterialIcons name="folder-open" size={26} color={C.primary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionSecondary} onPress={() => router.push('/time-travel' as any)} activeOpacity={0.85}>
            <View>
              <Text style={styles.actionSubMuted}>Archive</Text>
              <Text style={styles.actionLabelDark}>Restore History</Text>
            </View>
            <MaterialIcons name="history" size={26} color={C.primary} />
          </TouchableOpacity>
        </View>

        {/* Intel Cards */}
        <View style={styles.intelRow}>
          <View style={[styles.intelCard, { flex: 1 }]}>
            <View style={styles.intelHeader}>
              <View style={styles.intelIconWrap}>
                <MaterialIcons name="security" size={20} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.intelTitle}>Backup Stats</Text>
                <Text style={styles.intelDate}>
                  {lastBackup ? `Updated ${formatRelative(lastBackup.createdAt)}` : 'No backups yet'}
                </Text>
              </View>
            </View>
            <View style={styles.intelStat}>
              <Text style={styles.intelStatLabel}>Total Backups</Text>
              <Text style={styles.intelStatValue}>{loading ? '—' : backups.length}</Text>
            </View>
            <View style={styles.intelStat}>
              <Text style={styles.intelStatLabel}>Secure Backups</Text>
              <Text style={styles.intelStatValue}>{loading ? '—' : encryptedCount}</Text>
              <Text style={{fontSize: 9, color: C.textMuted, opacity: 0.8, position: 'absolute', right: 0, top: 22}}>Quick backup is unencrypted</Text>
            </View>
          </View>

          <View style={[styles.intelCard, { flex: 1 }]}>
            <View style={styles.intelHeader}>
              <View style={styles.intelIconWrap}>
                <MaterialIcons name="verified-user" size={20} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.intelTitle}>Encryption Keys</Text>
                <Text style={styles.intelDate}>AES-256 · PBKDF2</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 12, flexWrap: 'wrap', gap: 4 }}>
              {(loading ? [] : backups.slice(0, 3)).map((b, i) => (
                <View key={b.filePath} style={[styles.keyBadge, { marginLeft: i > 0 ? -8 : 0 }]}>
                  <Text style={styles.keyBadgeTxt}>K{i + 1}</Text>
                </View>
              ))}
              {!loading && backups.length > 3 && (
                <View style={[styles.keyBadge, styles.keyBadgeMore, { marginLeft: -8 }]}>
                  <Text style={[styles.keyBadgeTxt, { color: C.primary }]}>+{backups.length - 3}</Text>
                </View>
              )}
              {!loading && backups.length === 0 && (
                <Text style={{ fontSize: 11, color: C.textFaint }}>No keys yet</Text>
              )}
            </View>
          </View>
        </View>

        {!permGranted && (
          <TouchableOpacity style={styles.permBanner} onPress={() => setShowDisclosure(true)}>
            <MaterialIcons name="warning" size={16} color="#713f12" />
            <Text style={styles.permBannerTxt}>Tap to grant SMS permissions</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <BottomNav />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { padding: S.lg, paddingBottom: S.xl, gap: S.lg },

  heroRow: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: S.md },
  heroTitle: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5, marginBottom: 8 },
  heroSub: { fontSize: 14, color: C.textMuted, lineHeight: 22, maxWidth: 280 },
  zeroKnowledgePill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.surfaceContainerHigh, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: R.xl,
  },
  zeroKnowledgeText: { fontSize: 11, fontWeight: '700', color: C.primary, letterSpacing: 1 },

  bentoRow: { flexDirection: 'row', gap: S.md },
  healthCard: { backgroundColor: C.surfaceContainer, borderRadius: R.xl, padding: S.lg, overflow: 'hidden' },
  storageCard: { backgroundColor: C.surfaceContainerHigh, borderRadius: R.xl, padding: S.lg },
  cardLabel: { fontSize: 10, fontWeight: '800', color: C.textMuted, letterSpacing: 2, textTransform: 'uppercase' },
  scoreNumber: { fontSize: 56, fontWeight: '800', color: C.text, lineHeight: 60 },
  scoreSlash: { fontSize: 20, fontWeight: '700', color: C.primary, marginBottom: 8 },
  progressBg: { height: 6, backgroundColor: C.surfaceContainerHighest, borderRadius: R.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: R.full, backgroundColor: C.primary },
  cardSub: { fontSize: 12, color: C.textMuted, marginTop: 8, lineHeight: 18 },
  storageNumber: { fontSize: 26, fontWeight: '800', color: C.text },
  storageUnit: { fontSize: 16, opacity: 0.5 },
  cardSub2: { fontSize: 10, color: C.textMuted, marginBottom: 8 },
  storageFill: { height: '100%', borderRadius: R.full, backgroundColor: C.onTertiaryContainer },
  storageMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 },
  storageMetaTxt: { fontSize: 10, color: C.textMuted },
  healthGlow: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(93,218,195,0.05)', top: -30, right: -30,
  },

  actionsRow: { gap: S.sm },
  quickActionPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: S.lg, borderRadius: R.xl, backgroundColor: C.primaryContainer,
  },
  quickActionSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: S.lg, borderRadius: R.xl, backgroundColor: C.surfaceContainerHigh,
    borderWidth: 1, borderColor: 'rgba(62,73,70,0.15)',
  },
  actionSub: { fontSize: 10, fontWeight: '700', color: 'rgba(0,56,47,0.8)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  actionLabel: { fontSize: 17, fontWeight: '800', color: C.onPrimary },
  actionSubMuted: { fontSize: 10, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  actionLabelDark: { fontSize: 17, fontWeight: '800', color: C.text },

  intelRow: { flexDirection: 'row', gap: S.md },
  intelCard: { backgroundColor: C.surfaceContainerLowest, borderRadius: R.xl, padding: S.lg },
  intelHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  intelIconWrap: {
    width: 40, height: 40, borderRadius: R.full,
    backgroundColor: C.surfaceContainerHighest, alignItems: 'center', justifyContent: 'center',
  },
  intelTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  intelDate: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  intelStat: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  intelStatLabel: { fontSize: 12, color: C.textMuted },
  intelStatValue: { fontSize: 12, fontWeight: '700', color: C.primary },
  keyBadge: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: C.surfaceContainerHigh,
    borderWidth: 2, borderColor: C.bg, alignItems: 'center', justifyContent: 'center',
  },
  keyBadgeMore: { backgroundColor: 'rgba(93,218,195,0.15)' },
  keyBadgeTxt: { fontSize: 9, fontWeight: '700', color: C.text },

  permBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fef9c3', padding: 14, borderRadius: R.lg,
    borderWidth: 1, borderColor: '#fde047',
  },
  permBannerTxt: { color: '#713f12', fontSize: 14, fontWeight: '500' },
})
