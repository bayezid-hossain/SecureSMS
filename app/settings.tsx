import { MaterialIcons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import { router } from 'expo-router'
import Constants from 'expo-constants'
import * as FileSystem from 'expo-file-system/legacy'
import * as LocalAuth from 'expo-local-authentication'
import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'
import { BIOMETRIC_KEY } from './_layout'
import { AppHeader } from '../src/components/AppHeader'
import { BottomNav } from '../src/components/BottomNav'
import { SecurityPulse } from '../src/components/SecurityPulse'
import { useAlert } from '../src/hooks/useAlert'
import { listBackups } from '../src/services/backup.service'
import {
  configureDriveSignIn, signIn, signOut, getAccessToken,
  getOrCreateFolder, uploadFile, listDriveBackups,
} from '../src/services/drive.service'
import { zipAndShareAll } from '../src/services/share.service'
import { useAppStore } from '../src/store/useAppStore'
import { useDriveStore } from '../src/store/drive.store'
import { C, R, S } from '../src/theme'

const WEB_CLIENT_ID = Constants.expoConfig?.extra?.webClientId ?? ''
const BACKUP_DIR = `${FileSystem.documentDirectory}backups/`
const KEYS = {
  autoBackup: 'pref_auto_backup',
  wifiOnly: 'pref_wifi_only',
  driveEnabled: 'pref_drive',
}

type SettingRowProps = {
  icon: string; iconColor?: string; label: string; sub?: string
  right?: React.ReactNode; onPress?: () => void; destructive?: boolean
}

function SettingRow({ icon, iconColor, label, sub, right, onPress, destructive }: SettingRowProps) {
  const content = (
    <View style={styles.row}>
      <View style={[styles.rowIconWrap, { backgroundColor: iconColor ? `${iconColor}20` : C.surfaceContainerHighest }]}>
        <MaterialIcons name={icon as any} size={18} color={iconColor ?? C.textMuted} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, destructive && { color: C.error }]}>{label}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      {right ?? <MaterialIcons name="chevron-right" size={18} color={C.textFaint} />}
    </View>
  )
  if (onPress) return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{content}</TouchableOpacity>
  return content
}

function BottomSheet({
  visible, onClose, children,
}: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.scrim} />
      </TouchableWithoutFeedback>
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <TouchableOpacity style={styles.sheetCloseBtn} onPress={onClose}>
          <MaterialIcons name="close" size={18} color={C.textMuted} />
        </TouchableOpacity>
        {children}
      </View>
    </Modal>
  )
}

