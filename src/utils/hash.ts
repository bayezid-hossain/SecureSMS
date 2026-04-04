import * as Crypto from 'expo-crypto'

export async function sha256(data: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data)
}

export async function hashBackupPayload(threads: object): Promise<string> {
  const json = JSON.stringify(threads)
  return sha256(json)
}
