/**
 * AES-256 encryption with PBKDF2 key derivation.
 * Password is NEVER stored — zero-knowledge design.
 *
 * Uses crypto-js since React Native doesn't support crypto.subtle.
 */
import CryptoJS from 'crypto-js'

// Lowering iterations for React Native (pure JS crypto is slow)
const PBKDF2_ITERATIONS = 5000

export interface EncryptedPayload {
  salt: string // hex
  iv: string // hex
  ciphertext: string // base64
}

export async function encrypt(plaintext: string, password: string): Promise<EncryptedPayload> {
  // Use a slight timeout to yield thread before heavy sync compute
  await new Promise(r => setTimeout(r, 10))

  const salt = CryptoJS.lib.WordArray.random(16)
  const iv = CryptoJS.lib.WordArray.random(16)
  
  const key = CryptoJS.PBKDF2(password, salt, { 
    keySize: 256 / 32, 
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256
  })
  
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, { 
    iv: iv, 
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  })

  return {
    salt: salt.toString(CryptoJS.enc.Hex),
    iv: iv.toString(CryptoJS.enc.Hex),
    ciphertext: encrypted.toString(), // base64
  }
}

export async function decrypt(payload: EncryptedPayload, password: string): Promise<string> {
  await new Promise(r => setTimeout(r, 10))

  const salt = CryptoJS.enc.Hex.parse(payload.salt)
  const iv = CryptoJS.enc.Hex.parse(payload.iv)

  const key = CryptoJS.PBKDF2(password, salt, { 
    keySize: 256 / 32, 
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256
  })

  const decrypted = CryptoJS.AES.decrypt(payload.ciphertext, key, { 
    iv: iv, 
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  })

  const plaintext = decrypted.toString(CryptoJS.enc.Utf8)
  if (!plaintext) {
    throw new Error('Decryption failed. Incorrect password or corrupted data.')
  }
  return plaintext
}
