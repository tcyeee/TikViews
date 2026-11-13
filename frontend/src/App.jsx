import { useState } from 'react'
import './App.css'

function App() {
  const [backendResult, setBackendResult] = useState('')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/ytdlp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim() }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `请求失败（${res.status}）`)
      }
      setResult(await res.json())
    } catch (err) {
      setError(err.message || '请求失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="center">
      <h1>TikTok 视频播放量批量查询</h1>

      <div>
        <button type="button" className="counter" onClick={testBackend}>
          Test backend connection
        </button>
        {backendResult && <p>{backendResult}</p>}
      </div>

      <section style={{ width: '100%', maxWidth: 640, textAlign: 'left' }}>
        <h2>yt-dlp 抓取测试</h2>
        <p style={{ color: 'var(--text)' }}>
          仅用于测试：输入 TikTok 视频 ID（19 位数字）或完整视频链接，验证后端能否通过 yt-dlp 成功取得该视频的播放量等信息。
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="例如 7123456789012345678 或 https://www.tiktok.com/@user/video/..."
            style={{ flex: 1, padding: '8px 12px', fontSize: 14 }}
          />
          <button type="submit" disabled={loading} style={{ padding: '8px 16px' }}>
            {loading ? '抓取中…' : '开始测试'}
          </button>
        </form>

        {error && <p style={{ color: '#c0392b', marginTop: 16 }}>请求出错：{error}</p>}

        {result && (
          <section style={{ marginTop: 24, padding: 16, border: '1px solid var(--border)', borderRadius: 8 }}>
            <p>
              <strong>状态：</strong>
              {result.success ? (
                <span style={{ color: '#2e7d32' }}>成功</span>
              ) : (
                <span style={{ color: '#c0392b' }}>失败</span>
              )}
              {'　'}（耗时 {result.durationMs} ms）
            </p>
            {result.success ? (
              <ul>
                <li>视频 ID：{result.videoId}</li>
                <li>播放量：{result.viewCount ?? '未知'}</li>
                <li>点赞数：{result.likeCount ?? '未知'}</li>
                <li>评论数：{result.commentCount ?? '未知'}</li>
                <li>标题/描述：{result.title ?? '（无）'}</li>
                <li>作者：{result.uploaderId ?? '未知'}</li>
                <li>发布日期：{result.uploadDate ?? '未知'}</li>
              </ul>
            ) : (
              <p style={{ whiteSpace: 'pre-wrap', color: '#c0392b' }}>{result.errorMessage}</p>
            )}
          </section>
        )}
      </section>
    </section>
  )
}

export default App
