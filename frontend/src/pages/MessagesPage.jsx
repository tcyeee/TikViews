import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useMessages } from '@/lib/MessageContext.jsx'

const LEVEL_COLORS = { info: 'var(--text)', success: '#2e7d32', warning: '#b45309', error: '#c0392b' }

function formatTime(isoString) {
  try {
    return new Date(isoString).toLocaleString()
  } catch {
    return isoString
  }
}

function MessagesPage() {
  const { messages, unreadCount, markRead, markAllRead, clearMessages } = useMessages()
  const [expandedIds, setExpandedIds] = useState(() => new Set())

  const toggleExpand = (id) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <main className="messages-page">
      <div className="messages-page-header">
        <h1>消息{unreadCount > 0 ? ` (${unreadCount})` : ''}</h1>
        <div className="messages-page-actions">
          <Button type="button" variant="outline" size="sm" onClick={clearMessages} disabled={messages.length === 0}>
            清空消息
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
            标为已读
          </Button>
        </div>
      </div>

      {messages.length === 0 ? (
        <p className="messages-page-empty">暂无消息</p>
      ) : (
        <ul className="messages-page-list">
          {messages.map((m) => {
            const expanded = expandedIds.has(m.id)
            return (
              <li
                key={m.id}
                className={`messages-page-item ${m.read ? 'is-read' : 'is-unread'}`}
                onClick={() => {
                  if (!m.read) markRead(m.id)
                  toggleExpand(m.id)
                }}
              >
                <span className="messages-page-dot" style={{ background: LEVEL_COLORS[m.level] || LEVEL_COLORS.info }} />
                <div className="messages-page-content">
                  <p className={expanded ? 'is-expanded' : ''} style={{ color: LEVEL_COLORS[m.level] || LEVEL_COLORS.info }}>
                    {m.content}
                  </p>
                  <time>{formatTime(m.createdAt)}</time>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}

export default MessagesPage
