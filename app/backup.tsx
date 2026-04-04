import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  TextInput,
  Switch,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native'
import { useBackup } from '../src/hooks/useBackup'
import { useAppStore } from '../src/store/useAppStore'
import { formatDate } from '../src/utils/date'
import { deleteBackup } from '../src/services/backup.service'

export default function BackupScreen() {
  const dark = useColorScheme() === 'dark'
  const [usePassword, setUsePassword] = useState(false)
  const [password, setPassword] = useState('')
  const { startBackup, refreshList, isRunning, error } = useBackup()
  const backupFetchedCount = useAppStore((s) => s.backupFetchedCount)
  const backupList = useAppStore((s) => s.backupList)

  const textStyle = dark ? styles.textDark : styles.textLight
  const bg = dark ? styles.darkBg : styles.lightBg
  const cardStyle = dark ? styles.cardDark : styles.cardLight

  async function handleBackup() {
    if (usePassword && password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.')
      return
    }
    await startBackup(usePassword ? password : undefined)
    if (!error) Alert.alert('Done', 'Backup created successfully.')
  }

  async function handleDelete(filePath: string) {
    Alert.alert('Delete Backup', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteBackup(filePath)
          await refreshList()
        },
      },
    ])
  }

  return (
    <ScrollView style={[styles.container, bg]} contentContainerStyle={styles.content}>
      <View style={[styles.card, cardStyle]}>
        <Text style={[styles.sectionTitle, textStyle]}>Create Backup</Text>

        <View style={styles.row}>
          <Text style={[styles.label, textStyle]}>Encrypt backup</Text>
          <Switch value={usePassword} onValueChange={setUsePassword} />
        </View>

        {usePassword && (
          <TextInput
            style={[styles.input, dark ? styles.inputDark : styles.inputLight]}
            placeholder="Enter password"
            placeholderTextColor="#8e8e93"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        )}

        {isRunning && (
          <View style={styles.progressRow}>
            <ActivityIndicator color="#2563EB" />
            <Text style={[styles.progressTxt, textStyle]}>
              {backupFetchedCount > 0 ? `Reading... ${backupFetchedCount} messages` : 'Starting...'}
            </Text>
          </View>
        )}

        {error && <Text style={styles.errorTxt}>{error}</Text>}

        <TouchableOpacity
          style={[styles.btn, isRunning && styles.btnDisabled]}
          onPress={handleBackup}
          disabled={isRunning}
        >
          <Text style={styles.btnTxt}>{isRunning ? 'Running...' : 'Start Backup'}</Text>
        </TouchableOpacity>
      </View>

      {backupList.length > 0 && (
        <View style={[styles.card, cardStyle]}>
          <Text style={[styles.sectionTitle, textStyle]}>Saved Backups</Text>
          {backupList.map((b) => (
            <View key={b.filePath} style={styles.backupItem}>
              <View style={styles.backupInfo}>
                <Text style={[styles.backupName, textStyle]} numberOfLines={1}>{b.filename}</Text>
                <Text style={styles.backupMeta}>
                  {formatDate(b.createdAt)} · {(b.size / 1024).toFixed(0)} KB
                  {b.encrypted ? ' · 🔒' : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(b.filePath)}>
                <Text style={styles.deleteTxt}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  darkBg: { backgroundColor: '#000' },
  lightBg: { backgroundColor: '#f3f4f6' },
  content: { padding: 16 },
  card: { borderRadius: 16, padding: 16, marginBottom: 16 },
  cardLight: { backgroundColor: '#fff' },
  cardDark: { backgroundColor: '#1c1c1e' },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 16 },
  textLight: { color: '#111' },
  textDark: { color: '#f2f2f7' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  label: { fontSize: 15 },
  input: { borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 12 },
  inputLight: { backgroundColor: '#f3f4f6', color: '#111' },
  inputDark: { backgroundColor: '#2c2c2e', color: '#f2f2f7' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  progressTxt: { fontSize: 14 },
  errorTxt: { color: '#ef4444', fontSize: 14, marginBottom: 12 },
  btn: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backupItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb' },
  backupInfo: { flex: 1, marginRight: 10 },
  backupName: { fontSize: 13, fontWeight: '500' },
  backupMeta: { fontSize: 12, color: '#8e8e93', marginTop: 2 },
  deleteTxt: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
})
