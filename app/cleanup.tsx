import { MaterialIcons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView, StatusBar, StyleSheet, Switch,
  Text,
  TextInput,
  TouchableOpacity, View
} from 'react-native'
import { AppHeader } from '../src/components/AppHeader'
import { BottomNav } from '../src/components/BottomNav'
import { SecurityPulse } from '../src/components/SecurityPulse'
import { useAlert } from '../src/hooks/useAlert'
import { useKeyboardHeight } from '../src/hooks/useKeyboardHeight'
import { downloadFile, getAccessToken, getOrCreateFolder, listDriveBackups } from '../src/services/drive.service'
import { deleteSmsById, groupIntoThreads, isDefaultSmsApp, readAllSms, requestDefaultSmsApp } from '../src/services/sms.service'
import { useDriveStore } from '../src/store/drive.store'
import { C, R, S } from '../src/theme'
import { Message } from '../src/types/sms.types'
import { formatRelative } from '../src/utils/date'
import { isOTP, isPromotional, matchesCustomRule, RuleConditionType } from '../src/utils/rules'

const AVG_MSG_BYTES = 512 // rough estimate per message for savings display

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function CleanupScreen() {
  const { alert } = useAlert()
  const kbHeight = useKeyboardHeight()
  const [otpEnabled, setOtpEnabled] = useState(true)
  const [promoEnabled, setPromoEnabled] = useState(true)
  const [threadLimit, setThreadLimit] = useState(50)
  const [threadLimitEnabled, setThreadLimitEnabled] = useState(false)

  const [scanning, setScanning] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [lastScanAt, setLastScanAt] = useState<number | null>(null)
  const [otpMessages, setOtpMessages] = useState<Message[]>([])
  const [promoMessages, setPromoMessages] = useState<Message[]>([])
  const [threadLimitMessages, setThreadLimitMessages] = useState<Message[]>([])
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [cleanedCount, setCleanedCount] = useState<number | null>(null)

  // Custom Rules
  const { activeAccount, customRules, addCustomRule, deleteCustomRule, setCustomRules, updateCustomRule } = useDriveStore()
  const [customRuleMessages, setCustomRuleMessages] = useState<Message[]>([])
  const [addRuleVisible, setAddRuleVisible] = useState(false)
  const [newRuleType, setNewRuleType] = useState<RuleConditionType>('sender_contains')
  const [newRuleValue, setNewRuleValue] = useState('')
  const [newRuleName, setNewRuleName] = useState('')
  const [cleanProgress, setCleanProgress] = useState(0)
  const [syncingRules, setSyncingRules] = useState(false)

  const otpCount = otpMessages.length > 0 ? otpMessages.length : totalCount !== null ? 0 : null
  const promoCount = promoMessages.length > 0 ? promoMessages.length : totalCount !== null ? 0 : null
  const customCount = customRuleMessages.length > 0 ? customRuleMessages.length : totalCount !== null ? 0 : null
  const threadLimitCount = threadLimitMessages.length > 0 ? threadLimitMessages.length : totalCount !== null ? 0 : null

  const activeCandidates = (otpEnabled ? otpMessages.length : 0) +
    (promoEnabled ? promoMessages.length : 0) +
    (threadLimitEnabled ? threadLimitMessages.length : 0) +
    customCount!

  async function runScan() {
    setScanning(true)
    try {
      const messages = await readAllSms()
      const otps = messages.filter(isOTP)
      const promos = messages.filter(isPromotional)
      const customs = messages.filter(m => matchesCustomRule(m, customRules))

      let threadsToDelete: Message[] = []
      if (threadLimitEnabled && threadLimit > 0) {
        const threads = groupIntoThreads(messages)
        for (const thread of threads) {
          if (thread.messages.length > threadLimit) {
            threadsToDelete.push(...thread.messages.slice(0, thread.messages.length - threadLimit))
          }
        }
      }

      setTotalCount(messages.length)
      setOtpMessages(otps)
      setPromoMessages(promos)
      setThreadLimitMessages(threadsToDelete)
      setCustomRuleMessages(customs)
      setLastScanAt(Date.now())
      setCleanedCount(null)
    } catch (e: any) {
      alert('Scan Failed', e?.message ?? 'Could not read device messages.', [{ text: 'OK' }], 'error')
    } finally {
      setScanning(false)
    }
  }

  async function downloadLatestRules() {
    if (!activeAccount) {
      alert('Not Connected', 'Connect to Google Drive in settings first.', [{ text: 'OK' }], 'warning')
      return;
    }
    setSyncingRules(true)
    try {
      const token = await getAccessToken()
      const folderId = await getOrCreateFolder(token)
      const files = await listDriveBackups(folderId, token)
      const rulesFile = files.find(f => f.name === 'custom_rules.json')
      if (rulesFile) {
        const content = await downloadFile(rulesFile.id, token)
        const rules = JSON.parse(content)
        await setCustomRules(rules)
        alert('Rules Synced', 'Custom rules successfully downloaded from Drive.', [{ text: 'OK' }], 'check-circle')
        runScan() // Re-scan with new rules
      } else {
        alert('No Cloud Rules', 'No custom rules found in your Drive.', [{ text: 'OK' }], 'info')
      }
    } catch (e: any) {
      alert('Sync Error', e?.message ?? 'Could not fetch cloud rules', [{ text: 'OK' }], 'error')
    } finally {
      setSyncingRules(false)
    }
  }

  async function runClean() {
    const allCands = [
      ...(otpEnabled ? otpMessages : []),
      ...(promoEnabled ? promoMessages : []),
      ...(threadLimitEnabled ? threadLimitMessages : []),
      ...customRuleMessages,
    ]
    const candidates = Array.from(new Set(allCands))

    if (candidates.length === 0) {
      alert('Nothing to Clean', 'No eligible messages found. Run a scan first.', [{ text: 'OK' }], 'info')
      return
    }

    const isDefault = await isDefaultSmsApp()
    if (!isDefault) {
      alert(
        'Default SMS App Required',
        'To delete messages from your device, SecureSMS must be the default SMS app. Set it as default now?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Set as Default',
            onPress: async () => {
              const granted = await requestDefaultSmsApp()
              if (granted) runClean()
            },
          },
        ],
        'warning'
      )
      return
    }

    alert(
      'Clean Device Messages',
      `This will permanently delete ${candidates.length} message(s) from your device. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            setCleaning(true)
            setCleanProgress(0)
            let deleted = 0
            for (let i = 0; i < candidates.length; i++) {
              try {
                await deleteSmsById(candidates[i].id)
                deleted++
              } catch { /* skip failed */ }
              if (i % 5 === 0) setCleanProgress(i / candidates.length)
            }
            setCleanProgress(1)
            // Re-scan to refresh counts
            await runScan()
            setCleanedCount(deleted)
            setCleaning(false)
            alert('Done', `Deleted ${deleted} message(s) from your device.`, [{ text: 'OK' }], 'check-circle')
          },
        },
      ],
      'delete'
    )
  }

  function handleSaveRule() {
    if (!newRuleName || !newRuleValue) {
      alert('Invalid Block', 'Please provide both a name and a value.')
      return
    }
    addCustomRule({
      id: Date.now().toString(),
      name: newRuleName,
      type: newRuleType,
      value: newRuleValue,
      enabled: true
    })
    setAddRuleVisible(false)
    setNewRuleName('')
    setNewRuleValue('')
    runScan()
  }

  useFocusEffect(useCallback(() => {
    // Auto-scan on first focus only
    if (lastScanAt === null) runScan()
  }, [lastScanAt]))

  const optimizedPct = totalCount && totalCount > 0
    ? Math.round(100 - (activeCandidates / totalCount) * 100)
    : 100
  const projectedSavingsBytes = activeCandidates * AVG_MSG_BYTES

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <AppHeader onSync={runScan} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Hero */}
        <View style={{ gap: 8 }}>
          <Text style={styles.pageTitle}>Smart Cleanup Engine</Text>
          <Text style={styles.pageSub}>
            Automate your message hygiene. Define rules to keep your vault light and organized.
          </Text>
        </View>

        {/* Automation Status */}
        <View style={[styles.statusCard, { flexDirection: 'column', alignItems: 'stretch', gap: 12, borderRadius: R.xl }]}>
          <View style={styles.statusLeft}>
            {(scanning || cleaning)
              ? <ActivityIndicator color={C.primary} size="small" />
              : <SecurityPulse size={8} />
            }
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.statusTitle}>
                {cleaning ? 'Deleting messages...' : scanning ? 'Scanning messages...' : 'Automation Engine Active'}
              </Text>
              <Text style={styles.statusSub}>
                {cleaning ? 'Removing eligible messages from device'
                  : cleanedCount !== null ? `Cleaned ${cleanedCount} message(s) — scan to refresh`
                    : lastScanAt ? `Last sweep: ${formatRelative(lastScanAt)}`
                      : scanning ? 'Analyzing your messages' : 'Not scanned yet'}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <TouchableOpacity style={styles.runNowBtn} onPress={runScan} disabled={scanning || cleaning} activeOpacity={0.85}>
              <Text style={styles.runNowTxt}>{scanning ? 'SCANNING' : 'SCAN'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cleanNowBtn, (scanning || cleaning) && { opacity: 0.5 }]}
              onPress={runClean}
              disabled={scanning || cleaning}
              activeOpacity={0.85}
            >
              <MaterialIcons name="delete-sweep" size={14} color="#000" />
              <Text style={styles.cleanNowTxt}>{cleaning ? 'CLEANING' : 'CLEAN NOW'}</Text>
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
          {cleaning && (
            <View style={{ height: 4, backgroundColor: C.surfaceContainerLowest, borderRadius: 2, overflow: 'hidden', marginTop: 8 }}>
              <View style={{ height: 4, backgroundColor: C.tertiary, width: `${cleanProgress * 100}%` }} />
            </View>
          )}
        </View>

        {/* Scan Results — shown after scan */}
        {totalCount !== null && (
          <View style={styles.resultsRow}>
            <View style={styles.resultCard}>
              <MaterialIcons name="sms" size={18} color={C.primary} />
              <Text style={styles.resultNum}>{totalCount.toLocaleString()}</Text>
              <Text style={styles.resultLabel}>Total</Text>
            </View>
            <View style={styles.resultCard}>
              <MaterialIcons name="password" size={18} color={C.tertiary} />
              <Text style={styles.resultNum}>{otpCount?.toLocaleString() ?? '—'}</Text>
              <Text style={styles.resultLabel}>OTPs</Text>
            </View>
            <View style={styles.resultCard}>
              <MaterialIcons name="campaign" size={18} color={C.secondary} />
              <Text style={styles.resultNum}>{promoCount?.toLocaleString() ?? '—'}</Text>
              <Text style={styles.resultLabel}>Promo</Text>
            </View>
            <View style={styles.resultCard}>
              <MaterialIcons name="delete-sweep" size={18} color={C.error} />
              <Text style={[styles.resultNum, { color: C.error }]}>{activeCandidates.toLocaleString()}</Text>
              <Text style={styles.resultLabel}>Eligible</Text>
            </View>
          </View>
        )}

        {/* Configuration Cards */}
        <View style={styles.configGrid}>
          {/* OTP Management */}
          <View style={styles.ruleCard}>
            <View style={styles.ruleTop}>
              <View style={styles.ruleIconWrap}>
                <MaterialIcons name="password" size={22} color={C.primary} />
              </View>
              <Switch
                value={otpEnabled}
                onValueChange={setOtpEnabled}
                trackColor={{ false: C.surfaceContainerHighest, true: C.primary }}
                thumbColor="#fff"
              />
            </View>
            <Text style={styles.ruleTitle}>Delete OTPs older than 7 days</Text>
            <Text style={styles.ruleDesc}>
              Purge temporary authentication codes.{otpCount !== null ? ` ${otpCount.toLocaleString()} found on device.` : ''}
            </Text>
            <View style={styles.ruleFooter}>
              <MaterialIcons name="schedule" size={14} color={otpEnabled ? C.primary : C.textFaint} />
              <Text style={[styles.ruleFooterTxt, { color: otpEnabled ? C.primary : C.textFaint }]}>
                RECURRING WEEKLY
              </Text>
            </View>
          </View>

          {/* Promotional Cleanup */}
          <View style={styles.ruleCard}>
            <View style={styles.ruleTop}>
              <View style={styles.ruleIconWrap}>
                <MaterialIcons name="campaign" size={22} color={C.primary} />
              </View>
              <Switch
                value={promoEnabled}
                onValueChange={setPromoEnabled}
                trackColor={{ false: C.surfaceContainerHighest, true: C.primary }}
                thumbColor="#fff"
              />
            </View>
            <Text style={styles.ruleTitle}>Remove promotional messages</Text>
            <Text style={styles.ruleDesc}>
              Archive marketing blasts and bulk notifications.{promoCount !== null ? ` ${promoCount.toLocaleString()} found on device.` : ''}
            </Text>
            <View style={styles.ruleFooter}>
              <MaterialIcons name="visibility-off" size={14} color={promoEnabled ? C.primary : C.textFaint} />
              <Text style={[styles.ruleFooterTxt, { color: promoEnabled ? C.primary : C.textFaint }]}>
                {promoEnabled ? 'ENABLED' : 'DISABLED'}
              </Text>
            </View>
          </View>

          {/* Thread Retention */}
          <View style={[styles.ruleCard, styles.ruleCardWide]}>
            <View style={styles.ruleTop}>
              <View style={styles.ruleIconWrap}>
                <MaterialIcons name="auto-delete" size={22} color={C.primary} />
              </View>
              <Switch
                value={threadLimitEnabled}
                onValueChange={setThreadLimitEnabled}
                trackColor={{ false: C.surfaceContainerHighest, true: C.primary }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.threadRetentionRow}>
              <View style={styles.threadRetentionLeft}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ruleTitle}>Keep last per thread</Text>
                  <Text style={styles.ruleDesc}>Prune long-running conversations to save storage.{threadLimitCount !== null ? ` ${threadLimitCount.toLocaleString()} found on device.` : ''}</Text>
                </View>
              </View>
              <View style={styles.threadRetentionRight}>
                <View style={[styles.limitDisplay, { flexDirection: 'row', alignItems: 'center' }]}>
                  <TextInput
                    style={[styles.limitTxt, { padding: 0, minWidth: 28, textAlign: 'center' }]}
                    keyboardType="number-pad"
                    value={String(threadLimit)}
                    onChangeText={(t) => setThreadLimit(parseInt(t) || 0)}
                    editable={threadLimitEnabled}
                    selectTextOnFocus
                  />
                  <Text style={styles.limitTxt}> MSG</Text>
                </View>
              </View>
            </View>
            <View style={styles.ruleFooter}>
              <MaterialIcons name="visibility-off" size={14} color={threadLimitEnabled ? C.primary : C.textFaint} />
              <Text style={[styles.ruleFooterTxt, { color: threadLimitEnabled ? C.primary : C.textFaint }]}>
                {threadLimitEnabled ? 'ENABLED' : 'DISABLED'}
              </Text>
            </View>
          </View>

          {/* Custom Rules Dynamic List */}
          {customRules.map(rule => (
            <View key={rule.id} style={styles.ruleCard}>
              <View style={styles.ruleTop}>
                <View style={styles.ruleIconWrap}>
                  <MaterialIcons name="tune" size={22} color={C.tertiary} />
                </View>
                <Switch
                  value={rule.enabled}
                  onValueChange={(val) => {
                    updateCustomRule(rule.id, { enabled: val })
                    runScan()
                  }}
                  trackColor={{ false: C.surfaceContainerHighest, true: C.tertiary }}
                  thumbColor="#fff"
                />
              </View>
              <Text style={styles.ruleTitle}>{rule.name}</Text>
              <Text style={styles.ruleDesc}>
                Action: {rule.type.replace('_', ' ')} '{rule.value}'
              </Text>
              <View style={[styles.ruleFooter, { justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <MaterialIcons name="rule" size={14} color={rule.enabled ? C.tertiary : C.textFaint} />
                  <Text style={[styles.ruleFooterTxt, { color: rule.enabled ? C.tertiary : C.textFaint }]}>
                    CUSTOM RULE
                  </Text>
                </View>
                <TouchableOpacity onPress={() => {
                  alert(
                    'Delete Rule',
                    `Are you sure you want to delete the rule "${rule.name}"?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => { deleteCustomRule(rule.id); runScan(); } }
                    ],
                    'warning'
                  )
                }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <MaterialIcons name="delete" size={16} color={C.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <View style={{ flexDirection: 'row', gap: S.md }}>
            {activeAccount && (
              <TouchableOpacity
                style={[styles.addRuleCard, { flex: 1, borderColor: C.secondary, opacity: syncingRules ? 0.6 : 1 }]}
                activeOpacity={0.85}
                onPress={downloadLatestRules}
                disabled={syncingRules}
              >
                <View style={[styles.addRuleIcon, { backgroundColor: 'rgba(235,178,81,0.2)' }]}>
                  {syncingRules ? <ActivityIndicator color={C.secondary} size="small" /> : <MaterialIcons name="cloud-download" size={22} color={C.secondary} />}
                </View>
                <Text style={[styles.addRuleTxt, { color: C.secondary, textAlign: 'center' }]}>
                  {syncingRules ? 'SYNCING RULES...' : 'DOWNLOAD LATEST CLOUD RULES'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Add Custom Rule */}
            <TouchableOpacity
              style={[styles.addRuleCard, { flex: activeAccount ? 1 : undefined }]}
              activeOpacity={0.85}
              onPress={() => setAddRuleVisible(true)}
            >
              <View style={styles.addRuleIcon}>
                <MaterialIcons name="add" size={22} color={C.primary} />
              </View>
              <Text style={[styles.addRuleTxt, { textAlign: 'center' }]}>CREATE CUSTOM RULE</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Storage Insight */}
        <View style={styles.insightCard}>
          <View style={styles.ringOuter}>
            <View style={styles.ringInner}>
              <Text style={styles.ringPct}>{scanning ? '…' : `${optimizedPct}%`}</Text>
              <Text style={styles.ringLabel}>Optimized</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.insightTitle}>Projected Savings</Text>
            {scanning ? (
              <ActivityIndicator color={C.primary} size="small" style={{ marginTop: 6 }} />
            ) : totalCount === null ? (
              <Text style={styles.insightDesc}>Run a scan to see projected savings.</Text>
            ) : (
              <Text style={styles.insightDesc}>
                Based on your rules, the engine will clear approximately{' '}
                <Text style={{ color: C.primary, fontWeight: '700' }}>
                  {activeCandidates.toLocaleString()} messages
                </Text>
                {projectedSavingsBytes > 0 && (
                  <> (~{formatBytes(projectedSavingsBytes)})</>
                )}
                {' '}from your device.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Add Rule Modal */}
      <Modal visible={addRuleVisible} animationType="slide" transparent>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setAddRuleVisible(false)} />
        <View style={[styles.modalContent, { paddingBottom: kbHeight > 0 ? kbHeight + 16 : (Platform.OS === 'ios' ? 40 : S.xl) }]}>
          <Text style={styles.modalTitle}>New Custom Rule</Text>
          <Text style={styles.modalSub}>Define an explicit rule to prune messages during cleanups.</Text>

          <Text style={styles.inputLabel}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Block Bank Alerts"
            placeholderTextColor={C.textFaint}
            value={newRuleName}
            onChangeText={setNewRuleName}
            autoCorrect={false}
          />

          <Text style={styles.inputLabel}>Condition</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {(['sender_contains', 'sender_equals', 'body_contains'] as RuleConditionType[]).map(rt => (
              <TouchableOpacity key={rt} style={[styles.conditionChip, newRuleType === rt && { backgroundColor: C.primary, borderColor: C.primary }]} onPress={() => setNewRuleType(rt)}>
                <Text style={[styles.conditionChipTxt, newRuleType === rt && { color: C.bg }]}>
                  {rt.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Value</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. INFOSMS"
            placeholderTextColor={C.textFaint}
            value={newRuleValue}
            onChangeText={setNewRuleValue}
            autoCorrect={false}
          />

          <TouchableOpacity style={[styles.sheetPrimaryBtn, { marginTop: 16 }]} onPress={handleSaveRule}>
            <Text style={styles.sheetPrimaryBtnTxt}>Save Rule</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sheetSecondaryBtn, { marginTop: 8 }]} onPress={() => setAddRuleVisible(false)}>
            <Text style={styles.sheetSecondaryBtnTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <BottomNav />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { padding: S.lg, gap: S.lg },

  pageTitle: { fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  pageSub: { fontSize: 13, color: C.textMuted, lineHeight: 20, maxWidth: 320 },

  statusCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surfaceContainerHigh,
    borderRadius: R.full, paddingHorizontal: S.lg, paddingVertical: S.md,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  statusTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  statusSub: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  runNowBtn: {
    backgroundColor: C.surfaceBright, borderRadius: R.xl,
    paddingHorizontal: S.md, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(62,73,70,0.15)',
  },
  runNowTxt: { fontSize: 12, fontWeight: '800', color: C.primary, letterSpacing: 1 },
  cleanNowBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.tertiary, borderRadius: R.xl,
    paddingHorizontal: S.md, paddingVertical: 8,
  },
  cleanNowTxt: { fontSize: 12, fontWeight: '800', color: C.bg, letterSpacing: 1 },

  resultsRow: { flexDirection: 'row', gap: S.sm },
  resultCard: {
    flex: 1, backgroundColor: C.surfaceContainerLow, borderRadius: R.xl,
    padding: S.sm, alignItems: 'center', gap: 4,
  },
  resultNum: { fontSize: 16, fontWeight: '800', color: C.text },
  resultLabel: { fontSize: 9, fontWeight: '700', color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1 },

  configGrid: { gap: S.md },
  ruleCard: {
    backgroundColor: C.surfaceContainerHigh,
    borderRadius: R.xl, padding: S.lg, gap: S.sm,
  },
  ruleCardWide: {},
  ruleTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  ruleIconWrap: {
    width: 48, height: 48, backgroundColor: 'rgba(0,107,93,0.2)',
    borderRadius: R.xl, alignItems: 'center', justifyContent: 'center',
  },
  ruleTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  ruleDesc: { fontSize: 13, color: C.textMuted, lineHeight: 20 },
  ruleFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  ruleFooterTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },

  threadRetentionRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  threadRetentionLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: S.md },
  threadRetentionRight: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  limitDisplay: {
    backgroundColor: C.surfaceContainerLowest, borderRadius: R.xl,
    paddingHorizontal: S.md, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(62,73,70,0.15)',
  },
  limitTxt: { fontSize: 13, fontWeight: '800', color: C.primary },
  editLimitBtn: { backgroundColor: C.primaryContainer, borderRadius: R.xl, padding: 10 },

  addRuleCard: {
    borderWidth: 2, borderStyle: 'dashed',
    borderColor: 'rgba(62,73,70,0.3)', borderRadius: R.xl,
    paddingVertical: S.xl, alignItems: 'center', justifyContent: 'center', gap: S.sm,
  },
  addRuleIcon: {
    width: 40, height: 40, borderRadius: R.full,
    backgroundColor: C.surfaceContainer, alignItems: 'center', justifyContent: 'center',
  },
  addRuleTxt: { fontSize: 11, fontWeight: '800', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 },

  insightCard: {
    flexDirection: 'row', alignItems: 'center', gap: S.lg,
    backgroundColor: C.surfaceContainerLowest, borderRadius: R.xl, padding: S.lg,
    borderWidth: 1, borderColor: 'rgba(62,73,70,0.15)',
  },
  ringOuter: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 4, borderColor: C.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  ringInner: { alignItems: 'center' },
  ringPct: { fontSize: 16, fontWeight: '900', color: C.text },
  ringLabel: { fontSize: 8, fontWeight: '700', color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1 },
  insightTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 6 },
  insightDesc: { fontSize: 13, color: C.textMuted, lineHeight: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.surfaceContainerLowest, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl,
    padding: S.xl, paddingBottom: Platform.OS === 'ios' ? 40 : S.xl
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 4 },
  modalSub: { fontSize: 13, color: C.textMuted, marginBottom: 24 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: C.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  input: {
    backgroundColor: C.surfaceContainer, borderRadius: R.lg, padding: 14,
    fontSize: 16, color: C.text, marginBottom: 16,
  },
  conditionChip: { borderWidth: 1, borderColor: 'rgba(62,73,70,0.2)', borderRadius: R.xl, paddingHorizontal: 12, paddingVertical: 8 },
  conditionChipTxt: { fontSize: 12, fontWeight: '600', color: C.text, textTransform: 'capitalize' },
  sheetPrimaryBtn: { backgroundColor: C.primary, borderRadius: R.xl, padding: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  sheetPrimaryBtnTxt: { fontSize: 15, fontWeight: '800', color: C.bg },
  sheetSecondaryBtn: { padding: 14, alignItems: 'center' },
  sheetSecondaryBtnTxt: { fontSize: 14, fontWeight: '700', color: C.textMuted },
})
