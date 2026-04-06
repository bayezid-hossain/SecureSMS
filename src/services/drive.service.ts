/**
 * Google Drive integration via @react-native-google-signin + Drive REST API v3.
 * Manages sign-in, multi-account support, and backup upload/download.
 */
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_NAME = 'SecureSMS_Backup'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

/** Must be called once at app startup */
export function configureDriveSignIn(webClientId: string) {
  GoogleSignin.configure({
    webClientId,
    offlineAccess: true,
    scopes: [DRIVE_SCOPE],
  })
}

export async function signIn() {
  await GoogleSignin.hasPlayServices()
  return GoogleSignin.signIn()
}

export async function signInSilently() {
  try {
    return await GoogleSignin.signInSilently()
  } catch {
    return null
  }
}

export async function signOut(): Promise<void> {
  await GoogleSignin.signOut()
}

export async function getAccessToken(): Promise<string> {
  const tokens = await GoogleSignin.getTokens()
  return tokens.accessToken
}

export async function getCurrentUser() {
  return GoogleSignin.getCurrentUser()
}

// ─── Drive REST API helpers ───────────────────────────────────────────────────

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size?: string
  createdTime?: string
  modifiedTime?: string
}

/**
 * Find or create the SecureSMS_Backup folder in the user's Drive root.
 */
export async function getOrCreateFolder(token: string): Promise<string> {
  // Search for existing folder
  const query = `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const searchRes = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const searchData = await searchRes.json()

  if (searchData.files?.length > 0) {
    return searchData.files[0].id
  }

  // Create folder
  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  })
  const created = await createRes.json()
  return created.id
}

/**
 * Upload a file to a specific Drive folder using multipart upload.
 */
export async function uploadFile(
  fileName: string,
  content: string,
  folderId: string,
  token: string,
  existingFileId?: string
): Promise<DriveFile> {
  const metadata = {
    name: fileName,
    ...(existingFileId ? {} : { parents: [folderId] }),
  }

  const boundary = '---securesms_boundary'
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`

  const url = existingFileId
    ? `${DRIVE_UPLOAD_API}/files/${existingFileId}?uploadType=multipart&fields=id,name,mimeType,size,createdTime,modifiedTime`
    : `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,modifiedTime`

  const res = await fetch(url, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Drive upload failed (${res.status}): ${errBody}`)
  }

  return (await res.json()) as DriveFile
}

/**
 * List all backup files in the SecureSMS_Backup folder.
 */
export async function listDriveBackups(
  folderId: string,
  token: string
): Promise<DriveFile[]> {
  const query = `'${folderId}' in parents and trashed=false`
  const res = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,createdTime,modifiedTime)&orderBy=modifiedTime desc&spaces=drive`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
  return (data.files ?? []) as DriveFile[]
}

/**
 * Download a file's content as a string.
 */
export async function downloadFile(
  fileId: string,
  token: string
): Promise<string> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Drive download failed (${res.status})`)
  return res.text()
}

/**
 * Delete a file from Drive.
 */
export async function deleteDriveFile(
  fileId: string,
  token: string
): Promise<void> {
  await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export { statusCodes }
