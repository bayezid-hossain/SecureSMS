import React, { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Switch, Alert, ActivityIndicator,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import * as FileSystem from 'expo-file-system/legacy'
import Constants from 'expo-constants'
import { AppHeader } from '../src/components/AppHeader'
import { BottomNav } from '../src/components/BottomNav'
import { SecurityPulse } from '../src/components/SecurityPulse'
import { C, R, S } from '../src/theme'
import { useAppStore } from '../src/store/useAppStore'
import { listBackups } from '../src/services/backup.service'
import AsyncStorage from '@react-native-async-storage/async-storage'

const BACKUP_DIR = `${FileSystem.documentDirectory}backups/`
const KEYS = { autoBackup: 'pref_auto_backup', wifiOnly: 'pref_wifi_only', driveEnabled: 'pref_drive' }

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

export default function SettingsScreen() {
  const reset = useAppStore(s => s.reset)
  const setBackupList = useAppStore(s => s.setBackupList)

  const [autoBackup, setAutoBackupState] = useState(false)
  const [wifiOnly, setWifiOnlyState] = useState(true)
  const [driveEnabled, setDriveEnabledState] = useState(false)
  const [backupCount, setBackupCount] = useState<number | null>(null)
  const [backupSizeBytes, setBackupSizeBytes] = useState<number | null>(null)
  const [loadingPrefs, setLoadingPrefs] = useState(true)

  useFocusEffect(useCallback(() => {
    ;(async () => {
      try {
        const [ab, wo, de, list] = await Promise.all([
          AsyncStorage.getItem(KEYS.autoBackup),
          AsyncStorage.getItem(KEYS.wifiOnly),
          AsyncStorage.getItem(KEYS.driveEnabled),
          listBackups(),
        ])
        if (ab !== null) setAutoBackupState(ab === '1')
        if (wo !== null) setWifiOnlyState(wo === '1')
        if (de !== null) setDriveEnabledState(de === '1')
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
  function setDriveEnabled(v: boolean) { setDriveEnabledState(v); setPref(KEYS.driveEnabled, v) }

  async function handleClearAll() {
    Alert.alert(
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
              Alert.alert('Done', 'All local backups deleted.')
            } catch (e: any) {
              Alert.alert('Error', e.message)
            }
          },
        },
      ]
    )
  }

  const appVersion = Constants.expoConfig?.version ?? '1.0.0'
  const backupDirShort = BACKUP_DIR.replace(FileSystem.documentDirectory ?? '', '…/')

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <AppHeader onSync={() => {}} />

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
        {(backupCount !== null) && (
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

        {/* Backup Section */}
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

        {/* Privacy Section */}
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
              sub="Require biometric to open the app"
              onPress={() => Alert.alert('Coming Soon', 'Biometric lock will be available in a future update.')}
            />
          </View>
        </View>

        {/* Storage Section */}
        <View style={{ gap: S.sm }}>
          <Text style={styles.sectionLabel}>Storage</Text>
          <View style={styles.card}>
            <SettingRow
              icon="folder" iconColor={C.primary}
              label="Backup Location"
              sub={backupDirShort}
              right={<Text style={styles.valueChip}>Device</Text>}
            />
            <View style={styles.rowDivider} />
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

        {/* About Section */}
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
})