export default function SettingsScreen() {
  const { alert } = useAlert()
  const reset = useAppStore(s => s.reset)
  const setBackupList = useAppStore(s => s.setBackupList)

  const { activeAccount, syncStatus, loadStore, setActiveAccount, setSyncStatus, setLastSyncAt } = useDriveStore()

  const [autoBackup, setAutoBackupState] = useState(false)
  const [wifiOnly, setWifiOnlyState] = useState(true)
  const [driveEnabled, setDriveEnabledState] = useState(false)
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [backupCount, setBackupCount] = useState<number | null>(null)
  const [backupSizeBytes, setBackupSizeBytes] = useState<number | null>(null)
  const [loadingPrefs, setLoadingPrefs] = useState(true)
  const [driveSheetVisible, setDriveSheetVisible] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    if (WEB_CLIENT_ID) configureDriveSignIn(WEB_CLIENT_ID)
    loadStore()
  }, [])

  useFocusEffect(useCallback(() => {
    ;(async () => {
      try {
        const [ab, wo, de, bio, list] = await Promise.all([
          AsyncStorage.getItem(KEYS.autoBackup),
          AsyncStorage.getItem(KEYS.wifiOnly),
          AsyncStorage.getItem(KEYS.driveEnabled),
          AsyncStorage.getItem(BIOMETRIC_KEY),
          listBackups(),
        ])
        if (ab !== null) setAutoBackupState(ab === '1')
        if (wo !== null) setWifiOnlyState(wo === '1')
        if (de !== null) setDriveEnabledState(de === '1')
        setBiometricEnabled(bio === '1')
        setBackupCount(list.length)
        setBackupSizeBytes(list.reduce((acc, b) => acc + b.size, 0))
      } catch { /* ignore */ } finally {
        setLoadingPrefs(false)
      }
    })()
  }, []))

  async function setPref(key: string, value: boolean) {
    await AsyncStorage.setItem(key, value ? '1' : '0')
  }

  function setAutoBackup(v: boolean) { setAutoBackupState(v); setPref(KEYS.autoBackup, v) }
  function setWifiOnly(v: boolean) { setWifiOnlyState(v); setPref(KEYS.wifiOnly, v) }

  function setDriveEnabled(v: boolean) {
    if (v) {
      setDriveSheetVisible(true)
    } else {
      setDriveEnabledState(false)
      setPref(KEYS.driveEnabled, false)
    }
  }

  async function toggleBiometric(value: boolean) {
    if (value) {
      const compatible = await LocalAuth.hasHardwareAsync()
      if (!compatible) {
        alert('Not Available', 'This device does not support biometric authentication.', [{ text: 'OK' }], 'warning')
        return
      }
      const enrolled = await LocalAuth.isEnrolledAsync()
      if (!enrolled) {
        alert('No Biometrics Enrolled', 'Please set up fingerprint or face unlock in your device settings first.', [{ text: 'OK' }], 'warning')
        return
      }
      // Verify before enabling
      const result = await LocalAuth.authenticateAsync({ promptMessage: 'Confirm to enable biometric lock' })
      if (!result.success) return
    }
    await AsyncStorage.setItem(BIOMETRIC_KEY, value ? '1' : '0')
    setBiometricEnabled(value)
  }

  async function handleGoogleSignIn() {
    setSigningIn(true)
    try {
      const response = await signIn()
      if (response.type === 'success' && response.data) {
        const { user } = response.data
        await setActiveAccount({
          email: user.email,
          displayName: user.name ?? undefined,
          photo: user.photo,
          connectedAt: Date.now(),
        })
        setDriveEnabledState(true)
        setPref(KEYS.driveEnabled, true)
        const token = await getAccessToken()
        const folderId = await getOrCreateFolder(token)
        const driveFiles = await listDriveBackups(folderId, token)
        if (driveFiles.length > 0) {
          alert('Existing Backups Found', `We found ${driveFiles.length} backup(s) in this Google Drive account. Would you like to view your library?`, [
            { text: 'Not Now', style: 'cancel' },
            { text: 'Go to Library', onPress: () => router.push('/library') },
          ], 'info')
        } else {
          alert('Connected', `Signed in as ${user.email}`, [{ text: 'OK' }], 'check-circle')
        }
      }
    } catch (e: any) {
      if (e?.code !== 'SIGN_IN_CANCELLED') {
        alert('Sign-In Failed', e?.message ?? 'Could not sign in with Google.', [{ text: 'OK' }], 'error')
      }
    } finally {
      setSigningIn(false)
    }
  }

  async function handleSwitchAccount() {
    alert('Switch Account', `Disconnect ${activeAccount?.email} and sign in with a different account?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Switch', style: 'destructive', onPress: async () => {
          await setActiveAccount(null)
          await signOut()
          setDriveEnabledState(false)
          setPref(KEYS.driveEnabled, false)
          handleGoogleSignIn()
        },
      },
    ], 'delete')
  }

  async function handleSyncToDrive() {
    if (!activeAccount) {
      alert('No Account', 'Connect a Google account first.', [{ text: 'OK' }], 'warning')
      return
    }
    setSyncStatus('syncing')
    try {
      const token = await getAccessToken()
      const folderId = await getOrCreateFolder(token)
      const localBackups = await listBackups()
      const driveFiles = await listDriveBackups(folderId, token)
      const driveFileNames = new Set(driveFiles.map(f => f.name))
      let uploaded = 0
      for (const backup of localBackups) {
        if (!driveFileNames.has(backup.filename)) {
          const content = await FileSystem.readAsStringAsync(backup.filePath, { encoding: FileSystem.EncodingType.UTF8 })
          await uploadFile(backup.filename, content, folderId, token)
          uploaded++
        }
      }
      const rulesState = useDriveStore.getState().customRules
      if (rulesState.length > 0) {
        await uploadFile('custom_rules.json', JSON.stringify(rulesState), folderId, token)
      }
      setLastSyncAt(Date.now())
      setSyncStatus('done')
      alert(
        'Sync Complete',
        uploaded > 0 ? `Uploaded ${uploaded} new backup${uploaded > 1 ? 's' : ''} to Google Drive.` : 'All backups are already synced.',
        [{ text: 'OK' }], 'check-circle'
      )
    } catch (e: any) {
      setSyncStatus('error', e?.message)
      alert('Sync Failed', e?.message ?? 'Could not sync to Google Drive.', [{ text: 'OK' }], 'error')
    }
  }

  async function handleShareAll() {
    setSharing(true)
    try {
      await zipAndShareAll()
    } catch (e: any) {
      alert('Share Failed', e?.message ?? 'Could not share backups.', [{ text: 'OK' }], 'error')
    } finally {
      setSharing(false)
    }
  }

  async function handleClearAll() {
    alert(
      'Clear All Backups',
      'This will permanently delete all local backup files. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All', style: 'destructive',
          onPress: async () => {
            try {
              await FileSystem.deleteAsync(BACKUP_DIR, { idempotent: true })
              await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true })
              setBackupList([])
              setBackupCount(0)
              setBackupSizeBytes(0)
              reset()
              alert('Done', 'All local backups deleted.', [{ text: 'OK' }], 'check-circle')
            } catch (e: any) {
              alert('Error', e.message, [{ text: 'OK' }], 'error')
            }
          },
        },
      ],
      'delete'
    )
  }

  const appVersion = Constants.expoConfig?.version ?? '1.0.0'

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <AppHeader onSync={() => { }} />

      {/* Google Drive Bottom Sheet */}
      <BottomSheet visible={driveSheetVisible} onClose={() => setDriveSheetVisible(false)}>
        <View style={styles.sheetIconWrap}>
          <MaterialIcons name="cloud-upload" size={28} color={C.tertiary} />
        </View>
        <Text style={styles.sheetTitle}>Google Drive Sync</Text>
        <Text style={styles.sheetSub}>
          Upload AES-256 encrypted backups to your Google Drive. Raw SMS data is never sent to any server.
        </Text>

        {activeAccount && (
          <View style={{ gap: 8, marginBottom: S.md }}>
            <Text style={[styles.sectionLabel, { paddingHorizontal: 0 }]}>Connected Account</Text>
            <View style={styles.accountRow}>
              {activeAccount.photo ? (
                <Image source={{ uri: activeAccount.photo }} style={styles.accountAvatar} />
              ) : (
                <View style={[styles.accountAvatar, { backgroundColor: C.surfaceContainerHighest, alignItems: 'center', justifyContent: 'center' }]}>
                  <MaterialIcons name="person" size={18} color={C.primary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>{activeAccount.displayName ?? activeAccount.email}</Text>
                <Text style={{ fontSize: 11, color: C.textMuted }}>{activeAccount.email}</Text>
              </View>
              <TouchableOpacity onPress={handleSwitchAccount} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="logout" size={16} color={C.error} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!activeAccount && (
          <TouchableOpacity style={styles.sheetPrimaryBtn} onPress={handleGoogleSignIn} disabled={signingIn}>
            {signingIn ? (
              <ActivityIndicator color={C.bg} size="small" />
            ) : (
              <>
                <MaterialIcons name="add" size={18} color={C.bg} />
                <Text style={styles.sheetPrimaryBtnTxt}>Sign In with Google</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {activeAccount && (
          <>
            <TouchableOpacity
              style={[styles.sheetPrimaryBtn, { backgroundColor: C.tertiary, marginTop: 0 }]}
              onPress={() => { setDriveSheetVisible(false); handleSyncToDrive() }}
            >
              <MaterialIcons name="sync" size={18} color={C.bg} />
              <Text style={styles.sheetPrimaryBtnTxt}>Sync Now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sheetSecondaryBtn, { marginTop: 8 }]} onPress={handleSwitchAccount}>
              <Text style={styles.sheetSecondaryBtnTxt}>Switch Account</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.sheetSecondaryBtn} onPress={() => setDriveSheetVisible(false)}>
          <Text style={styles.sheetSecondaryBtnTxt}>Close</Text>
        </TouchableOpacity>
      </BottomSheet>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={{ gap: 4 }}>
          <Text style={styles.pageTitle}>Settings</Text>
          <Text style={styles.pageSub}>Configure your vault preferences and security rules.</Text>
        </View>

        {/* Security Status */}
        <View style={styles.securityCard}>
          <View style={styles.securityLeft}>
            <SecurityPulse size={8} />
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.securityTitle}>Zero-Knowledge Mode</Text>
              <Text style={styles.securitySub}>Your password is never stored or transmitted</Text>
            </View>
          </View>
          <View style={styles.securityBadge}>
            <Text style={styles.securityBadgeTxt}>Active</Text>
          </View>
        </View>

        {/* Storage Summary */}
        {backupCount !== null && (
          <View style={styles.storageRow}>
            <View style={styles.storageChip}>
              <MaterialIcons name="folder" size={14} color={C.primary} />
              <Text style={styles.storageChipTxt}>
                {backupCount} backup{backupCount !== 1 ? 's' : ''}
              </Text>
            </View>
            {backupSizeBytes !== null && backupSizeBytes > 0 && (
              <View style={styles.storageChip}>
                <MaterialIcons name="sd-storage" size={14} color={C.secondary} />
                <Text style={styles.storageChipTxt}>
                  {(backupSizeBytes / (1024 * 1024)).toFixed(1)} MB used
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Backup & Sync */}
        <View style={{ gap: S.sm }}>
          <Text style={styles.sectionLabel}>Backup & Sync</Text>
          <View style={styles.card}>
            <SettingRow
              icon="backup" iconColor={C.primary}
              label="Auto Backup"
              sub={autoBackup ? 'Will back up when conditions are met' : 'Manual backup only'}
              right={
                <Switch value={autoBackup} onValueChange={setAutoBackup}
                  trackColor={{ false: C.surfaceContainerHighest, true: C.primaryContainer }}
                  thumbColor={autoBackup ? C.primary : '#666'} />
              }
            />
            <View style={styles.rowDivider} />
            <SettingRow
              icon="wifi" iconColor={C.secondary}
              label="WiFi & Charging Only"
              sub={wifiOnly ? 'Auto-backup only on WiFi while charging' : 'Runs on any connection'}
              right={
                <Switch value={wifiOnly} onValueChange={setWifiOnly}
                  trackColor={{ false: C.surfaceContainerHighest, true: C.primaryContainer }}
                  thumbColor={wifiOnly ? C.primary : '#666'} />
              }
            />
            <View style={styles.rowDivider} />
            <SettingRow
              icon="cloud-upload" iconColor={C.tertiary}
              label="Google Drive Sync"
              sub={driveEnabled ? 'Uploading AES-256 encrypted backups' : 'Disabled — local storage only'}
              right={
                <Switch value={driveEnabled} onValueChange={setDriveEnabled}
                  trackColor={{ false: C.surfaceContainerHighest, true: C.primaryContainer }}
                  thumbColor={driveEnabled ? C.primary : '#666'} />
              }
            />
          </View>
        </View>

        {/* Privacy & Encryption */}
        <View style={{ gap: S.sm }}>
          <Text style={styles.sectionLabel}>Privacy & Encryption</Text>
          <View style={styles.card}>
            <SettingRow
              icon="lock" iconColor={C.primary}
              label="Encryption Standard"
              sub="AES-256-CBC with PBKDF2 key derivation"
              right={<Text style={styles.valueChip}>AES-256</Text>}
            />
            <View style={styles.rowDivider} />
            <SettingRow
              icon="security" iconColor={C.secondary}
              label="Data Residency"
              sub="SMS data is never sent to external servers"
              right={<Text style={styles.valueChip}>{driveEnabled ? 'Drive + Local' : 'Local'}</Text>}
            />
            <View style={styles.rowDivider} />
            <SettingRow
              icon="fingerprint" iconColor={C.tertiary}
              label="Biometric Lock"
              sub={biometricEnabled ? 'App locked with biometric on open' : 'Disabled — open without authentication'}
              right={
                <Switch value={biometricEnabled} onValueChange={toggleBiometric}
                  trackColor={{ false: C.surfaceContainerHighest, true: C.primaryContainer }}
                  thumbColor={biometricEnabled ? C.tertiary : '#666'} />
              }
            />
          </View>
        </View>

        {/* Sharing */}
        <View style={{ gap: S.sm }}>
          <Text style={styles.sectionLabel}>Sharing</Text>
          <View style={styles.card}>
            <SettingRow
              icon="share" iconColor={C.secondary}
              label="Share All Backups"
              sub={sharing ? 'Creating ZIP…' : 'ZIP and share all local backups'}
              onPress={handleShareAll}
              right={
                sharing
                  ? <ActivityIndicator color={C.secondary} size="small" />
                  : <MaterialIcons name="chevron-right" size={18} color={C.textFaint} />
              }
            />
            <View style={styles.rowDivider} />
            <SettingRow
              icon="cloud-upload" iconColor={C.tertiary}
              label="Sync to Google Drive"
              sub={syncStatus === 'syncing' ? 'Uploading…' : (activeAccount ? `Connected to ${activeAccount.email}` : 'Not connected')}
              onPress={handleSyncToDrive}
              right={
                syncStatus === 'syncing'
                  ? <ActivityIndicator color={C.tertiary} size="small" />
                  : <MaterialIcons name="chevron-right" size={18} color={C.textFaint} />
              }
            />
          </View>
        </View>

        {/* Storage */}
        <View style={{ gap: S.sm }}>
          <Text style={styles.sectionLabel}>Storage</Text>
          <View style={styles.card}>
            <SettingRow
              icon="delete-forever" iconColor={C.error}
              label="Clear All Backups"
              sub={backupCount !== null && backupCount > 0
                ? `Delete all ${backupCount} local backup${backupCount > 1 ? 's' : ''}`
                : 'No local backups'}
              onPress={handleClearAll}
              destructive
              right={<MaterialIcons name="chevron-right" size={18} color={C.error} />}
            />
          </View>
        </View>

        {/* About */}
        <View style={{ gap: S.sm }}>
          <Text style={styles.sectionLabel}>About</Text>
          <View style={styles.card}>
            <SettingRow
              icon="info" iconColor={C.primary}
              label="Version"
              sub="SecureSMS Pro"
              right={<Text style={styles.valueChip}>{appVersion}</Text>}
            />
            <View style={styles.rowDivider} />
            <SettingRow
              icon="policy" iconColor={C.secondary}
              label="Play Store Compliance"
              sub="Google Play SMS policy 2026 compliant"
              right={<Text style={[styles.valueChip, { color: C.primary }]}>Active</Text>}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerDots}>
            {[0, 1, 2].map(i => (
              <View key={i} style={[styles.footerDot, i === 1 && { backgroundColor: C.primary }]} />
            ))}
          </View>
          <Text style={styles.footerTxt}>VAULT INTEGRITY VERIFIED</Text>
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
  pageSub: { fontSize: 13, color: C.textMuted },

  securityCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surfaceContainerHigh, borderRadius: R.xl,
    paddingHorizontal: S.lg, paddingVertical: S.md,
  },
  securityLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  securityTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  securitySub: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  securityBadge: { backgroundColor: 'rgba(93,218,195,0.15)', borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 4 },
  securityBadgeTxt: { fontSize: 11, fontWeight: '700', color: C.primary },

  storageRow: { flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' },
  storageChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.surfaceContainerLow, borderRadius: R.full,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  storageChipTxt: { fontSize: 12, fontWeight: '600', color: C.textMuted },

  sectionLabel: { fontSize: 11, fontWeight: '800', color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1.5, paddingHorizontal: 4 },
  card: { backgroundColor: C.surfaceContainerLow, borderRadius: R.xl, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingHorizontal: S.md, paddingVertical: S.md },
  rowDivider: { height: 1, backgroundColor: 'rgba(62,73,70,0.07)', marginHorizontal: S.md },
  rowIconWrap: { width: 36, height: 36, borderRadius: R.lg, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: C.text },
  rowSub: { fontSize: 11, color: C.textMuted, marginTop: 1, lineHeight: 16 },
  valueChip: { fontSize: 11, fontWeight: '700', color: C.textFaint, backgroundColor: C.surfaceContainerHighest, borderRadius: R.sm, paddingHorizontal: 8, paddingVertical: 3 },

  footer: { alignItems: 'center', paddingTop: 8, gap: S.sm },
  footerDots: { flexDirection: 'row', gap: 6 },
  footerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(93,218,195,0.2)' },
  footerTxt: { fontSize: 10, color: C.textFaint, letterSpacing: 2, textTransform: 'uppercase' },

  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: C.surfaceContainerLowest,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: S.xl, paddingTop: S.md, paddingBottom: 40,
    borderTopWidth: 1, borderColor: 'rgba(62,73,70,0.15)',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(62,73,70,0.3)',
    alignSelf: 'center', marginBottom: S.lg,
  },
  sheetCloseBtn: {
    position: 'absolute', top: S.md, right: S.lg,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.surfaceContainerHigh,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetIconWrap: {
    width: 56, height: 56, borderRadius: R.xl,
    backgroundColor: 'rgba(93,218,195,0.1)',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: S.md,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 6 },
  sheetSub: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: S.lg },
  sheetPrimaryBtn: {
    backgroundColor: C.primary, borderRadius: R.lg, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    marginBottom: S.sm,
  },
  sheetPrimaryBtnTxt: { color: C.bg, fontWeight: '800', fontSize: 14 },
  sheetSecondaryBtn: { paddingVertical: 12, alignItems: 'center' },
  sheetSecondaryBtnTxt: { color: C.textMuted, fontWeight: '600', fontSize: 14 },
  accountRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.surfaceContainerHigh, borderRadius: R.lg,
    padding: S.md,
  },
  accountAvatar: { width: 36, height: 36, borderRadius: 18 },
})
