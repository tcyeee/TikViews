import { useEffect, useRef, useState } from 'react'
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

function MessageCenter() {
  const { messages, unreadCount, markRead, markAllRead, clearMessages } = useMessages()
  const [open, setOpen] = useState(false)
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const containerRef = useRef(null)

  const toggleExpand = (id) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="app-navigation-link message-center-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        消息
        {unreadCount > 0 && <span className="message-center-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="message-center-panel">
          <div className="message-center-header">
            <h2>消息</h2>
            <div className="message-center-header-actions">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={clearMessages}
                disabled={messages.length === 0}
              >
                清空消息
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={markAllRead}
                disabled={unreadCount === 0}
              >
                标为已读
              </Button>
            </div>
          </div>
          {messages.length === 0 ? (
            <p className="message-center-empty">暂无消息</p>
          ) : (
            <ul className="message-center-list">
              {messages.map((m) => {
                const expanded = expandedIds.has(m.id)
                return (
                  <li
                    key={m.id}
                    className={`message-center-item ${m.read ? 'is-read' : 'is-unread'}`}
                    onClick={() => {
                      if (!m.read) markRead(m.id)
                      toggleExpand(m.id)
                    }}
                  >
                    <span className="message-center-dot" style={{ background: LEVEL_COLORS[m.level] || LEVEL_COLORS.info }} />
                    <div className="message-center-content">
                      <p
                        className={expanded ? 'is-expanded' : ''}
                        style={{ color: LEVEL_COLORS[m.level] || LEVEL_COLORS.info }}
                      >
                        {m.content}
                      </p>
                      <time>{formatTime(m.createdAt)}</time>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default MessageCenter
