import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, StatusBar, ActivityIndicator,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useShallow } from 'zustand/react/shallow'
import { AppHeader } from '../src/components/AppHeader'
import { BottomNav } from '../src/components/BottomNav'
import { SecurityPulse } from '../src/components/SecurityPulse'
import { SecureBackupModal } from '../src/components/SecureBackupModal'
import { C, R, S } from '../src/theme'
import { listBackups, deleteBackup, BackupListItem, BACKUP_DIR } from '../src/services/backup.service'
import { shareFile, zipAndShareAll } from '../src/services/share.service'
import { useDriveStore } from '../src/store/drive.store'
import { getAccessToken, getOrCreateFolder, uploadFile, listDriveBackups, downloadFile } from '../src/services/drive.service'
import * as FileSystem from 'expo-file-system/legacy'
import { useAppStore } from '../src/store/useAppStore'
import { useBackup } from '../src/hooks/useBackup'
import { useKeyboardHeight } from '../src/hooks/useKeyboardHeight'
import { useAlert } from '../src/hooks/useAlert'
import { formatRelative } from '../src/utils/date'

function formatSize(bytes: number) {
  if (bytes === 0) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function SectionHeader({ icon, label, count }: { icon: string; label: string; count: number }) {
  return (
    <View style={sectionStyles.row}>
      <MaterialIcons name={icon as any} size={14} color={C.textFaint} />
      <Text style={sectionStyles.label}>{label}</Text>
      <View style={sectionStyles.badge}>
        <Text style={sectionStyles.badgeTxt}>{count}</Text>
      </View>
    </View>
  )
}

const sectionStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, marginBottom: 8, marginTop: 4 },
  label: { fontSize: 10, fontWeight: '800', color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1.5, flex: 1 },
  badge: { backgroundColor: C.surfaceContainerHighest, borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTxt: { fontSize: 11, fontWeight: '700', color: C.textMuted },
})

