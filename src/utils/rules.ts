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
