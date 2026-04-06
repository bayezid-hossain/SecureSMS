/**
 * AES-256 encryption with PBKDF2 key derivation.
 * Password is NEVER stored — zero-knowledge design.
 *
 * Uses expo-crypto for cryptographically secure random bytes (native RNG),
 * and crypto-js for AES-256-CBC encryption + PBKDF2 key derivation.
 */
import CryptoJS from 'crypto-js'
import * as ExpoCrypto from 'expo-crypto'

// Lowering iterations for React Native (pure JS crypto is slow)
const PBKDF2_ITERATIONS = 5000

export interface EncryptedPayload {
  salt: string // hex
  iv: string // hex
  ciphertext: string // base64
}

/** Convert native Uint8Array to CryptoJS WordArray */
function bytesToWordArray(bytes: Uint8Array): CryptoJS.lib.WordArray {
  const words: number[] = []
  for (let i = 0; i < bytes.length; i += 4) {
    words.push(
      ((bytes[i] ?? 0) << 24) |
      ((bytes[i + 1] ?? 0) << 16) |
      ((bytes[i + 2] ?? 0) << 8) |
      (bytes[i + 3] ?? 0)
    )
  }
  return CryptoJS.lib.WordArray.create(words as any, bytes.length)
}

export async function encrypt(plaintext: string, password: string): Promise<EncryptedPayload> {
  // Use expo-crypto (native) for cryptographically secure random bytes

  const saltBytes = await ExpoCrypto.getRandomBytesAsync(16)
  const ivBytes = await ExpoCrypto.getRandomBytesAsync(16)

  const salt = bytesToWordArray(saltBytes)
  const iv = bytesToWordArray(ivBytes)

  const key = CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  })

  const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  })

  return {
    salt: salt.toString(CryptoJS.enc.Hex),
    iv: iv.toString(CryptoJS.enc.Hex),
    ciphertext: encrypted.toString(), // base64
  }
}

export async function decrypt(payload: EncryptedPayload, password: string): Promise<string> {
  try {
    const salt = CryptoJS.enc.Hex.parse(payload.salt)
    const iv = CryptoJS.enc.Hex.parse(payload.iv)

    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: PBKDF2_ITERATIONS,
      hasher: CryptoJS.algo.SHA256,
    })

    // --- QUICK VERIFICATION ---
    // Decrypt only the first small chunk to check for invalid passwords instantly.
    // 128 chars of Base64 is ~96 bytes (6 blocks of AES).
    const checkSize = 128
    const partialCiphertext = payload.ciphertext.substring(0, checkSize)
    const partialDecrypted = CryptoJS.AES.decrypt(partialCiphertext, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.NoPadding,
    })

    const checkStr = partialDecrypted.toString(CryptoJS.enc.Utf8)
    if (checkStr && !checkStr.trim().startsWith('{')) {
      throw new Error('Incorrect password. Please try again.')
    }
    // --------------------------

    const decrypted = CryptoJS.AES.decrypt(payload.ciphertext, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    })

    const plaintext = decrypted.toString(CryptoJS.enc.Utf8)
    if (!plaintext) {
      throw new Error('Incorrect password. Please try again.')
    }
    return plaintext
  } catch (err: any) {
    // If the wrong password is provided, CryptoJS often fails to parse Pkcs7 padding 
    // or UTF-8 chunks natively, throwing TypeErrors.
    const msg = err?.message?.toLowerCase() || ''
    const isCryptoError =
      msg.includes('length') ||
      msg.includes('undefined') ||
      msg.includes('utf') ||
      msg.includes('padding') ||
      msg.includes('malformed') ||
      msg.includes('invalid')

    if (isCryptoError) {
      throw new Error('Incorrect password. Please try again.')
    }
    throw new Error(msg || 'Decryption failed. Incorrect password or corrupted data.')
  }
}