function ArchiveRow({
  item,
  onEdit,
  onRestore,
  onShare,
  onDelete,
}: {
  item: BackupListItem
  onEdit: () => void
  onRestore: () => void
  onShare: () => void
  onDelete: () => void
}) {
  return (
    <View style={styles.archiveRow}>
      <View style={[styles.archiveIcon, item.encrypted && styles.archiveIconVault]}>
        <MaterialIcons
          name={item.encrypted ? 'lock' : 'folder-zip'}
          size={20}
          color={item.encrypted ? C.tertiary : C.primary}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.archiveName} numberOfLines={1}>
          {item.filename.replace(/\.enc\.json$|\.json$/, '')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Text style={styles.archiveDate}>{formatRelative(item.createdAt)}</Text>
          <Text style={styles.archiveSizeBadge}>{formatSize(item.size)}</Text>
        </View>
      </View>
      {/* Inline action icons */}
      <View style={styles.archiveActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onEdit} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <MaterialIcons name="edit" size={16} color={C.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onRestore} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <MaterialIcons name="restore" size={16} color={C.secondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onShare} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <MaterialIcons name="share" size={16} color={C.tertiary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDelete]} onPress={onDelete} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <MaterialIcons name="delete-outline" size={16} color={C.error} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function LibraryScreen() {
  const router = useRouter()
  const { alert } = useAlert()
  const [search, setSearch] = useState('')
  const [vaultModalVisible, setVaultModalVisible] = useState(false)
  const [sharingPath, setSharingPath] = useState<string | null>(null)
  const [shareAllLoading, setShareAllLoading] = useState(false)

  const { backupList, setBackupList, setSelectedBackup } = useAppStore(
    useShallow(s => ({
      backupList: s.backupList,
      setBackupList: s.setBackupList,
      setSelectedBackup: s.setSelectedBackup,
    }))
  )
  const { startBackup, isRunning } = useBackup()
  const kbHeight = useKeyboardHeight()

  const { activeAccount, syncStatus, setSyncStatus, setLastSyncAt } = useDriveStore()

  useEffect(() => {
    listBackups().then(setBackupList)
  }, [])

  async function handleCloudSync() {
    if (!activeAccount) {
      alert('Google Drive Not Connected', 'Please connect your Google account in Settings first.', [{ text: 'Go to Settings', onPress: () => router.push('/settings') }, { text: 'Cancel', style: 'cancel' }], 'info')
      return
    }
    setSyncStatus('syncing')
    try {
      const token = await getAccessToken()
      const folderId = await getOrCreateFolder(token)
      const localBackups = await listBackups()
      const driveFiles = await listDriveBackups(folderId, token)
      const driveFileNames = new Set(driveFiles.map(f => f.name))

      // 1. Upload local files missing in Drive
      let uploaded = 0
      for (const backup of localBackups) {
        if (!driveFileNames.has(backup.filename)) {
          const content = await FileSystem.readAsStringAsync(backup.filePath, { encoding: FileSystem.EncodingType.UTF8 })
          await uploadFile(backup.filename, content, folderId, token)
          uploaded++
        }
      }

      // 2. Download drive files missing locally
      let downloaded = 0
      const localFileNames = new Set(localBackups.map(b => b.filename))
      for (const df of driveFiles) {
        if (df.name.endsWith('.json') && df.name !== 'custom_rules.json' && !localFileNames.has(df.name)) {
          const content = await downloadFile(df.id, token)
          await FileSystem.writeAsStringAsync(BACKUP_DIR + df.name, content, { encoding: FileSystem.EncodingType.UTF8 })
          downloaded++
        }
      }

      // Refresh list if anything came down
      if (downloaded > 0) {
        const refreshed = await listBackups()
        setBackupList(refreshed)
      }

      setLastSyncAt(Date.now())
      setSyncStatus('done')

      const msgParts = []
      if (uploaded > 0) msgParts.push(`Uploaded ${uploaded} file(s)`)
      if (downloaded > 0) msgParts.push(`Downloaded ${downloaded} file(s)`)

      alert(
        'Sync Complete',
        msgParts.length > 0 ? msgParts.join(' and ') + ' successfully.' : 'All backups are already synced.',
        [{ text: 'OK' }],
        'check-circle'
      )
    } catch (e: any) {
      setSyncStatus('error', e?.message)
      alert('Sync Failed', e?.message ?? 'Could not sync to Google Drive.', [{ text: 'OK' }], 'error')
    }
  }

  const filtered = backupList.filter(b =>
    b.filename.toLowerCase().includes(search.toLowerCase())
  )

  const vaultBackups = filtered.filter(b => b.encrypted)
  const localBackups = filtered.filter(b => !b.encrypted)
  const totalSize = backupList.reduce((acc, b) => acc + b.size, 0)

  async function handleDelete(item: BackupListItem) {
    alert('Delete Archive', `Delete "${item.filename}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteBackup(item.filePath)
          listBackups().then(setBackupList)
        },
      },
    ], 'delete')
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

      <SecureBackupModal 
        visible={vaultModalVisible} 
        onClose={() => setVaultModalVisible(false)} 
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Title + Search */}
        <View style={{ gap: 8 }}>
          <Text style={styles.pageTitle}>Library</Text>
          <Text style={styles.pageSub}>Manage and restore your communication archives.</Text>
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

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statTop}>
              <MaterialIcons name="lock" size={20} color={C.tertiary} />
              <Text style={[styles.statChip, { color: C.tertiary }]}>Secure</Text>
            </View>
            <Text style={styles.statNum}>{vaultBackups.length}</Text>
            <Text style={styles.statSub}>Encrypted backups</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statTop}>
              <MaterialIcons name="sd-card" size={20} color={C.secondary} />
              <Text style={[styles.statChip, { color: C.secondary }]}>Local</Text>
            </View>
            <Text style={styles.statNum}>{localBackups.length}</Text>
            <Text style={styles.statSub}>Unencrypted backups</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: C.surfaceContainerHigh, justifyContent: 'space-between' }]}>
            <View style={styles.statTop}>
              <SecurityPulse size={8} />
              <Text style={styles.autoLabel}>Quick Actions</Text>
            </View>
            <TouchableOpacity
              style={[styles.vaultBtn, { marginBottom: 6 }]}
              onPress={() => setVaultModalVisible(true)}
              activeOpacity={0.85}
            >
              <MaterialIcons name="lock" size={13} color={C.bg} />
              <Text style={styles.vaultBtnTxt}>Secure Backup</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.backupNowBtn}
              onPress={() => startBackup()}
              disabled={isRunning || shareAllLoading}
              activeOpacity={0.85}
            >
              <Text style={styles.backupNowTxt}>{isRunning ? 'Running...' : 'Quick Backup'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.backupNowBtn, { marginTop: 4 }]}
              onPress={async () => {
                setShareAllLoading(true)
                try {
                  await zipAndShareAll()
                } catch (e: any) {
                  alert('Share Failed', e?.message ?? 'Could not share backups.', [{ text: 'OK' }], 'error')
                } finally {
                  setShareAllLoading(false)
                }
              }}
              disabled={isRunning || shareAllLoading}
              activeOpacity={0.85}
            >
              <Text style={styles.backupNowTxt}>{shareAllLoading ? 'Creating ZIP...' : 'Share All'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.backupNowBtn, { marginTop: 4, backgroundColor: C.primary }]}
              onPress={handleCloudSync}
              disabled={isRunning || shareAllLoading || syncStatus === 'syncing'}
              activeOpacity={0.85}
            >
              <MaterialIcons name="cloud-sync" size={13} color={C.bg} style={{ marginRight: 4 }} />
              <Text style={[styles.backupNowTxt, { color: C.bg }]}>
                {syncStatus === 'syncing' ? 'Syncing...' : 'Cloud Sync'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Total size */}
        {totalSize > 0 && (
          <View style={styles.totalRow}>
            <MaterialIcons name="folder" size={14} color={C.textFaint} />
            <Text style={styles.totalTxt}>
              {backupList.length} archive{backupList.length !== 1 ? 's' : ''} · {formatSize(totalSize)} total
            </Text>
          </View>
        )}

        {/* Secure Backup section */}
        {vaultBackups.length > 0 && (
          <View style={{ gap: 6 }}>
            <SectionHeader icon="lock" label="Secure Backup" count={vaultBackups.length} />
            {vaultBackups.map(item => (
              <ArchiveRow
                key={item.filePath}
                item={item}
                onEdit={() => openForEdit(item)}
                onRestore={() => openForRestore(item)}
                onShare={async () => {
                  setSharingPath(item.filePath)
                  try {
                    await shareFile(item.filePath)
                  } catch (e: any) {
                    alert('Share Failed', e?.message ?? 'Could not share this backup.', [{ text: 'OK' }], 'error')
                  } finally {
                    setSharingPath(null)
                  }
                }}
                onDelete={() => handleDelete(item)}
              />
            ))}
          </View>
        )}

        {/* Local Backups section */}
        {localBackups.length > 0 && (
          <View style={{ gap: 6 }}>
            <SectionHeader icon="smartphone" label="Local Backups" count={localBackups.length} />
            {localBackups.map(item => (
              <ArchiveRow
                key={item.filePath}
                item={item}
                onEdit={() => openForEdit(item)}
                onRestore={() => openForRestore(item)}
                onShare={async () => {
                  setSharingPath(item.filePath)
                  try {
                    await shareFile(item.filePath)
                  } catch (e: any) {
                    alert('Share Failed', e?.message ?? 'Could not share this backup.', [{ text: 'OK' }], 'error')
                  } finally {
                    setSharingPath(null)
                  }
                }}
                onDelete={() => handleDelete(item)}
              />
            ))}
          </View>
        )}

        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialIcons name="inventory" size={40} color={C.textFaint} style={{ marginBottom: 12 }} />
            <Text style={{ color: C.textMuted, fontSize: 14, textAlign: 'center' }}>
              No archives yet.{'\n'}Use "Quick Backup" or "Secure Backup" to create one.
            </Text>
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
  statTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  statChip: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  statNum: { fontSize: 22, fontWeight: '800', color: C.text },
  statSub: { fontSize: 10, color: C.textMuted, lineHeight: 14 },
  autoLabel: { fontSize: 9, fontWeight: '700', color: C.text, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1, marginLeft: 6 },

  vaultBtn: {
    backgroundColor: C.tertiary, borderRadius: R.lg,
    paddingVertical: 7, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 4,
  },
  vaultBtnTxt: { color: C.bg, fontWeight: '800', fontSize: 12 },
  backupNowBtn: {
    backgroundColor: C.primaryContainer,
    borderRadius: R.lg, paddingVertical: 7, alignItems: 'center',
  },
  backupNowTxt: { color: C.text, fontWeight: '700', fontSize: 12 },

  totalRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  totalTxt: { fontSize: 11, color: C.textFaint },

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
  archiveIconVault: { backgroundColor: 'rgba(93,218,195,0.1)' },
  archiveName: { fontSize: 13, fontWeight: '700', color: C.text },
  archiveDate: { fontSize: 11, color: C.textMuted },
  archiveSizeBadge: { fontSize: 10, color: C.textFaint, fontWeight: '600' },

  archiveActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  actionBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.surfaceContainerHighest,
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnDelete: { backgroundColor: 'rgba(147,0,10,0.15)' },

  emptyState: { alignItems: 'center', paddingVertical: 48 },
})

