import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useRouter, usePathname } from 'expo-router'
import { C, R } from '../theme'

type Tab = { label: string; icon: string; route: string }

const TABS: Tab[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/' },
  { label: 'Library', icon: 'inventory', route: '/library' },
  { label: 'Cleanup', icon: 'auto-delete', route: '/cleanup' },
  { label: 'Settings', icon: 'settings', route: '/settings' },
]

export function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <View style={styles.nav}>
      {TABS.map((tab) => {
        const active = pathname === tab.route || (tab.route === '/' && pathname === '')
        return (
          <TouchableOpacity
            key={tab.route}
            style={[styles.tab, active && styles.activeTab]}
            onPress={() => router.push(tab.route as any)}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={tab.icon as any}
              size={22}
              color={active ? C.primary : C.textMuted}
              style={{ opacity: active ? 1 : 0.6 }}
            />
            <Text style={[styles.label, active && styles.activeLabel]}>{tab.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    backgroundColor: 'rgba(18,20,22,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(62,73,70,0.15)',
    paddingVertical: 10,
    paddingBottom: 20,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: R.xl,
    marginHorizontal: 4,
    gap: 2,
  },
  activeTab: {
    backgroundColor: 'rgba(0,107,93,0.2)',
  },
  label: {
    fontSize: 11,
    color: C.textMuted,
    opacity: 0.6,
    fontWeight: '500',
  },
  activeLabel: {
    color: C.primary,
    opacity: 1,
  },
})
