export type MessageType = 1 | 2 // 1 = inbox, 2 = sent

export interface Message {
  id: string
  address: string // phone number
  body: string
  date: number // unix ms
  type: MessageType
  threadId: string
  read: 0 | 1
  dateSent?: number
  serviceCenter?: string
}

export interface Thread {
  id: string
  address: string
  displayName?: string
  messages: Message[]
  lastMessage?: Message
  unreadCount?: number
}

export interface BackupMetadata {
  version: string
  createdAt: number
  device: string
  hash: string
  messageCount: number
  threadCount: number
}

export interface BackupFile {
  metadata: BackupMetadata
  threads: Thread[]
  index: Record<string, number> // threadId -> index in threads array
}

export interface MessageConflict {
  local: Message
  backup: Message
}

export interface DiffResult {
  added: Message[]
  removed: Message[]
  conflicts: MessageConflict[]
}

export type EncryptionStatus = 'idle' | 'encrypting' | 'decrypting' | 'done' | 'error'

export interface RestoreProgress {
  total: number
  current: number
  skipped: number
  failed: number
  status: 'idle' | 'running' | 'done' | 'error'
}
