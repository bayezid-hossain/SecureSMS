import { useState, useCallback } from 'react'
import { Thread } from '../types/sms.types'
import { readAllSms, groupIntoThreads, isDefaultSmsApp, requestDefaultSmsApp } from '../services/sms.service'

export function useSMS() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadThreads = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const messages = await readAllSms()
      const grouped = groupIntoThreads(messages)
      setThreads(grouped)
    } catch (e: any) {
      setError(e.message ?? 'Failed to read SMS')
    } finally {
      setLoading(false)
    }
  }, [])

  return { threads, loadThreads, loading, error, isDefaultSmsApp, requestDefaultSmsApp }
}
