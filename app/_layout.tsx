import AsyncStorage from '@react-native-async-storage/async-storage'
import * as LocalAuth from 'expo-local-authentication'
import { Stack } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import {
  AppState, AppStateStatus, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { AppAlert } from '../src/components/AppAlert'
import { useAppStore } from '../src/store/useAppStore'
import { registerAutoBackupTask } from '../src/services/task.service'
import { C, R, S } from '../src/theme'

export const BIOMETRIC_KEY = 'pref_biometric_lock'
const BG_LOCK_TIMEOUT = 30_000 // re-lock after 30 s in background

function BiometricLockScreen({ onUnlock }: { onUnlock: () => void }) {
  return (
    <View style={lock.root}>
      <View style={lock.iconWrap}>
        <MaterialIcons name="lock" size={48} color={C.tertiary} />
      </View>
      <Text style={lock.title}>SecureSMS</Text>
      <Text style={lock.sub}>Authenticate to access your vault</Text>
      <TouchableOpacity style={lock.btn} onPress={onUnlock} activeOpacity={0.85}>
        <MaterialIcons name="fingerprint" size={20} color={C.bg} />
        <Text style={lock.btnTxt}>Unlock</Text>
      </TouchableOpacity>
    </View>
  )
}

const lock = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 9999,
  },
  iconWrap: {
    width: 88, height: 88, borderRadius: R.full,
    backgroundColor: 'rgba(93,218,195,0.1)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: S.xl,
    borderWidth: 1, borderColor: 'rgba(93,218,195,0.2)',
  },
  title: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5, marginBottom: 8 },
  sub: { fontSize: 14, color: C.textMuted, marginBottom: S.xl * 2 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.tertiary, borderRadius: R.xl,
    paddingHorizontal: 32, paddingVertical: 16,
  },
  btnTxt: { fontSize: 16, fontWeight: '800', color: C.bg },
})

export default function RootLayout() {
  const alert = useAppStore((s) => s.alert)
  const hideAlert = useAppStore((s) => s.hideAlert)
  const loadSettings = useAppStore((s) => s.loadSettings)
  const autoBackupEnabled = useAppStore((s) => s.autoBackupEnabled)

  const [locked, setLocked] = useState(false)
  const enabledRef = useRef(false)
  const bgTimeRef = useRef<number | null>(null)

  async function doAuth() {
    try {
      const result = await LocalAuth.authenticateAsync({
        promptMessage: 'Unlock SecureSMS',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      })
      if (result.success) setLocked(false)
    } catch {
      // stay locked — user can retry via the button
    }
  }

  useEffect(() => {
    async function init() {
      await loadSettings()
      const val = await AsyncStorage.getItem(BIOMETRIC_KEY)
      const enabled = val === '1'
      enabledRef.current = enabled
      if (enabled) {
        setLocked(true)
        await doAuth()
      }
    }
    init()

    if (autoBackupEnabled) {
      registerAutoBackupTask().catch(e => console.error('Failed to register auto-backup:', e))
    }

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        bgTimeRef.current = Date.now()
      } else if (state === 'active' && enabledRef.current) {
        if (bgTimeRef.current && Date.now() - bgTimeRef.current > BG_LOCK_TIMEOUT) {
          setLocked(true)
          doAuth()
        }
        bgTimeRef.current = null
      }
    })

    return () => sub.remove()
  }, [])

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="library" />
        <Stack.Screen name="editor" />
        <Stack.Screen name="restore" />
        <Stack.Screen name="cleanup" />
        <Stack.Screen name="time-travel" />
        <Stack.Screen name="settings" />
      </Stack>
      <AppAlert
        visible={alert.visible}
        title={alert.title ?? ''}
        message={alert.message}
        buttons={alert.buttons}
        icon={alert.icon}
        iconColor={alert.iconColor}
        onClose={hideAlert}
      />
      {locked && <BiometricLockScreen onUnlock={doAuth} />}
    </>
  )
}
