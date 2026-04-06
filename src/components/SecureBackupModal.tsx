import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, Modal, ActivityIndicator, TouchableWithoutFeedback,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useBackup } from '../hooks/useBackup'
import { useAlert } from '../hooks/useAlert'
import { useAppStore } from '../store/useAppStore'
import { useKeyboardHeight } from '../hooks/useKeyboardHeight'
import { C, R, S } from '../theme'

export function SecureBackupModal({
  visible,
  onClose,
}: {
  visible: boolean
  onClose: () => void
}) {
  const { alert } = useAlert()
  const { startBackup, isRunning } = useBackup()
  const backupFetchedCount = useAppStore((s) => s.backupFetchedCount)
  const backupTotalCount = useAppStore((s) => s.backupTotalCount)
  const encryptionStatus = useAppStore((s) => s.encryptionStatus)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const kbHeight = useKeyboardHeight()

  async function handleCreate() {
    if (password.length < 6) {
      alert('Weak Password', 'Password must be at least 6 characters.', [{ text: 'OK' }], 'warning')
      return
    }
    if (password !== confirm) {
      alert('Mismatch', 'Passwords do not match.', [{ text: 'OK' }], 'error')
      return
    }

    try {
      await startBackup(password)
      onClose()
      setPassword('')
      setConfirm('')
    } catch {
      // errors handled in useBackup/useAlert if necessary
    }
  }

  function handleClose() {
    if (!isRunning) {
      onClose()
      setPassword('')
      setConfirm('')
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.scrim} />
      </TouchableWithoutFeedback>
      <View>
        <View style={[styles.sheet, { paddingBottom: kbHeight > 0 ? kbHeight + 16 : 40 }]}>
          <View style={styles.sheetHandle} />
          <TouchableOpacity style={styles.sheetCloseBtn} onPress={handleClose}>
            <MaterialIcons name="close" size={18} color={C.textMuted} />
          </TouchableOpacity>

          <View style={styles.sheetIconWrap}>
            <MaterialIcons name="lock" size={28} color={C.tertiary} />
          </View>
          <Text style={styles.sheetTitle}>Create Secure Backup</Text>
          <Text style={styles.sheetSub}>AES-256 encrypted backup. Your password is never stored — zero-knowledge.</Text>

          <TextInput
            style={styles.sheetInput}
            placeholder="Password (min. 6 characters)"
            placeholderTextColor={C.textFaint}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!isRunning}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.sheetInput}
            placeholder="Confirm password"
            placeholderTextColor={C.textFaint}
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
            editable={!isRunning}
            autoCapitalize="none"
          />

          {isRunning ? (
            <View style={styles.sheetProgress}>
              <ActivityIndicator color={C.primary} />
              <Text style={{ color: C.textMuted, fontSize: 13, marginLeft: 10 }}>
                {encryptionStatus === 'encrypting' 
                  ? 'Encrypting...' 
                  : (backupTotalCount > 0 
                      ? `Reading... ${backupFetchedCount} / ${backupTotalCount} messages` 
                      : `Reading... ${backupFetchedCount} messages`)}
              </Text>
            </View>
          ) : (
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.sheetCancelBtn} onPress={handleClose}>
                <Text style={{ color: C.textMuted, fontWeight: '600', fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetCreateBtn} onPress={handleCreate}>
                <MaterialIcons name="lock" size={16} color={C.bg} />
                <Text style={{ color: C.bg, fontWeight: '800', fontSize: 14 }}>Create Backup</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: C.surfaceContainerLowest,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: S.xl, paddingTop: S.md,
    borderTopWidth: 1, borderColor: 'rgba(93,218,195,0.12)',
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
  sheetInput: {
    backgroundColor: C.surfaceContainerHigh, borderRadius: R.lg,
    paddingHorizontal: S.md, paddingVertical: 14,
    color: C.text, fontSize: 15, marginBottom: S.md,
    borderWidth: 1, borderColor: 'rgba(62,73,70,0.15)',
  },
  sheetProgress: { flexDirection: 'row', alignItems: 'center', paddingVertical: S.md },
  sheetActions: { flexDirection: 'row', gap: S.md, marginTop: S.sm },
  sheetCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: R.lg,
    backgroundColor: C.surfaceContainerHigh, alignItems: 'center',
  },
  sheetCreateBtn: {
    flex: 2, paddingVertical: 14, borderRadius: R.lg,
    backgroundColor: C.tertiary,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
  },
})
