import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, StatusBar, Alert, Animated,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as FileSystem from 'expo-file-system/legacy'
import { useShallow } from 'zustand/react/shallow'
import { AppHeader } from '../src/components/AppHeader'
import { C, R, S } from '../src/theme'
import { loadBackup } from '../src/services/backup.service'
import { useAppStore } from '../src/store/useAppStore'
import { Thread, Message, BackupFile } from '../src/types/sms.types'
import { formatTime, formatDate } from '../src/utils/date'

function DateDivider({ date }: { date: number }) {
  return (
    <View style={divStyles.wrap}>
      <Text style={divStyles.text}>{formatDate(date)}</Text>
    </View>
  )
}

const divStyles = StyleSheet.create({
  wrap: { alignItems: 'center', marginVertical: 16 },
  text: {
    fontSize: 10, fontWeight: '700', color: 'rgba(190,201,197,0.4)',
    textTransform: 'uppercase', letterSpacing: 2,
    backgroundColor: C.surfaceContainerLow,
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: R.full,
    borderWidth: 1, borderColor: 'rgba(62,73,70,0.05)',
  },
})

interface BubbleProps {
  message: Message
  selected: boolean
  batchMode: boolean
  onSelect: () => void
  onEdit: (body: string) => void
  onDelete: () => void
}

function MessageBubbleDesigned({ message, selected, batchMode, onSelect, onEdit, onDelete }: BubbleProps) {
  const isSent = message.type === 2
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.body)

  const handleSave = () => { onEdit(draft); setEditing(false) }

  return (
    <TouchableOpacity
      onPress={batchMode ? onSelect : undefined}
      onLongPress={batchMode ? undefined : onSelect}
      activeOpacity={0.85}
      style={[styles.bubbleRow, isSent ? styles.bubbleRight : styles.bubbleLeft]}
    >
      {/* Batch checkbox */}
      {batchMode && (
        <View style={[styles.checkbox, selected && styles.checkboxActive]}>
          {selected && <MaterialIcons name="check" size={12} color={C.onPrimary} />}
        </View>
      )}

      {/* Avatar */}
      {!isSent && (
        <View style={styles.avatarIn}>
          <MaterialIcons name="person" size={14} color={C.onTertiaryContainer} />
        </View>
      )}

      <View style={[styles.bubbleCol, isSent && { alignItems: 'flex-end' }]}>
        {/* Sender label */}
        <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 4, marginBottom: 4 }}>
          <Text style={[styles.senderLabel, isSent && { color: C.primary }]}>
            {isSent ? 'Administrator' : 'Sender'}
          </Text>
          <Text style={styles.timeLabel}>{formatTime(message.date)}</Text>
        </View>

        {/* Bubble */}
        <View style={[styles.bubble, isSent ? styles.bubbleSent : styles.bubbleReceived, selected && styles.bubbleSelected]}>
          {editing ? (
            <View>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                multiline
                style={[styles.editInput, { color: isSent ? C.onSurface : C.text }]}
                autoFocus
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 6 }}>
                <TouchableOpacity onPress={() => setEditing(false)}>
                  <Text style={{ color: C.error, fontSize: 12, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave}>
                  <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '600' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={[styles.bubbleText, isSent && { textAlign: 'right' }]}>{message.body}</Text>
          )}
        </View>
      </View>

      {/* Inline edit/delete tools */}
      {!batchMode && (
        <View style={[styles.editTools, isSent ? styles.editToolsLeft : styles.editToolsRight]}>
          <TouchableOpacity style={styles.toolBtn} onPress={() => setEditing(true)}>
            <MaterialIcons name="edit" size={14} color={C.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toolBtn, styles.toolBtnDelete]} onPress={onDelete}>
            <MaterialIcons name="delete" size={14} color={C.error} />
          </TouchableOpacity>
        </View>
      )}

      {/* Avatar right */}
      {isSent && (
        <View style={styles.avatarOut}>
          <MaterialIcons name="shield" size={14} color={C.primary} />
        </View>
      )}
    </TouchableOpacity>
  )
}

