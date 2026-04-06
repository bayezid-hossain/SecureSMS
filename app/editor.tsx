import { MaterialIcons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import * as FileSystem from 'expo-file-system/legacy'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import {
  BackHandler,
  KeyboardAvoidingView, Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
} from 'react-native'
import { useShallow } from 'zustand/react/shallow'
import { AppHeader } from '../src/components/AppHeader'
import { PasswordUnlockModal } from '../src/components/PasswordUnlockModal'
import { useAlert } from '../src/hooks/useAlert'
import { loadBackup } from '../src/services/backup.service'
import { useAppStore } from '../src/store/useAppStore'
import { C, R, S } from '../src/theme'
import { BackupFile, Message, Thread } from '../src/types/sms.types'
import { formatDate, formatTime } from '../src/utils/date'

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
  isEditing: boolean
  editDraft: string
  isHighlighted?: boolean
  onSelect: () => void
  onEditStart: () => void
  onEditChange: (text: string) => void
  onEditSave: () => void
  onEditCancel: () => void
  onDelete: () => void
}

function MessageBubble({
  message, selected, batchMode, isEditing, editDraft, isHighlighted,
  onSelect, onEditStart, onEditChange, onEditSave, onEditCancel, onDelete,
}: BubbleProps) {
  const isSent = message.type === 2

  return (
    <View style={[styles.bubbleRow, isSent ? styles.bubbleRight : styles.bubbleLeft]}>
      {/* Batch checkbox */}
      {batchMode && (
        <TouchableOpacity
          onPress={onSelect}
          style={[styles.checkbox, selected && styles.checkboxActive]}
        >
          {selected && <MaterialIcons name="check" size={12} color={C.onPrimary} />}
        </TouchableOpacity>
      )}

      {/* Avatar left */}
      {!isSent && (
        <View style={styles.avatarIn}>
          <MaterialIcons name="person" size={14} color={C.onTertiaryContainer} />
        </View>
      )}

      <View style={[styles.bubbleCol, isSent && { alignItems: 'flex-end' }]}>
        {/* Sender label + time */}
        <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 4, marginBottom: 4 }}>
          <Text style={[styles.senderLabel, isSent && { color: C.primary }]}>
            {isSent ? 'You' : 'Sender'}
          </Text>
          <Text style={styles.timeLabel}>{formatTime(message.date)}</Text>
        </View>

        {/* Bubble */}
        <TouchableOpacity
          onLongPress={!batchMode ? onSelect : undefined}
          activeOpacity={batchMode ? 1 : 0.85}
          style={[
            styles.bubble,
            isSent ? styles.bubbleSent : styles.bubbleReceived,
            selected && styles.bubbleSelected,
            isHighlighted && styles.bubbleHighlighted
          ]}
        >
          {isEditing ? (
            <View>
              <TextInput
                value={editDraft}
                onChangeText={onEditChange}
                multiline
                style={[styles.editInput, { color: C.text }]}
                autoFocus
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 8 }}>
                <TouchableOpacity onPress={onEditCancel}>
                  <Text style={{ color: C.error, fontSize: 12, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onEditSave}>
                  <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '600' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={[styles.bubbleText, isSent && { textAlign: 'right' }]}>{message.body}</Text>
          )}
        </TouchableOpacity>

        {/* Inline edit/delete tools — below bubble, not absolutely positioned */}
        {!batchMode && !isEditing && (
          <View style={[styles.editTools, isSent && { alignSelf: 'flex-end' }]}>
            <TouchableOpacity style={styles.toolBtn} onPress={onEditStart}>
              <MaterialIcons name="edit" size={12} color={C.primary} />
              <Text style={styles.toolBtnTxt}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toolBtn, styles.toolBtnDelete]} onPress={onDelete}>
              <MaterialIcons name="delete" size={12} color={C.error} />
              <Text style={[styles.toolBtnTxt, { color: C.error }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Avatar right */}
      {isSent && (
        <View style={styles.avatarOut}>
          <MaterialIcons name="shield" size={14} color={C.primary} />
        </View>
      )}
    </View>
  )
}

