/**
 * Bottom-sheet password prompt for opening encrypted (.enc.json) backups.
 */
import React, { useState, useEffect } from 'react'
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, TouchableWithoutFeedback,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { C, R, S } from '../theme'
import { useKeyboardHeight } from '../hooks/useKeyboardHeight'

interface Props {
  visible: boolean
  filename?: string
  loading?: boolean
  error?: string | null
  onUnlock: (password: string) => void
  onCancel: () => void
  onChange?: (password: string) => void
}

export function PasswordUnlockModal({ visible, filename, loading, error, onUnlock, onCancel, onChange }: Props) {
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const kbHeight = useKeyboardHeight()

  // Reset state each time the sheet opens
  useEffect(() => {
    if (visible) {
      setPassword('')
      setShowPw(false)
    }
  }, [visible])

  function handleUnlock() {
    if (!password || loading) return
    onUnlock(password)
  }

  function handleCancel() {
    setPassword('')
    onCancel()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={handleCancel}>
      <TouchableWithoutFeedback onPress={handleCancel}>
        <View style={styles.scrim} />
      </TouchableWithoutFeedback>

      <View>
        <View style={[styles.sheet, { paddingBottom: kbHeight > 0 ? kbHeight + 16 : 40 }]}>
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Close */}
          <TouchableOpacity style={styles.closeBtn} onPress={handleCancel} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <MaterialIcons name="close" size={18} color={C.textMuted} />
          </TouchableOpacity>

          {/* Icon */}
          <View style={styles.iconWrap}>
            <MaterialIcons name="lock" size={28} color={C.tertiary} />
          </View>
          <Text style={styles.title}>Unlock Secure Backup</Text>
          {filename ? (
            <Text style={styles.filename} numberOfLines={1}>
              {filename.replace(/\.enc\.json$/, '')}
            </Text>
          ) : null}
          <Text style={styles.sub}>Enter the password used to encrypt this backup.</Text>

          {/* Input */}
          <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={C.textFaint}
              secureTextEntry={!showPw}
              value={password}
              onChangeText={(txt) => {
                setPassword(txt)
                onChange?.(txt)
              }}
              onSubmitEditing={handleUnlock}
              returnKeyType="done"
              editable={!loading}
              autoCapitalize="none"
              autoFocus
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw(v => !v)}>
              <MaterialIcons name={showPw ? 'visibility-off' : 'visibility'} size={18} color={C.textFaint} />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorRow}>
              <MaterialIcons name="error-outline" size={14} color={C.error} />
              <Text style={styles.errorTxt}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} disabled={loading}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.unlockBtn, (!password || loading) && styles.unlockBtnDisabled]}
              onPress={handleUnlock}
              disabled={!password || loading}
            >
              {loading
                ? (
                  <>
                    <ActivityIndicator color={C.bg} size="small" />
                    <Text style={styles.unlockTxt}>Decrypting...</Text>
                  </>
                )
                : (
                  <>
                    <MaterialIcons name="lock-open" size={16} color={C.bg} />
                    <Text style={styles.unlockTxt}>Unlock</Text>
                  </>
                )}
            </TouchableOpacity>
          </View>
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
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(62,73,70,0.3)',
    alignSelf: 'center', marginBottom: S.lg,
  },
  closeBtn: {
    position: 'absolute', top: S.md, right: S.lg,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.surfaceContainerHigh,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: R.xl,
    backgroundColor: 'rgba(93,218,195,0.1)',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: S.md,
  },
  title: { fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 4 },
  filename: { fontSize: 12, color: C.primary, textAlign: 'center', marginBottom: 6, fontWeight: '600' },
  sub: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: S.lg },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surfaceContainerHigh, borderRadius: R.lg,
    borderWidth: 1, borderColor: 'rgba(62,73,70,0.2)',
    paddingHorizontal: S.md, marginBottom: S.sm,
  },
  inputRowError: { borderColor: C.error },
  input: { flex: 1, color: C.text, fontSize: 15, paddingVertical: 14 },
  eyeBtn: { padding: 4 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: S.sm },
  errorTxt: { fontSize: 13, color: C.error, flex: 1 },
  btnRow: { flexDirection: 'row', gap: S.sm, marginTop: S.md },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: R.lg,
    backgroundColor: C.surfaceContainerHigh, alignItems: 'center',
  },
  cancelTxt: { color: C.textMuted, fontWeight: '600', fontSize: 14 },
  unlockBtn: {
    flex: 2, paddingVertical: 14, borderRadius: R.lg,
    backgroundColor: C.tertiary,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
  },
  unlockBtnDisabled: { opacity: 0.5 },
  unlockTxt: { color: C.bg, fontWeight: '800', fontSize: 14 },
})
