import { Message } from '../types/sms.types'
import { isOlderThanDays } from './date'

const OTP_PATTERNS = [
  /\b\d{4,8}\b.*(?:otp|code|pin|verify|verification|authenticate|token)/i,
  /(?:otp|code|pin|verify|verification|authenticate|token).*\b\d{4,8}\b/i,
  /your.*(?:otp|code|pin|password).*is\s*:?\s*\d{4,8}/i,
  /\d{4,8}\s+is\s+your\s+(?:otp|code|pin|verification)/i,
]

const PROMO_PATTERNS = [
  /(?:offer|discount|deal|sale|promo|coupon|cashback|reward|free|win|winner|prize|gift|congratu)/i,
  /(?:click here|tap here|visit|shop now|buy now|order now|limited time|expires)/i,
  /(?:unsubscribe|opt.?out|reply\s+stop|reply\s+no)/i,
]

export function isOTP(message: Message): boolean {
  return OTP_PATTERNS.some((p) => p.test(message.body))
}

export function isPromotional(message: Message): boolean {
  return PROMO_PATTERNS.some((p) => p.test(message.body))
}

export function shouldCleanup(message: Message, otpDays = 7, promoDays = 30): boolean {
  if (isOTP(message) && isOlderThanDays(message.date, otpDays)) return true
  if (isPromotional(message) && isOlderThanDays(message.date, promoDays)) return true
  return false
}

export function filterCleanupCandidates(
  messages: Message[],
  options = { otpDays: 7, promoDays: 30 }
): Message[] {
  return messages.filter((m) => shouldCleanup(m, options.otpDays, options.promoDays))
}

export type RuleConditionType = 'sender_contains' | 'body_contains' | 'sender_equals'

export interface CustomRule {
  id: string
  name: string
  type: RuleConditionType
  value: string
  enabled: boolean
}

export function matchesCustomRule(message: Message, rules: CustomRule[]): boolean {
  if (!rules || rules.length === 0) return false
  
  for (const rule of rules) {
    if (!rule.enabled || !rule.value) continue
    
    const value = rule.value.toLowerCase()
    
    if (rule.type === 'sender_contains' && message.address.toLowerCase().includes(value)) {
      return true
    }
    if (rule.type === 'sender_equals' && message.address.toLowerCase() === value) {
      return true
    }
    if (rule.type === 'body_contains' && message.body.toLowerCase().includes(value)) {
      return true
    }
  }
  
  return false
}