export default function EditorScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ filePath?: string; encrypted?: string }>()
  const { selectedBackup, setSelectedBackup, backupList } = useAppStore(
    useShallow(s => ({
      selectedBackup: s.selectedBackup,
      setSelectedBackup: s.setSelectedBackup,
      backupList: s.backupList,
    }))
  )
  const [activeThread, setActiveThread] = useState<Thread | null>(null)
  const [batchMode, setBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [passwordPrompt, setPasswordPrompt] = useState('')

  useEffect(() => {
    if (params.filePath && !selectedBackup) {
      setLoading(true)
      loadBackup(params.filePath).then(backup => {
        setSelectedBackup(backup)
        setLoading(false)
      }).catch(() => setLoading(false))
    }
  }, [params.filePath])

  function editMessage(threadId: string, msgId: string, newBody: string) {
    if (!selectedBackup) return
    const updated: BackupFile = {
      ...selectedBackup,
      threads: selectedBackup.threads.map(t =>
        t.id === threadId
          ? { ...t, messages: t.messages.map(m => m.id === msgId ? { ...m, body: newBody } : m) }
          : t
      ),
    }
    setSelectedBackup(updated)
    if (activeThread?.id === threadId) {
      setActiveThread(updated.threads.find(t => t.id === threadId) ?? null)
    }
  }

  function deleteMessage(threadId: string, msgId: string) {
    if (!selectedBackup) return
    const updated: BackupFile = {
      ...selectedBackup,
      threads: selectedBackup.threads.map(t =>
        t.id === threadId
          ? { ...t, messages: t.messages.filter(m => m.id !== msgId) }
          : t
      ),
    }
    setSelectedBackup(updated)
    setActiveThread(updated.threads.find(t => t.id === threadId) ?? null)
  }

  function deleteBatch() {
    if (!selectedBackup || !activeThread || selectedIds.size === 0) return
    Alert.alert('Delete Messages', `Delete ${selectedIds.size} message(s)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          const updated: BackupFile = {
            ...selectedBackup,
            threads: selectedBackup.threads.map(t =>
              t.id === activeThread.id
                ? { ...t, messages: t.messages.filter(m => !selectedIds.has(m.id)) }
                : t
            ),
          }
          setSelectedBackup(updated)
          setActiveThread(updated.threads.find(t => t.id === activeThread.id) ?? null)
          setSelectedIds(new Set())
          setBatchMode(false)
        },
      },
    ])
  }

  async function handleSave() {
    if (!selectedBackup || !params.filePath) return
    await FileSystem.writeAsStringAsync(params.filePath, JSON.stringify(selectedBackup), {
      encoding: FileSystem.EncodingType.UTF8,
    })
    Alert.alert('Saved', 'Backup updated successfully.')
  }

  // Thread list view
  if (!activeThread || !selectedBackup) {
    const threads = selectedBackup?.threads ?? []
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <AppHeader
          onBack={() => { setSelectedBackup(null); router.back() }}
          rightElement={
            selectedBackup ? (
              <TouchableOpacity onPress={handleSave} style={{ paddingHorizontal: 8 }}>
                <Text style={{ color: C.primary, fontWeight: '700', fontSize: 14 }}>Save</Text>
              </TouchableOpacity>
            ) : null
          }
        />

        {loading ? (
          <View style={styles.center}>
            <Text style={{ color: C.textMuted }}>Loading archive...</Text>
          </View>
        ) : threads.length === 0 ? (
          <View style={styles.center}>
            <MaterialIcons name="inventory" size={40} color={C.textFaint} />
            <Text style={{ color: C.textMuted, marginTop: 12, textAlign: 'center' }}>
              {selectedBackup ? 'No threads in this backup.' : 'Open a backup from the Library.'}
            </Text>
          </View>
        ) : (
          <>
            {/* Conversation info header */}
            <View style={styles.convHeader}>
              <View>
                <Text style={styles.backupLabel}>
                  Backup: {params.filePath?.split('/').pop()?.replace(/\.enc\.json$|\.json$/, '') ?? 'Archive'}
                </Text>
                <View style={{ flexDirection: 'row', gap: S.sm, marginTop: 8 }}>
                  <View style={styles.statPill}>
                    <Text style={styles.statPillLabel}>Threads</Text>
                    <Text style={styles.statPillValue}>{threads.length}</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Text style={styles.statPillLabel}>Messages</Text>
                    <Text style={styles.statPillValue}>{threads.reduce((a, t) => a + t.messages.length, 0)}</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Text style={styles.statPillLabel}>Integrity</Text>
                    <Text style={styles.statPillValue}>100%</Text>
                  </View>
                </View>
              </View>
            </View>

            <FlashList
              data={threads}
              keyExtractor={t => t.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.threadItem} onPress={() => setActiveThread(item)}>
                  <View style={styles.threadAvatar}>
                    <Text style={styles.threadAvatarTxt}>{(item.displayName ?? item.address)[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.threadName} numberOfLines={1}>{item.displayName ?? item.address}</Text>
                    <Text style={styles.threadPreview} numberOfLines={1}>{item.lastMessage?.body ?? ''}</Text>
                  </View>
                  <Text style={styles.threadCount}>{item.messages.length}</Text>
                  <MaterialIcons name="chevron-right" size={18} color={C.textFaint} />
                </TouchableOpacity>
              )}
            />
          </>
        )}
      </View>
    )
  }

  // Message thread view
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <AppHeader
        onBack={() => { setActiveThread(null); setSelectedIds(new Set()); setBatchMode(false) }}
        rightElement={
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity
              style={[styles.batchBtn, batchMode && styles.batchBtnActive]}
              onPress={() => { setBatchMode(!batchMode); setSelectedIds(new Set()) }}
            >
              <MaterialIcons name="checklist" size={14} color={batchMode ? C.primary : C.textMuted} />
              <Text style={{ fontSize: 11, color: batchMode ? C.primary : C.textMuted, fontWeight: '500' }}>
                Batch
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave}>
              <MaterialIcons name="sync" size={20} color={C.primary} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Thread info bar */}
      <View style={styles.threadBar}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.threadBarPhone}>{activeThread.displayName ?? activeThread.address}</Text>
            <MaterialIcons name="verified" size={14} color={C.primary} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MaterialIcons name="storage" size={11} color={C.textMuted} />
            <Text style={styles.threadBarBackup}>Backup: {params.filePath?.split('/').pop()?.replace(/\.enc\.json$|\.json$/, '') ?? 'Archive'}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={styles.statPillSm}>
            <Text style={styles.statPillLabel}>Messages</Text>
            <Text style={styles.statPillValue}>{activeThread.messages.length.toLocaleString()}</Text>
          </View>
          <View style={styles.statPillSm}>
            <Text style={styles.statPillLabel}>Integrity</Text>
            <Text style={styles.statPillValue}>100%</Text>
          </View>
        </View>
      </View>

      {batchMode && selectedIds.size > 0 && (
        <TouchableOpacity style={styles.batchDeleteBar} onPress={deleteBatch}>
          <MaterialIcons name="delete-sweep" size={18} color={C.error} />
          <Text style={{ color: C.error, fontWeight: '600', fontSize: 13 }}>
            Delete {selectedIds.size} selected
          </Text>
        </TouchableOpacity>
      )}

      <FlashList
        data={activeThread.messages}
        keyExtractor={m => m.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item, index }: { item: Message; index: number }) => {
          const prevMsg = index > 0 ? activeThread.messages[index - 1] : null
          const showDate = !prevMsg || new Date(item.date).toDateString() !== new Date(prevMsg.date).toDateString()
          return (
            <View>
              {showDate && <DateDivider date={item.date} />}
              <MessageBubbleDesigned
                message={item}
                selected={selectedIds.has(item.id)}
                batchMode={batchMode}
                onSelect={() => {
                  setSelectedIds(prev => {
                    const next = new Set(prev)
                    next.has(item.id) ? next.delete(item.id) : next.add(item.id)
                    return next
                  })
                }}
                onEdit={body => editMessage(activeThread.id, item.id, body)}
                onDelete={() => deleteMessage(activeThread.id, item.id)}
              />
            </View>
          )
        }}
      />

      {/* FAB */}
      <View style={styles.fab}>
        <TouchableOpacity style={styles.fabBtn}>
          <MaterialIcons name="add" size={24} color={C.onPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },

  convHeader: {
    backgroundColor: C.surfaceContainerLowest, margin: S.md,
    borderRadius: R.xl, padding: S.lg,
    borderWidth: 1, borderColor: 'rgba(62,73,70,0.1)',
  },
  backupLabel: { fontSize: 13, color: C.textMuted, flexDirection: 'row', alignItems: 'center' },
  statPill: {
    backgroundColor: C.surfaceContainerHigh, borderRadius: R.lg,
    paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center',
  },
  statPillSm: {
    backgroundColor: C.surfaceContainerHigh, borderRadius: R.lg,
    paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center',
  },
  statPillLabel: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, color: C.textMuted, fontWeight: '700' },
  statPillValue: { fontSize: 16, fontWeight: '800', color: C.primary },

  threadItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: S.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(62,73,70,0.08)',
  },
  threadAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.surfaceContainerHighest,
    alignItems: 'center', justifyContent: 'center',
  },
  threadAvatarTxt: { fontSize: 18, fontWeight: '700', color: C.primary },
  threadName: { fontSize: 15, fontWeight: '600', color: C.text },
  threadPreview: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  threadCount: { fontSize: 11, color: C.textFaint, marginRight: 4 },

  threadBar: {
    backgroundColor: C.surfaceContainerLowest, margin: S.md, marginTop: 0,
    borderRadius: R.xl, padding: S.lg,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    borderWidth: 1, borderColor: 'rgba(62,73,70,0.1)',
  },
  threadBarPhone: { fontSize: 20, fontWeight: '800', color: C.primaryFixed },
  threadBarBackup: { fontSize: 12, color: C.textMuted },

  batchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: C.surfaceContainerHigh, borderRadius: R.full,
    borderWidth: 1, borderColor: 'rgba(62,73,70,0.15)',
  },
  batchBtnActive: { borderColor: 'rgba(93,218,195,0.3)' },
  batchDeleteBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(147,0,10,0.15)', paddingHorizontal: S.lg, paddingVertical: 10,
  },

  // Bubble
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginVertical: 3, maxWidth: '90%' },
  bubbleLeft: { alignSelf: 'flex-start' },
  bubbleRight: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  bubbleCol: { flex: 1 },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: 'rgba(93,218,195,0.2)' },
  avatarIn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.surfaceContainerHighest,
    borderWidth: 1, borderColor: 'rgba(62,73,70,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarOut: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,107,93,0.3)',
    borderWidth: 1, borderColor: 'rgba(93,218,195,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  senderLabel: { fontSize: 11, fontWeight: '700', color: C.textMuted },
  timeLabel: { fontSize: 10, color: 'rgba(190,201,197,0.4)' },
  bubble: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1,
  },
  bubbleReceived: {
    backgroundColor: C.surfaceContainerHigh,
    borderColor: 'rgba(62,73,70,0.1)',
    borderRadius: 12, borderBottomLeftRadius: 2,
  },
  bubbleSent: {
    backgroundColor: 'rgba(0,107,93,0.8)',
    borderColor: 'rgba(93,218,195,0.2)',
    borderRadius: 12, borderBottomRightRadius: 2,
  },
  bubbleSelected: { borderColor: C.primary, opacity: 0.7 },
  bubbleText: { fontSize: 14, color: C.text, lineHeight: 20 },
  editInput: { fontSize: 14, lineHeight: 20, minWidth: 160 },
  editTools: {
    flexDirection: 'column', gap: 4, position: 'absolute', top: 0,
  },
  editToolsRight: { right: -40 },
  editToolsLeft: { left: -40 },
  toolBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.surfaceContainerHighest,
    alignItems: 'center', justifyContent: 'center',
  },
  toolBtnDelete: { backgroundColor: 'rgba(147,0,10,0.2)' },

  fab: { position: 'absolute', bottom: 80, right: 20 },
  fabBtn: {
    width: 52, height: 52, borderRadius: R.xl,
    backgroundColor: C.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.primary, shadowRadius: 16, shadowOpacity: 0.3, elevation: 8,
  },
})
