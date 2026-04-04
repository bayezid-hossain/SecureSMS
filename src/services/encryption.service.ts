/**
 * AES-256 encryption with PBKDF2 key derivation.
 * Password is NEVER stored — zero-knowledge design.
 *
 * Uses expo-crypto for crypto primitives.
 */
import * as Crypto from 'expo-crypto'

const PBKDF2_ITERATIONS = 100_000
const SALT_LENGTH = 32 // bytes
const IV_LENGTH = 16 // bytes for AES-CBC

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

async function deriveKey(password: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-CBC', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export interface EncryptedPayload {
  salt: string // base64
  iv: string // base64
  ciphertext: string // base64
}

export async function encrypt(plaintext: string, password: string): Promise<EncryptedPayload> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const ivBytes = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const saltBuf = saltBytes.buffer as ArrayBuffer
  const ivBuf = ivBytes.buffer as ArrayBuffer
  const key = await deriveKey(password, saltBuf)

  const enc = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: ivBytes },
    key,
    enc.encode(plaintext)
  )

  return {
    salt: bufferToBase64(saltBuf),
    iv: bufferToBase64(ivBuf),
    ciphertext: bufferToBase64(ciphertext),
  }
}

export async function decrypt(payload: EncryptedPayload, password: string): Promise<string> {
  const saltBuf = base64ToBuffer(payload.salt)
  const ivBytes = new Uint8Array(base64ToBuffer(payload.iv))
  const ciphertext = base64ToBuffer(payload.ciphertext)

  const key = await deriveKey(password, saltBuf)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: ivBytes }, key, ciphertext)

  const dec = new TextDecoder()
  return dec.decode(plaintext)
}
