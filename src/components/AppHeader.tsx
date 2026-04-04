import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { C, R } from '../theme'

interface Props {
  onSync?: () => void
  rightElement?: React.ReactNode
  backLabel?: string
  onBack?: () => void
}

export function AppHeader({ onSync, rightElement, backLabel, onBack }: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.left}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color={C.primary} />
          </TouchableOpacity>
        ) : (
          <MaterialIcons name="security" size={22} color={C.primary} style={{ marginRight: 8 }} />
        )}
        <Text style={styles.logo}>SECURE SMS PRO</Text>
      </View>
      <View style={styles.right}>
        {rightElement}
        {onSync !== undefined && (
          <TouchableOpacity onPress={onSync} style={styles.iconBtn}>
            <MaterialIcons name="sync" size={22} color={C.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const STATUS_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0

const styles = StyleSheet.create({
  header: {
    height: 56 + STATUS_HEIGHT,
    paddingTop: STATUS_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(18,20,22,0.95)',
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { color: C.primary, fontWeight: '900', fontSize: 14, letterSpacing: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 8, borderRadius: R.full },
  backBtn: { marginRight: 4 },
})
