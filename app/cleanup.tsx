import React, { useState, useCallback } from 'react'
import {
  ScrollView, StatusBar, StyleSheet, Switch,
  Text, TouchableOpacity, View, ActivityIndicator, Alert,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { AppHeader } from '../src/components/AppHeader'
import { BottomNav } from '../src/components/BottomNav'
import { SecurityPulse } from '../src/components/SecurityPulse'
import { C, R, S } from '../src/theme'
import { readAllSms } from '../src/services/sms.service'
import { isOTP, isPromotional, filterCleanupCandidates } from '../src/utils/rules'
import { formatRelative } from '../src/utils/date'

const AVG_MSG_BYTES = 512 // rough estimate per message for savings display

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function CleanupScreen() {
  const [otpEnabled, setOtpEnabled] = useState(true)
  const [promoEnabled, setPromoEnabled] = useState(true)
  const [threadLimit, setThreadLimit] = useState(50)

  const [scanning, setScanning] = useState(false)
  const [lastScanAt, setLastScanAt] = useState<number | null>(null)
  const [otpCount, setOtpCount] = useState<number | null>(null)
  const [promoCount, setPromoCount] = useState<number | null>(null)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [candidateCount, setCandidateCount] = useState<number | null>(null)

  async function runScan() {
    setScanning(true)
    try {
      const messages = await readAllSms()
      const otps = messages.filter(isOTP)
      const promos = messages.filter(isPromotional)
      const candidates = filterCleanupCandidates(messages)
      setTotalCount(messages.length)
      setOtpCount(otps.length)
      setPromoCount(promos.length)
      setCandidateCount(candidates.length)
      setLastScanAt(Date.now())
    } catch (e: any) {
      Alert.alert('Scan Failed', e?.message ?? 'Could not read device messages.')
    } finally {
      setScanning(false)
    }
  }

  useFocusEffect(useCallback(() => {
    // Auto-scan on first focus only
    if (lastScanAt === null) runScan()
  }, [lastScanAt]))

  const activeCandidates = (otpEnabled ? (otpCount ?? 0) : 0) + (promoEnabled ? (promoCount ?? 0) : 0)
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
        <View style={styles.statusCard}>
          <View style={styles.statusLeft}>
            {scanning
              ? <ActivityIndicator color={C.primary} size="small" />
              : <SecurityPulse size={8} />
            }
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.statusTitle}>
                {scanning ? 'Scanning messages...' : 'Automation Engine Active'}
              </Text>
              <Text style={styles.statusSub}>
                {lastScanAt
                  ? `Last sweep: ${formatRelative(lastScanAt)}`
                  : scanning ? 'Analyzing your messages' : 'Not scanned yet'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.runNowBtn} onPress={runScan} disabled={scanning} activeOpacity={0.85}>
            <Text style={styles.runNowTxt}>{scanning ? 'SCANNING' : 'RUN NOW'}</Text>
          </TouchableOpacity>
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
            <View style={styles.threadRetentionRow}>
              <View style={styles.threadRetentionLeft}>
                <View style={styles.ruleIconWrap}>
                  <MaterialIcons name="auto-delete" size={22} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ruleTitle}>Keep last {threadLimit} per thread</Text>
                  <Text style={styles.ruleDesc}>Prune long-running conversations to save storage.</Text>
                </View>
              </View>
              <View style={styles.threadRetentionRight}>
                <View style={styles.limitDisplay}>
                  <Text style={styles.limitTxt}>{threadLimit} MSG</Text>
                </View>
                <TouchableOpacity
                  style={styles.editLimitBtn}
                  onPress={() => setThreadLimit(t => t === 50 ? 100 : t === 100 ? 200 : 50)}
                  activeOpacity={0.85}
                >
                  <MaterialIcons name="edit" size={18} color={C.text} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Add Custom Rule */}
          <TouchableOpacity
            style={styles.addRuleCard}
            activeOpacity={0.85}
            onPress={() => Alert.alert('Coming Soon', 'Custom automation rules will be available in a future update.')}
          >
            <View style={styles.addRuleIcon}>
              <MaterialIcons name="add" size={22} color={C.primary} />
            </View>
            <Text style={styles.addRuleTxt}>CREATE CUSTOM AUTOMATION RULE</Text>
          </TouchableOpacity>
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
})
