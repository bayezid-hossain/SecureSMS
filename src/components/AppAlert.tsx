/**
 * Custom bottom-sheet alert matching the SecureSMS dark design system.
 * Replaces React Native's `Alert.alert()` where consistent branding matters.
 */
import React from 'react'
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { C, R, S } from '../theme'

export interface AppAlertButton {
  text: string
  style?: 'default' | 'cancel' | 'destructive'
  onPress?: () => void
}

export interface AppAlertProps {
  visible: boolean
  title: string
  message?: string
  icon?: string
  iconColor?: string
  buttons?: AppAlertButton[]
  onClose?: () => void
  children?: React.ReactNode
}

export function AppAlert({
  visible,
  title,
  message,
  icon,
  iconColor,
  buttons = [{ text: 'OK' }],
  onClose,
  children,
}: AppAlertProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Scrim — tap to close */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.scrim} />
      </TouchableWithoutFeedback>

      {/* Bottom sheet */}
      <View style={styles.sheet}>
        {/* Drag handle */}
        <View style={styles.handle} />

        {/* Close button */}
        {onClose && (
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <MaterialIcons name="close" size={18} color={C.textMuted} />
          </TouchableOpacity>
        )}

        {/* Icon */}
        {icon && (
          <View style={[styles.iconWrap, { backgroundColor: `${iconColor ?? C.primary}18` }]}>
            <MaterialIcons name={icon as any} size={28} color={iconColor ?? C.primary} />
          </View>
        )}

        <Text style={styles.title}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {children}

        {buttons.length > 0 && (
          <View style={[styles.buttonRow, buttons.length === 1 && { justifyContent: 'center' }]}>
            {buttons.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.btn,
                  btn.style === 'cancel' && styles.btnCancel,
                  btn.style === 'destructive' && styles.btnDestructive,
                  buttons.length === 1 && { flex: 0, minWidth: 160 },
                ]}
                onPress={() => { btn.onPress?.() }}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.btnTxt,
                  btn.style === 'cancel' && styles.btnTxtCancel,
                  btn.style === 'destructive' && styles.btnTxtDestructive,
                ]}>
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: C.surfaceContainerLowest,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: S.xl,
    paddingTop: S.md,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderColor: 'rgba(62,73,70,0.2)',
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
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: S.md,
  },
  title: { fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: S.sm },
  message: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: S.sm },
  buttonRow: { flexDirection: 'row', gap: S.sm, marginTop: S.lg },
  btn: { flex: 1, backgroundColor: C.primary, borderRadius: R.lg, paddingVertical: 14, alignItems: 'center' },
  btnCancel: { backgroundColor: C.surfaceContainerHigh },
  btnDestructive: { backgroundColor: 'rgba(147,0,10,0.85)' },
  btnTxt: { fontSize: 14, fontWeight: '700', color: C.bg },
  btnTxtCancel: { color: C.textMuted },
  btnTxtDestructive: { color: '#fff' },
})
