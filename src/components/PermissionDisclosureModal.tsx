import React from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useColorScheme,
} from 'react-native'

interface Props {
  visible: boolean
  onAccept: () => void
  onDecline: () => void
}

export function PermissionDisclosureModal({ visible, onAccept, onDecline }: Props) {
  const scheme = useColorScheme()
  const dark = scheme === 'dark'
  const s = dark ? darkStyles : lightStyles

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.card, s.card]}>
          <Text style={[styles.title, s.title]}>SMS Access — Data Disclosure</Text>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={[styles.text, s.text]}>
              SecureSMS needs access to your SMS messages to perform backup and restore. Here is
              exactly what we do with your data:
            </Text>

            <Text style={[styles.bullet, s.text]}>
              • <Text style={styles.bold}>Backup:</Text> Your messages are read locally and saved
              as a file on your device (or your Google Drive, encrypted).
            </Text>
            <Text style={[styles.bullet, s.text]}>
              • <Text style={styles.bold}>Restore:</Text> Messages are re-inserted into your device
              SMS storage only when you explicitly request it.
            </Text>
            <Text style={[styles.bullet, s.text]}>
              • <Text style={styles.bold}>No external servers:</Text> Your SMS data is NEVER sent
              to our servers. All processing happens on-device.
            </Text>
            <Text style={[styles.bullet, s.text]}>
              • <Text style={styles.bold}>Encryption:</Text> Backups can optionally be
              AES-256 encrypted with your password. Your password is never stored.
            </Text>
            <Text style={[styles.bullet, s.text]}>
              • <Text style={styles.bold}>Default SMS app:</Text> To restore messages, the app
              temporarily needs to be your default SMS app. You can revert this after restore.
            </Text>
            <Text style={[styles.bullet, s.text]}>
              • <Text style={styles.bold}>Revoke:</Text> You can revoke SMS permissions at any
              time in Android Settings → Apps → SecureSMS → Permissions.
            </Text>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.declineBtn]} onPress={onDecline}>
              <Text style={styles.declineTxt}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.acceptBtn]} onPress={onAccept}>
              <Text style={styles.acceptTxt}>Allow Access</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  body: {
    marginBottom: 20,
  },
  text: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 6,
    paddingLeft: 4,
  },
  bold: {
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  declineBtn: {
    backgroundColor: '#e8e8e8',
  },
  acceptBtn: {
    backgroundColor: '#2563EB',
  },
  declineTxt: {
    color: '#333',
    fontWeight: '600',
    fontSize: 15,
  },
  acceptTxt: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
})

const lightStyles = StyleSheet.create({
  card: { backgroundColor: '#fff' },
  title: { color: '#111' },
  text: { color: '#444' },
})

const darkStyles = StyleSheet.create({
  card: { backgroundColor: '#1c1c1e' },
  title: { color: '#f2f2f7' },
  text: { color: '#aeaeb2' },
})
