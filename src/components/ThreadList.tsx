import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { Thread } from '../types/sms.types'
import { formatRelative } from '../utils/date'

interface Props {
  threads: Thread[]
  onSelect: (thread: Thread) => void
  selectedId?: string
}

function ThreadItem({
  thread,
  onSelect,
  selected,
  dark,
}: {
  thread: Thread
  onSelect: () => void
  selected: boolean
  dark: boolean
}) {
  return (
    <TouchableOpacity
      onPress={onSelect}
      style={[styles.item, dark ? styles.itemDark : styles.itemLight, selected && styles.selectedItem]}
    >
      <View style={[styles.avatar, { backgroundColor: stringToColor(thread.address) }]}>
        <Text style={styles.avatarText}>{(thread.displayName ?? thread.address)[0].toUpperCase()}</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={[styles.name, dark ? styles.textDark : styles.textLight]} numberOfLines={1}>
            {thread.displayName ?? thread.address}
          </Text>
          {thread.lastMessage && (
            <Text style={styles.time}>{formatRelative(thread.lastMessage.date)}</Text>
          )}
        </View>
        <View style={styles.row}>
          <Text
            style={[styles.preview, dark ? styles.previewDark : styles.previewLight]}
            numberOfLines={1}
          >
            {thread.lastMessage?.body ?? ''}
          </Text>
          {(thread.unreadCount ?? 0) > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>{thread.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

export function ThreadList({ threads, onSelect, selectedId }: Props) {
  const dark = useColorScheme() === 'dark'

  return (
    <FlashList
      data={threads}
      keyExtractor={(t) => t.id}
      renderItem={({ item }) => (
        <ThreadItem
          thread={item}
          onSelect={() => onSelect(item)}
          selected={item.id === selectedId}
          dark={dark}
        />
      )}
    />
  )
}

function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 45%, 50%)`
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemLight: { backgroundColor: '#fff', borderBottomColor: '#e5e7eb' },
  itemDark: { backgroundColor: '#1c1c1e', borderBottomColor: '#3a3a3c' },
  selectedItem: { backgroundColor: '#eff6ff' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  content: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '600', flex: 1 },
  textLight: { color: '#111' },
  textDark: { color: '#f2f2f7' },
  time: { fontSize: 12, color: '#8e8e93', marginLeft: 8 },
  preview: { fontSize: 14, flex: 1 },
  previewLight: { color: '#6b7280' },
  previewDark: { color: '#8e8e93' },
  badge: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 8,
  },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
})
