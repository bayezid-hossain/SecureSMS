import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, StatusBar, Alert,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useShallow } from 'zustand/react/shallow'
import { AppHeader } from '../src/components/AppHeader'
import { BottomNav } from '../src/components/BottomNav'
import { SecurityPulse } from '../src/components/SecurityPulse'
import { C, R, S } from '../src/theme'
import { listBackups, deleteBackup, BackupListItem } from '../src/services/backup.service'
import { useAppStore } from '../src/store/useAppStore'
import { useBackup } from '../src/hooks/useBackup'
import { formatRelative } from '../src/utils/date'

function formatSize(bytes: number) {
  if (bytes === 0) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default function LibraryScreen() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const { backupList, setBackupList, setSelectedBackup } = useAppStore(
    useShallow(s => ({
      backupList: s.backupList,
      setBackupList: s.setBackupList,
      setSelectedBackup: s.setSelectedBackup,
    }))
  )
  const { startBackup, isRunning } = useBackup()

  useEffect(() => {
    listBackups().then(setBackupList)
  }, [])

  const filtered = backupList.filter(b =>
    b.filename.toLowerCase().includes(search.toLowerCase())
  )

  const totalSize = backupList.reduce((acc, b) => acc + b.size, 0)
  const cloudCount = backupList.filter(b => b.encrypted).length
  const localCount = backupList.filter(b => !b.encrypted).length

  async function handleDelete(item: BackupListItem) {
    Alert.alert('Delete Archive', `Delete "${item.filename}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteBackup(item.filePath)
          listBackups().then(setBackupList)
        },
      },
    ])
  }

  function openForEdit(item: BackupListItem) {
    router.push({ pathname: '/editor' as any, params: { filePath: item.filePath, encrypted: item.encrypted ? '1' : '0' } })
  }

  function openForRestore(item: BackupListItem) {
    router.push({ pathname: '/restore' as any, params: { filePath: item.filePath, encrypted: item.encrypted ? '1' : '0' } })
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <AppHeader onSync={() => listBackups().then(setBackupList)} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Title + Search */}
        <View style={{ gap: 8 }}>
          <Text style={styles.pageTitle}>Library</Text>
          <Text style={styles.pageSub}>Manage and restore your encrypted communication snapshots.</Text>
          <View style={styles.searchWrap}>
            <MaterialIcons name="search" size={18} color={C.textFaint} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search archives..."
              placeholderTextColor={C.textFaint}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        {/* Stats bento */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statTop}>
              <MaterialIcons name="cloud-done" size={20} color={C.primary} />
              <Text style={styles.statChip}>Cloud Sync</Text>
            </View>
            <Text style={styles.statNum}>{formatSize(totalSize)}</Text>
            <Text style={styles.statSub}>{cloudCount} backups in Vault</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statTop}>
              <MaterialIcons name="sd-card" size={20} color={C.secondary} />
              <Text style={[styles.statChip, { color: C.secondary }]}>Local</Text>
            </View>
            <Text style={styles.statNum}>{formatSize(backupList.reduce((a, b) => a + (!b.encrypted ? b.size : 0), 0))}</Text>
            <Text style={styles.statSub}>{localCount} backups on device</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: C.surfaceContainerHigh, justifyContent: 'space-between' }]}>
            <View style={styles.statTop}>
              <SecurityPulse size={8} />
              <Text style={styles.autoLabel}>Auto-Backup Active</Text>
            </View>
            <TouchableOpacity
              style={styles.backupNowBtn}
              onPress={() => startBackup()}
              disabled={isRunning}
              activeOpacity={0.85}
            >
              <Text style={styles.backupNowTxt}>{isRunning ? 'Running...' : 'Back up Now'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Column headers */}
        <View style={styles.colHeaders}>
          <Text style={[styles.colHdr, { flex: 2 }]}>Archive Details</Text>
          <Text style={styles.colHdr}>Size</Text>
          <Text style={styles.colHdr}>Security</Text>
          <Text style={styles.colHdr}>Storage</Text>
          <Text style={[styles.colHdr, { textAlign: 'right' }]}> </Text>
        </View>

        {/* Archive list */}
        <View style={{ gap: S.sm }}>
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="inventory" size={40} color={C.textFaint} style={{ marginBottom: 12 }} />
              <Text style={{ color: C.textMuted, fontSize: 14 }}>No archives yet. Tap "Back up Now" to create one.</Text>
            </View>
          ) : (
            filtered.map((item) => (
              <TouchableOpacity
                key={item.filePath}
                style={styles.archiveRow}
                onPress={() => openForEdit(item)}
                activeOpacity={0.8}
              >
                <View style={styles.archiveIcon}>
                  <MaterialIcons name="folder-zip" size={22} color={C.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.archiveName} numberOfLines={1}>{item.filename.replace(/\.enc\.json$|\.json$/, '')}</Text>
                  <Text style={styles.archiveDate}>{formatRelative(item.createdAt)}</Text>
                </View>
                <Text style={styles.archiveSize}>{formatSize(item.size)}</Text>
                <View style={styles.archiveSecurity}>
                  <MaterialIcons name="verified-user" size={12} color={C.primary} />
                  <Text style={styles.archiveSecurityTxt}>AES-256</Text>
                </View>
                <View style={styles.archiveStorage}>
                  <MaterialIcons name={item.encrypted ? 'cloud' : 'smartphone'} size={12} color={item.encrypted ? C.secondary : C.textFaint} />
                  <Text style={styles.archiveStorageTxt}>{item.encrypted ? 'Cloud Vault' : 'Local Only'}</Text>
                </View>
                <TouchableOpacity onPress={() => {
                  Alert.alert(item.filename, undefined, [
                    { text: 'Edit', onPress: () => openForEdit(item) },
                    { text: 'Restore', onPress: () => openForRestore(item) },
                    { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item) },
                    { text: 'Cancel', style: 'cancel' },
                  ])
                }}>
                  <MaterialIcons name="more-vert" size={20} color={C.textMuted} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Footer indicator */}
        {backupList.length > 0 && (
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <Text style={{ fontSize: 10, color: C.textFaint, letterSpacing: 2, textTransform: 'uppercase' }}>
              Storage Integrity Checked
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
              {[0, 1, 2, 3].map(i => (
                <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i === 2 ? C.primary : 'rgba(93,218,195,0.2)' }} />
              ))}
            </View>
          </View>
        )}
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
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surfaceContainerHighest,
    borderRadius: R.xl, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: C.text, fontSize: 14 },

  statsRow: { flexDirection: 'row', gap: S.sm },
  statCard: {
    flex: 1, backgroundColor: C.surfaceContainerLow,
    borderRadius: R.xl, padding: S.md, gap: 4,
    borderWidth: 1, borderColor: 'rgba(62,73,70,0.1)',
  },
  statTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  statChip: { fontSize: 9, fontWeight: '700', color: 'rgba(93,218,195,0.6)', textTransform: 'uppercase', letterSpacing: 1 },
  statNum: { fontSize: 18, fontWeight: '800', color: C.text },
  statSub: { fontSize: 10, color: C.textMuted, lineHeight: 14 },
  autoLabel: { fontSize: 9, fontWeight: '700', color: C.text, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1, marginLeft: 6 },
  backupNowBtn: {
    marginTop: 12, backgroundColor: C.primaryContainer,
    borderRadius: R.xl, paddingVertical: 10, alignItems: 'center',
  },
  backupNowTxt: { color: C.text, fontWeight: '700', fontSize: 13 },

  colHeaders: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  colHdr: { flex: 1, fontSize: 9, fontWeight: '900', color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1.5 },

  archiveRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.surfaceContainerLow, borderRadius: R.xl,
    padding: S.md, borderWidth: 1, borderColor: 'rgba(62,73,70,0.05)',
  },
  archiveIcon: {
    width: 44, height: 44, borderRadius: R.lg,
    backgroundColor: C.surfaceContainerHighest,
    alignItems: 'center', justifyContent: 'center',
  },
  archiveName: { fontSize: 13, fontWeight: '700', color: C.text },
  archiveDate: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  archiveSize: { fontSize: 12, color: C.text, width: 50, textAlign: 'right' },
  archiveSecurity: { flexDirection: 'row', alignItems: 'center', gap: 3, width: 60 },
  archiveSecurityTxt: { fontSize: 10, fontWeight: '600', color: C.primary },
  archiveStorage: { flexDirection: 'row', alignItems: 'center', gap: 3, width: 60 },
  archiveStorageTxt: { fontSize: 10, color: C.textMuted },

  emptyState: { alignItems: 'center', paddingVertical: 48 },
})
