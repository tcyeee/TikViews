import { useEffect, useRef, useState } from 'react'
import { Info, MessageSquare, Power } from 'lucide-react'
import { useMessages } from '@/lib/MessageContext.jsx'
import { logout } from '@/lib/auth.js'

function UserMenu({ onNavigateMessages, onNavigateAbout }) {
  const { unreadCount } = useMessages()
  const [open, setOpen] = useState(false)
  const [renderPanel, setRenderPanel] = useState(false)
  const containerRef = useRef(null)
  const closeTimeoutRef = useRef(null)

  useEffect(() => {
    if (open) {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }
      setRenderPanel(true)
    } else if (renderPanel) {
      closeTimeoutRef.current = setTimeout(() => setRenderPanel(false), 120)
    }
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleMessagesClick = () => {
    setOpen(false)
    onNavigateMessages()
  }

  const handleAboutClick = () => {
    setOpen(false)
    onNavigateAbout()
  }

  return (
    <div ref={containerRef} className="user-menu">
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label="用户菜单"
      >
        <img src="/favicon.png" alt="" className="user-menu-avatar" />
        {unreadCount > 0 && <span className="user-menu-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {renderPanel && (
        <div className={`user-menu-panel ${open ? 'is-open' : 'is-closing'}`} role="menu">
          <button type="button" className="user-menu-item" role="menuitem" onClick={handleMessagesClick}>
            <MessageSquare size={16} aria-hidden="true" />
            <span>消息</span>
            {unreadCount > 0 && <span className="user-menu-item-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>
          <button type="button" className="user-menu-item" role="menuitem" onClick={handleAboutClick}>
            <Info size={16} aria-hidden="true" />
            <span>网站信息</span>
          </button>
          <button type="button" className="user-menu-item" role="menuitem" onClick={logout}>
            <Power size={16} aria-hidden="true" />
            <span>退出登录</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default UserMenu
