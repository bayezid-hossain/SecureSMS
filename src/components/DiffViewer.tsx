import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { DiffResult, Message } from '../types/sms.types'
import { formatDate } from '../utils/date'

type Tab = 'added' | 'removed' | 'conflicts'

interface Props {
  diff: DiffResult
}

function DiffRow({ msg, type, dark }: { msg: Message; type: Tab; dark: boolean }) {
  const bgColor =
    type === 'added'
      ? dark ? '#14532d' : '#dcfce7'
      : type === 'removed'
      ? dark ? '#7f1d1d' : '#fee2e2'
      : dark ? '#713f12' : '#fef9c3'

  const tagColor =
    type === 'added' ? '#22c55e' : type === 'removed' ? '#ef4444' : '#f59e0b'

  return (
    <View style={[styles.row, { backgroundColor: bgColor }]}>
      <View style={[styles.tag, { backgroundColor: tagColor }]}>
        <Text style={styles.tagTxt}>
          {type === 'added' ? '+' : type === 'removed' ? '−' : '!'}
        </Text>
      </View>
      <View style={styles.content}>
        <Text style={[styles.address, dark ? styles.textDark : styles.textLight]}>
          {msg.address}
        </Text>
        <Text style={[styles.body, dark ? styles.textDark : styles.textLight]} numberOfLines={2}>
          {msg.body}
        </Text>
        <Text style={styles.date}>{formatDate(msg.date)}</Text>
      </View>
    </View>
  )
}

export function DiffViewer({ diff }: Props) {
  const [tab, setTab] = useState<Tab>('added')
  const dark = useColorScheme() === 'dark'

  const data =
    tab === 'added' ? diff.added : tab === 'removed' ? diff.removed : diff.conflicts

  const tabs: { key: Tab; label: string; count: number; color: string }[] = [
    { key: 'added', label: 'New', count: diff.added.length, color: '#22c55e' },
    { key: 'removed', label: 'Missing', count: diff.removed.length, color: '#ef4444' },
    { key: 'conflicts', label: 'Conflicts', count: diff.conflicts.length, color: '#f59e0b' },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && { borderBottomColor: t.color, borderBottomWidth: 2 }]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabTxt, dark && styles.textDark]}>
              {t.label}{' '}
              <Text style={{ color: t.color, fontWeight: '700' }}>{t.count}</Text>
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {data.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTxt, dark && styles.textDark]}>No items</Text>
        </View>
      ) : (
        <FlashList
          data={data}
          keyExtractor={(m) => `${m.id}-${m.date}`}
          renderItem={({ item }) => <DiffRow msg={item} type={tab} dark={dark} />}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabTxt: { fontSize: 13, color: '#374151' },
  row: { flexDirection: 'row', padding: 12, marginVertical: 2, marginHorizontal: 8, borderRadius: 8 },
  tag: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  tagTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  content: { flex: 1 },
  address: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  body: { fontSize: 13, lineHeight: 19 },
  date: { fontSize: 11, color: '#8e8e93', marginTop: 4 },
  textLight: { color: '#111' },
  textDark: { color: '#f2f2f7' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyTxt: { fontSize: 15, color: '#8e8e93' },
})
