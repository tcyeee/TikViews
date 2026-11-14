import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useMessages } from '@/lib/MessageContext.jsx'

const LEVEL_COLORS = { info: 'var(--text)', success: '#2e7d32', warning: '#b45309', error: '#c0392b' }
const PAGE_SIZE = 10

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
  const [page, setPage] = useState(1)

  const pageCount = Math.max(1, Math.ceil(messages.length / PAGE_SIZE))

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const pagedMessages = messages.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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
        <>
          <ul className="messages-page-list">
          {pagedMessages.map((m) => {
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

          {pageCount > 1 && (
            <div className="messages-page-pagination">
              <Button type="button" variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
                上一页
              </Button>
              <span className="messages-page-pagination-label">
                {page} / {pageCount}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= pageCount}>
                下一页
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  )
}

export default MessagesPage