export default function EditorScreen() {
  const router = useRouter()
  const { alert } = useAlert()
  const params = useLocalSearchParams<{ filePath?: string; encrypted?: string }>()
  const { selectedBackup, setSelectedBackup } = useAppStore(
    useShallow(s => ({
      selectedBackup: s.selectedBackup,
      setSelectedBackup: s.setSelectedBackup,
    }))
  )
  const [activeThread, setActiveThread] = useState<Thread | null>(null)
  const [batchMode, setBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [unlockVisible, setUnlockVisible] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [matchIndices, setMatchIndices] = useState<number[]>([])
  const [matchCurrent, setMatchCurrent] = useState(0)
  const listRef = useRef<any>(null)

  useEffect(() => {
    if (!params.filePath) return
    
    // Clear any previously loaded backup when opening a new one
    setSelectedBackup(null)
    setUnlockVisible(false)
    setUnlockError(null)

    if (params.encrypted === '1') {
      // Show password prompt for encrypted files
      setUnlockVisible(true)
    } else {
      setLoading(true)
      loadBackup(params.filePath)
        .then(backup => { setSelectedBackup(backup) })
        .catch(() => alert('Error', 'Failed to load backup.', [{ text: 'OK' }], 'error'))
        .finally(() => setLoading(false))
    }

    // Teardown when viewing screen closes
    return () => {
      setSelectedBackup(null)
    }
  }, [params.filePath])

  async function handleUnlock(password: string) {
    if (!params.filePath) return
    setUnlocking(true)
    setUnlockError(null)
    try {
      const backup = await loadBackup(params.filePath, password)
      setSelectedBackup(backup)
      setUnlockVisible(false)
    } catch (e: any) {
      setUnlockError(e?.message ?? 'Failed to decrypt.')
    } finally {
      setUnlocking(false)
    }
  }

  // Android hardware back button: inside thread → go to thread list (issue 8)
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeThread) {
        exitThread()
        return true
      }
      return false
    })
    return () => handler.remove()
  }, [activeThread])

  function exitThread() {
    setActiveThread(null)
    setSelectedIds(new Set())
    setBatchMode(false)
    setEditingMsgId(null)
    setEditDraft('')
    setSearchQuery('')
    setMatchIndices([])
    setMatchCurrent(0)
  }

  function startEdit(msg: Message) {
    setEditingMsgId(msg.id)
    setEditDraft(msg.body)
  }

  function cancelEdit() {
    setEditingMsgId(null)
    setEditDraft('')
  }

  function saveEdit() {
    if (!activeThread || !editingMsgId) return
    editMessage(activeThread.id, editingMsgId, editDraft)
    setEditingMsgId(null)
    setEditDraft('')
  }

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
    alert('Delete Messages', `Delete ${selectedIds.size} message(s)?`, [
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
    ], 'delete')
  }

  async function handleSave() {
    if (!selectedBackup || !params.filePath) return
    await FileSystem.writeAsStringAsync(params.filePath, JSON.stringify(selectedBackup), {
      encoding: FileSystem.EncodingType.UTF8,
    })
    alert('Saved', 'Backup updated successfully.', [{ text: 'OK' }], 'check-circle')
  }

  // Search find-in-page logic for messages
  useEffect(() => {
    if (!activeThread || !searchQuery.trim()) {
      setMatchIndices([])
      setMatchCurrent(0)
      return
    }
    const q = searchQuery.toLowerCase()
    const indices: number[] = []
    activeThread.messages.forEach((m, idx) => {
      if (m.body.toLowerCase().includes(q)) indices.push(idx)
    })
    setMatchIndices(indices)
    setMatchCurrent(0)
    if (indices.length > 0 && listRef.current) {
      listRef.current.scrollToIndex({ index: indices[0], animated: true })
    }
  }, [searchQuery, activeThread])

  function nextMatch(dir: number) {
    if (matchIndices.length === 0) return
    let next = matchCurrent + dir
    if (next < 0) next = matchIndices.length - 1
    if (next >= matchIndices.length) next = 0
    setMatchCurrent(next)
    listRef.current?.scrollToIndex({ index: matchIndices[next], animated: true })
  }

  // ── Thread list view ────────────────────────────────────────────────────────
  if (!activeThread || !selectedBackup) {
    const threads = selectedBackup?.threads ?? []

    let filteredThreads = threads
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filteredThreads = threads.filter(t =>
        (t.displayName?.toLowerCase().includes(q)) ||
        t.address.toLowerCase().includes(q) ||
        t.messages.some(m => m.body.toLowerCase().includes(q))
      )
    }

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <PasswordUnlockModal
          visible={unlockVisible}
          filename={params.filePath?.split('/').pop()}
          loading={unlocking}
          error={unlockError}
          onUnlock={handleUnlock}
          onChange={() => setUnlockError(null)}
          onCancel={() => { setUnlockVisible(false); router.back() }}
        />
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
            <View style={styles.convHeader}>
              <Text style={styles.backupLabel}>
                {params.filePath?.split('/').pop()?.replace(/\.enc\.json$|\.json$/, '') ?? 'Archive'}
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
              </View>
            </View>

            <View style={styles.searchWrap}>
              <MaterialIcons name="search" size={20} color={C.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search threads or messages..."
                placeholderTextColor={C.textFaint}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <MaterialIcons name="close" size={18} color={C.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filteredThreads}
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

  // ── Message thread view ─────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <AppHeader
        onBack={exitThread}
        rightElement={
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity
              style={[styles.batchBtn, batchMode && styles.batchBtnActive]}
              onPress={() => { setBatchMode(!batchMode); setSelectedIds(new Set()); setEditingMsgId(null) }}
            >
              <MaterialIcons name="checklist" size={14} color={batchMode ? C.primary : C.textMuted} />
              <Text style={{ fontSize: 11, color: batchMode ? C.primary : C.textMuted, fontWeight: '500' }}>
                Batch
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={{ paddingHorizontal: 8 }}>
              <Text style={{ color: C.primary, fontWeight: '700', fontSize: 14 }}>Save</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Thread info bar */}
      <View style={styles.threadBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.threadBarPhone} numberOfLines={1}>
            {activeThread.displayName ?? activeThread.address}
          </Text>
          <Text style={styles.threadBarBackup} numberOfLines={1}>
            {params.filePath?.split('/').pop()?.replace(/\.enc\.json$|\.json$/, '') ?? 'Archive'}
          </Text>
        </View>
        <View style={styles.statPillSm}>
          <Text style={styles.statPillLabel}>Messages</Text>
          <Text style={styles.statPillValue}>{activeThread.messages.length.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <MaterialIcons name="search" size={20} color={C.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search this conversation..."
          placeholderTextColor={C.textFaint}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && matchIndices.length > 0 && (
          <Text style={{ fontSize: 13, color: C.textMuted, marginRight: 8 }}>
            {matchCurrent + 1} of {matchIndices.length}
          </Text>
        )}
        {searchQuery.length > 0 && matchIndices.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => nextMatch(-1)} style={{ padding: 4 }}>
              <MaterialIcons name="keyboard-arrow-up" size={20} color={C.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => nextMatch(1)} style={{ padding: 4 }}>
              <MaterialIcons name="keyboard-arrow-down" size={20} color={C.textMuted} />
            </TouchableOpacity>
          </View>
        )}
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4, marginLeft: 8 }}>
            <MaterialIcons name="close" size={18} color={C.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {batchMode && selectedIds.size > 0 && (
        <TouchableOpacity style={styles.batchDeleteBar} onPress={deleteBatch}>
          <MaterialIcons name="delete-sweep" size={18} color={C.error} />
          <Text style={{ color: C.error, fontWeight: '600', fontSize: 13 }}>
            Delete {selectedIds.size} selected
          </Text>
        </TouchableOpacity>
      )}

      {/* KeyboardAvoidingView prevents edit input going under keyboard (issue 10) */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlashList
          // @ts-ignore
          ref={listRef}
          data={activeThread.messages}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          onScroll={({ nativeEvent }) => {
            const distFromBottom =
              nativeEvent.contentSize.height -
              nativeEvent.layoutMeasurement.height -
              nativeEvent.contentOffset.y
            setShowScrollBtn(distFromBottom > 300)
          }}
          scrollEventThrottle={200}
          renderItem={({ item, index }: { item: Message; index: number }) => {
            const prevMsg = index > 0 ? activeThread.messages[index - 1] : null
            const showDate = !prevMsg ||
              new Date(item.date).toDateString() !== new Date(prevMsg.date).toDateString()
            return (
              <View>
                {showDate && <DateDivider date={item.date} />}
                <MessageBubble
                  message={item}
                  selected={selectedIds.has(item.id)}
                  batchMode={batchMode}
                  isEditing={editingMsgId === item.id}
                  editDraft={editDraft}
                  isHighlighted={matchIndices.length > 0 && index === matchIndices[matchCurrent]}
                  onSelect={() => {
                    setSelectedIds(prev => {
                      const next = new Set(prev)
                      next.has(item.id) ? next.delete(item.id) : next.add(item.id)
                      return next
                    })
                  }}
                  onEditStart={() => startEdit(item)}
                  onEditChange={setEditDraft}
                  onEditSave={saveEdit}
                  onEditCancel={cancelEdit}
                  onDelete={() => deleteMessage(activeThread.id, item.id)}
                />
              </View>
            )
          }}
        />

        {/* Scroll-to-bottom FAB (issue 7) */}
        {showScrollBtn && (
          <TouchableOpacity
            style={styles.scrollToBottomBtn}
            onPress={() => listRef.current?.scrollToEnd({ animated: true })}
            activeOpacity={0.85}
          >
            <MaterialIcons name="arrow-downward" size={20} color={C.onPrimary} />
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
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
  backupLabel: { fontSize: 13, fontWeight: '700', color: C.textMuted },
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

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: S.md, marginBottom: S.md,
    backgroundColor: C.surfaceContainerHighest,
    borderRadius: R.full, paddingHorizontal: 16, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 14 },

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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(62,73,70,0.1)',
  },
  threadBarPhone: { fontSize: 18, fontWeight: '800', color: C.primaryFixed },
  threadBarBackup: { fontSize: 11, color: C.textMuted, marginTop: 2 },

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

  // Bubble layout
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginVertical: 4, maxWidth: '92%' },
  bubbleLeft: { alignSelf: 'flex-start' },
  bubbleRight: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  bubbleCol: { flex: 1 },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: C.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  checkboxActive: { backgroundColor: 'rgba(93,218,195,0.2)' },
  avatarIn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.surfaceContainerHighest,
    borderWidth: 1, borderColor: 'rgba(62,73,70,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 20,
  },
  avatarOut: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,107,93,0.3)',
    borderWidth: 1, borderColor: 'rgba(93,218,195,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 20,
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
  bubbleHighlighted: { borderColor: C.secondary, borderWidth: 2, backgroundColor: 'rgba(151,203,255,0.15)' },
  bubbleText: { fontSize: 14, color: C.text, lineHeight: 20 },
  editInput: { fontSize: 14, lineHeight: 20, minWidth: 160, minHeight: 40 },

  // Inline edit tools (not absolutely positioned — fixes last-message issue 9)
  editTools: {
    flexDirection: 'row', gap: 6, marginTop: 4, alignSelf: 'flex-start',
  },
  toolBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: C.surfaceContainerHighest,
    borderRadius: R.full,
  },
  toolBtnDelete: { backgroundColor: 'rgba(147,0,10,0.15)' },
  toolBtnTxt: { fontSize: 11, fontWeight: '600', color: C.primary },

  // Scroll-to-bottom FAB (issue 7)
  scrollToBottomBtn: {
    position: 'absolute', bottom: 16, right: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.primary, shadowRadius: 12, shadowOpacity: 0.3, elevation: 6,
  },
})
