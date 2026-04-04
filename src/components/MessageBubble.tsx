import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  useColorScheme,
} from 'react-native'
import { Message } from '../types/sms.types'
import { formatTime } from '../utils/date'

interface Props {
  message: Message
  editMode?: boolean
  selected?: boolean
  onPress?: () => void
  onLongPress?: () => void
  onEdit?: (newBody: string) => void
}

export function MessageBubble({
  message,
  editMode,
  selected,
  onPress,
  onLongPress,
  onEdit,
}: Props) {
  const isSent = message.type === 2
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.body)
  const scheme = useColorScheme()
  const dark = scheme === 'dark'

  const bubbleStyle = [
    styles.bubble,
    isSent ? styles.sent : styles.received,
    isSent ? (dark ? styles.sentDark : styles.sentLight) : dark ? styles.receivedDark : styles.receivedLight,
    selected && styles.selected,
  ]

  const textColor = isSent ? '#fff' : dark ? '#f2f2f7' : '#111'

  const handleSave = () => {
    onEdit?.(draft)
    setEditing(false)
  }

  return (
    <TouchableOpacity
      onPress={() => (editMode ? onPress?.() : undefined)}
      onLongPress={onLongPress}
      activeOpacity={editMode ? 0.7 : 1}
      style={[styles.row, isSent ? styles.rowRight : styles.rowLeft]}
    >
      <View style={bubbleStyle}>
        {editing ? (
          <View>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              style={[styles.input, { color: textColor }]}
              autoFocus
            />
            <View style={styles.editActions}>
              <TouchableOpacity onPress={() => setEditing(false)}>
                <Text style={styles.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave}>
                <Text style={styles.saveTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <Text style={[styles.body, { color: textColor }]}>{message.body}</Text>
            <Text style={[styles.time, { color: isSent ? 'rgba(255,255,255,0.7)' : dark ? '#8e8e93' : '#8e8e93' }]}>
              {formatTime(message.date)}
              {editMode && onEdit && (
                <Text onPress={() => setEditing(true)} style={styles.editBtn}>
                  {'  ✎'}
                </Text>
              )}
            </Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  row: {
    marginVertical: 2,
    marginHorizontal: 12,
  },
  rowRight: { alignItems: 'flex-end' },
  rowLeft: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  sent: { borderBottomRightRadius: 4 },
  received: { borderBottomLeftRadius: 4 },
  sentLight: { backgroundColor: '#2563EB' },
  sentDark: { backgroundColor: '#1d4ed8' },
  receivedLight: { backgroundColor: '#e5e7eb' },
  receivedDark: { backgroundColor: '#2c2c2e' },
  selected: { opacity: 0.6, borderWidth: 2, borderColor: '#f59e0b' },
  body: { fontSize: 15, lineHeight: 21 },
  time: { fontSize: 11, marginTop: 4, alignSelf: 'flex-end' },
  editBtn: { fontSize: 13 },
  input: { fontSize: 15, lineHeight: 21, minWidth: 180 },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 6,
  },
  cancelTxt: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  saveTxt: { color: '#22c55e', fontSize: 13, fontWeight: '600' },
})
