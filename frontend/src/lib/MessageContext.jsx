import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const MessageContext = createContext(null)

export function MessageProvider({ children }) {
  const [messages, setMessages] = useState([])

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/messages')
      if (!res.ok) return
      const data = await res.json()
      setMessages(Array.isArray(data.messages) ? data.messages : [])
    } catch {
      /* ignore network errors, badge just stays as-is */
    }
  }, [])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  const pushMessage = useCallback(async (level, content) => {
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, message: content }),
      })
      if (!res.ok) return
      const created = await res.json()
      setMessages((current) => [created, ...current])
    } catch {
      /* ignore network errors, message is only lost if the request itself failed */
    }
  }, [])

  const markRead = useCallback(async (id) => {
    setMessages((current) => current.map((m) => (m.id === id ? { ...m, read: true } : m)))
    try {
      await fetch(`/api/messages/${id}/read`, { method: 'POST' })
    } catch {
      /* ignore network errors */
    }
  }, [])

  const markAllRead = useCallback(async () => {
    setMessages((current) => current.map((m) => ({ ...m, read: true })))
    try {
      await fetch('/api/messages/read-all', { method: 'POST' })
    } catch {
      /* ignore network errors */
    }
  }, [])

  const unreadCount = messages.filter((m) => !m.read).length

  return (
    <MessageContext.Provider value={{ messages, unreadCount, pushMessage, markRead, markAllRead }}>
      {children}
    </MessageContext.Provider>
  )
}

export function useMessages() {
  const ctx = useContext(MessageContext)
  if (!ctx) throw new Error('useMessages must be used within a MessageProvider')
  return ctx
}
