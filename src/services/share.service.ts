/**
 * Backup sharing: single file share + zip-all-and-share.
 * Uses expo-sharing for the Android share sheet and fflate for zip creation.
 */
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { zipSync, strToU8 } from 'fflate'

const BACKUP_DIR = `${FileSystem.documentDirectory}backups/`

/**
 * Share a single backup file via the Android share sheet.
 */
export async function shareFile(filePath: string): Promise<void> {
  const available = await Sharing.isAvailableAsync()
  if (!available) throw new Error('Sharing is not available on this device.')

  await Sharing.shareAsync(filePath, {
    mimeType: 'application/json',
    dialogTitle: 'Share Backup',
  })
}

/**
 * Create a ZIP of all backup files and share via the Android share sheet.
 */
export async function zipAndShareAll(): Promise<void> {
  const available = await Sharing.isAvailableAsync()
  if (!available) throw new Error('Sharing is not available on this device.')

  // Read all backup files
  const files = await FileSystem.readDirectoryAsync(BACKUP_DIR)
  const jsonFiles = files.filter(f => f.endsWith('.json'))

  if (jsonFiles.length === 0) {
    throw new Error('No backup files found.')
  }

  // Build zip entries
  const zipEntries: Record<string, Uint8Array> = {}
  for (const filename of jsonFiles) {
    const content = await FileSystem.readAsStringAsync(
      `${BACKUP_DIR}${filename}`,
      { encoding: FileSystem.EncodingType.UTF8 }
    )
    zipEntries[filename] = strToU8(content)
  }

  // Create ZIP
  const zipped = zipSync(zipEntries, { level: 6 })

  // Write to cache and share
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const zipPath = `${FileSystem.cacheDirectory}SecureSMS_Backups_${timestamp}.zip`

  // Convert Uint8Array to base64 for writing
  const base64 = uint8ToBase64(zipped)
  await FileSystem.writeAsStringAsync(zipPath, base64, {
    encoding: FileSystem.EncodingType.Base64,
  })

  await Sharing.shareAsync(zipPath, {
    mimeType: 'application/zip',
    dialogTitle: 'Share All Backups',
  })
}

/** Convert Uint8Array to base64 string */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
