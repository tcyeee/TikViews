import { useEffect, useState } from 'react'
import './App.css'
import { Button } from '@/components/ui/button'
import VideoManagementPage from './pages/VideoManagementPage.jsx'
import VideoScrapeTestPage from './pages/VideoScrapeTestPage.jsx'
import { useDynamicFavicon } from './lib/useDynamicFavicon.js'
import { MessageProvider } from './lib/MessageContext.jsx'
import MessageCenter from './components/MessageCenter.jsx'

function pageFromPath(pathname) {
  if (pathname === '/' || pathname === '/videos') return 'videos'
  if (pathname === '/about') return 'about'
  if (pathname === '/scrape-test') return 'scrape-test'
  return 'home'
}

function AppContent() {
  const [page, setPage] = useState(() => pageFromPath(window.location.pathname))
  const [backendResult, setBackendResult] = useState('')
  const [backendOnline, setBackendOnline] = useState(false)

  useEffect(() => {
    const onPopState = () => setPage(pageFromPath(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = (path) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path)
    }
    setPage(pageFromPath(path))
  }

  useEffect(() => {
    let socket
    let reconnectTimer
    let heartbeatTimer
    let pongTimer
    let stopped = false
    const connect = () => {
      if (stopped) return
      const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      socket = new WebSocket(`${scheme}//${window.location.host}/ws/heartbeat`)
      socket.onopen = () => {
        setBackendOnline(true)
        heartbeatTimer = window.setInterval(() => {
          if (socket.readyState !== WebSocket.OPEN) return
          socket.send('ping')
          window.clearTimeout(pongTimer)
          pongTimer = window.setTimeout(() => socket.close(), 5000)
        }, 10000)
      }
      socket.onmessage = (event) => {
        if (event.data === 'pong' || event.data === 'connected') {
          window.clearTimeout(pongTimer)
          setBackendOnline(true)
        }
      }
      socket.onclose = () => {
        setBackendOnline(false)
        window.clearInterval(heartbeatTimer)
        window.clearTimeout(pongTimer)
        if (!stopped) reconnectTimer = window.setTimeout(connect, 3000)
      }
      socket.onerror = () => socket.close()
    }
    connect()
    return () => {
      stopped = true
      window.clearTimeout(reconnectTimer)
      window.clearTimeout(pongTimer)
      window.clearInterval(heartbeatTimer)
      socket?.close()
    }
  }, [])

  if (page === 'videos') {
    return (
      <>
        <AppNavigation backendOnline={backendOnline} page={page} onNavigate={navigate} />
        <VideoManagementPage />
      </>
    )
  }

  if (page === 'about') {
    return <><AppNavigation backendOnline={backendOnline} page={page} onNavigate={navigate} /><AboutPage /></>
  }

  if (page === 'scrape-test') {
    return <><AppNavigation backendOnline={backendOnline} page={page} onNavigate={navigate} /><VideoScrapeTestPage /></>
  }

  const testBackend = async () => {
    setBackendResult('Loading...')
    try {
      const response = await fetch('/api/ping')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      setBackendResult(`${data.message} (${data.timestamp})`)
    } catch (error) {
      setBackendResult(`Request failed: ${error.message}`)
    }
  }

  return (
    <>
    <AppNavigation backendOnline={backendOnline} page={page} onNavigate={navigate} />
    <section id="center">
      <h1>TikTok 视频播放量批量查询</h1>

      <div>
        <Button type="button" onClick={testBackend}>
          Test backend connection
        </Button>
        {backendResult && <p>{backendResult}</p>}
      </div>
    </section>
    </>
  )
}

function AboutPage() {
  useDynamicFavicon()

  return (
    <main className="about-page">
      <div className="about-grid-bg" aria-hidden="true" />
      <img className="about-icon" src="/favicon.png" alt="TikViews 图标" />
      <h1>TikTok 视频播放量批量查询</h1>
      <p>帮助你批量查询 TikTok 视频的最新播放量，并通过清晰的明细与汇总快速了解查询结果。</p>
      <section className="about-author" aria-labelledby="about-author-title">
        <h2 id="about-author-title">关于作者</h2>
        <h3>Lucas <span>全栈开发工程师</span></h3>
        <p>8 年全栈开发经验，热爱编程，擅长 Java、Rust 相关技术栈和区块链技术。喜欢构建有用的工具和应用，享受创造的过程，并乐于开源分享。</p>
        <nav className="about-socials" aria-label="作者社交媒体">
          <a href="https://x.com/tcyeee" target="_blank" rel="noreferrer">𝕏 <span>Twitter</span></a>
          <a href="https://www.xiaohongshu.com/user/profile/5b9cf40e9a9c9300014062b4" target="_blank" rel="noreferrer"><span className="social-mark red">RED</span><span>小红书</span></a>
          <a href="https://github.com/tcyeee" target="_blank" rel="noreferrer">
            <span className="social-mark black">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.53v-2.04c-3.1.67-3.76-1.32-3.76-1.32-.5-1.28-1.23-1.62-1.23-1.62-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15 1 .1.76 2.09 3.34 1.58.1-.72.39-1.21.7-1.49-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.21 1.15-2.99-.12-.28-.5-1.42.11-2.95 0 0 .94-.3 3.05 1.14a10.6 10.6 0 0 1 5.55 0c2.11-1.44 3.05-1.14 3.05-1.14.61 1.53.23 2.67.11 2.95.72.78 1.15 1.77 1.15 2.99 0 4.29-2.61 5.24-5.1 5.51.4.35.75 1.03.75 2.08V22c0 .29.2.63.76.52A11.1 11.1 0 0 0 12 .9Z"/></svg>
            </span>
            <span>GitHub</span>
          </a>
          <a href="https://space.bilibili.com/10879225" target="_blank" rel="noreferrer"><span className="social-mark blue">▶</span><span>Bilibili</span></a>
        </nav>
      </section>
    </main>
  )
}

function AppNavigation({ backendOnline, page, onNavigate }) {
  const handleBrandClick = (e) => {
    e.preventDefault()
    onNavigate('/')
  }
  const handleVideosClick = (e) => {
    e.preventDefault()
    onNavigate('/videos')
  }
  const handleAboutClick = (e) => {
    e.preventDefault()
    onNavigate('/about')
  }
  const handleScrapeTestClick = (e) => {
    e.preventDefault()
    onNavigate('/scrape-test')
  }
  return (
    <header className="app-navigation">
      <a className="app-navigation-brand" href="/" onClick={handleBrandClick}>TikViews</a>
      <div className="app-navigation-right">
        <button
          type="button"
          className={`app-navigation-link ${page === 'videos' ? 'is-active' : ''}`}
          onClick={handleVideosClick}
        >
          达人管理
        </button>
        <button type="button" className={`app-navigation-link ${page === 'scrape-test' ? 'is-active' : ''}`} onClick={handleScrapeTestClick}>抓取测试</button>
        <button type="button" className={`app-navigation-link ${page === 'about' ? 'is-active' : ''}`} onClick={handleAboutClick}>网站信息</button>
        <MessageCenter />
        <div className={`backend-status ${backendOnline ? 'is-online' : 'is-offline'}`} role="status" aria-live="polite">
          <span className="backend-status-dot" aria-hidden="true" />
          {backendOnline ? 'Online' : 'Offline'}
        </div>
      </div>
    </header>
  )
}

function App() {
  return (
    <MessageProvider>
      <AppContent />
    </MessageProvider>
  )
}

export default App
