import { useEffect, useRef, useState } from 'react'

const COLUMNS = [
  { key: 'authorNickname', label: '达人昵称' },
  { key: 'authorId', label: '达人ID' },
  { key: 'videoInfo', label: '视频信息' },
  { key: 'videoId', label: '视频ID' },
  { key: 'publishTime', label: '发布时间' },
  { key: 'vv', label: 'VV' },
  { key: 'scrapeStatus', label: '抓取状态' },
  { key: 'scrapedAt', label: '抓取时间' },
]

function VideoManagementPage() {
  const [rows, setRows] = useState([])
  const [loadingVideos, setLoadingVideos] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [logs, setLogs] = useState([])
  const [uploading, setUploading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const [scrapingId, setScrapingId] = useState(null)
  const [copiedVideoId, setCopiedVideoId] = useState(null)
  const [logsVisible, setLogsVisible] = useState(true)
  const [settings, setSettings] = useState(COLUMNS.map((c) => ({ key: c.key, visible: true, width: 150 })))
  const [showSettings, setShowSettings] = useState(false)
  const fileInputRef = useRef(null)

  const log = (level, message) => {
    setLogs((entries) => [...entries, { id: `${Date.now()}-${Math.random()}`, time: new Date().toLocaleTimeString(), level, message }])
    setLogsVisible(true)
  }

  const fetchVideos = async () => {
    setLoadingVideos(true)
    setLoadError('')
    try {
      const res = await fetch('/api/excel/videos')
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || `Failed to load video list (HTTP ${res.status})`)
      setRows(Array.isArray(data.rows) ? data.rows : [])
    } catch (err) {
      setLoadError(err.message || 'Failed to load video list')
    } finally {
      setLoadingVideos(false)
    }
  }

  useEffect(() => {
    fetchVideos()
    fetch('/api/excel/videos/settings').then((r) => r.json()).then((s) => setSettings(s.map((v) => ({ ...v, visible: !!v.visible }))))
  }, [])

  const updateSettings = async (next) => {
    setSettings(next)
    await fetch('/api/excel/videos/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) })
  }
  const scrapeRow = async (row) => {
    setScrapingId(row.id)
    try {
      const res = await fetch(`/api/excel/videos/${row.id}/scrape`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || '抓取失败')
      setRows((current) => current.map((item) => item.id === row.id ? data : item))
      log('success', `抓取完成：${row.videoId}`)
    } catch (err) { log('error', `抓取失败：${err.message}`) } finally { setScrapingId(null) }
  }

  const copyVideoId = async (videoId) => {
    try {
      await navigator.clipboard.writeText(String(videoId))
      setCopiedVideoId(videoId)
      window.setTimeout(() => setCopiedVideoId(null), 1500)
    } catch {
      log('error', '复制失败：浏览器未提供剪贴板权限')
    }
  }

  const handleImportButtonClick = () => {
    fileInputRef.current?.click()
  }

  const handleClearAll = async () => {
    if (rows.length === 0) return
    if (!window.confirm('确定要清空所有视频记录吗？此操作无法撤销。')) return

    setClearing(true)
    try {
      const res = await fetch('/api/excel/videos', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || `Clear failed (HTTP ${res.status})`)
      setRows([])
      log('success', '已清空所有视频记录')
    } catch (err) {
      log('error', `清空失败：${err.message || 'Unknown error'}`)
    } finally {
      setClearing(false)
    }
  }

  const handleRemoveRow = async (id) => {
    setRemovingId(id)
    try {
      const res = await fetch(`/api/excel/videos/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || `Remove failed (HTTP ${res.status})`)
      setRows((current) => current.filter((row) => row.id !== id))
    } catch (err) {
      log('error', `移除失败：${err.message || 'Unknown error'}`)
    } finally {
      setRemovingId(null)
    }
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploading(true)
    log('info', `Importing file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`)
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 60_000)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/excel/import', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })
      let data
      try { data = await res.json() } catch { throw new Error(`Server returned an unreadable response (HTTP ${res.status})`) }
      if (!res.ok) {
        throw new Error(data.message || data.error || `Upload failed (HTTP ${res.status})`)
      }
      if (!Array.isArray(data.rows)) throw new Error('Server response is missing valid rows data')
      log('success', `Import successful: ${data.rows.length} records loaded`)
      await fetchVideos()
    } catch (err) {
      log('error', err.name === 'AbortError' ? 'Import timed out: server response exceeded 60 seconds. Please try again.' : `Import failed: ${err.message || 'Unknown error'}`)
    } finally {
      window.clearTimeout(timeoutId)
      setUploading(false)
    }
  }

  return (
    <section style={{ width: '100%', padding: '32px 20px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="counter" onClick={() => setShowSettings((v) => !v)}>字段设置</button>
        <button type="button" className="counter" onClick={handleClearAll} disabled={clearing || uploading || rows.length === 0}>
          {clearing ? 'Clearing…' : '清空表格'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <button type="button" className="counter" onClick={handleImportButtonClick} disabled={uploading}>
          {uploading ? 'Importing…' : 'Excel 导入'}
        </button>
      </div>
      {showSettings && <div style={{ padding: 12, border: '1px solid var(--border)', marginTop: 12 }}>{COLUMNS.map((c) => { const setting = settings.find((s) => s.key === c.key) || { visible: true, width: 150 }; return <label key={c.key} style={{ marginRight: 16 }}>{c.label} <input type="checkbox" checked={setting.visible} onChange={(e) => updateSettings(settings.map((s) => s.key === c.key ? { ...s, visible: e.target.checked } : s))} /> <input aria-label={`${c.label}宽度`} type="number" min="60" max="800" value={setting.width} style={{ width: 70 }} onChange={(e) => updateSettings(settings.map((s) => s.key === c.key ? { ...s, width: Number(e.target.value) } : s))} /></label> })}</div>}

      {logs.length > 0 && logsVisible && <ExcelImportLog logs={logs} onClose={() => setLogsVisible(false)} />}

      <p style={{ textAlign: 'left', marginTop: 16 }}>
        共 {rows.length} 条记录
      </p>

      {loadingVideos ? (
        <p style={{ textAlign: 'left' }}>Loading…</p>
      ) : loadError ? (
        <p style={{ textAlign: 'left', color: '#c0392b' }}>{loadError}</p>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left' }}>
            <thead>
              <tr>
                {COLUMNS.filter((col) => settings.find((s) => s.key === col.key)?.visible !== false).map((col) => (
                  <th
                    key={col.key}
                    style={{
                      borderBottom: '2px solid var(--border)',
                      padding: 0,
                      color: 'var(--text-h)',
                    }}
                  >
                    <div
                      style={{
                        resize: 'horizontal',
                        overflow: 'auto',
                        minWidth: 60,
                        maxWidth: 600,
                        width: settings.find((s) => s.key === col.key)?.width || 150,
                        boxSizing: 'border-box',
                        padding: '8px 12px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col.label}
                    </div>
                  </th>
                ))}
                <th
                  style={{
                    borderBottom: '2px solid var(--border)',
                    padding: '8px 12px',
                    whiteSpace: 'nowrap',
                    color: 'var(--text-h)',
                    position: 'sticky',
                    right: 0,
                    zIndex: 2,
                    background: 'var(--bg)',
                    boxShadow: '-8px 0 8px -8px rgba(0, 0, 0, 0.35)',
                  }}
                >
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.id ?? row.videoId ?? index}-${index}`}>
                  {COLUMNS.filter((col) => settings.find((s) => s.key === col.key)?.visible !== false).map((col) => (
                    <td
                      key={col.key}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        padding: '8px 12px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: col.key === 'videoInfo' ? 'normal' : 'nowrap',
                      }}
                    >
                      {col.key === 'videoId' && row.videoId ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <a href={`https://www.tiktok.com/@_/video/${encodeURIComponent(row.videoId)}`} target="_blank" rel="noreferrer">
                            {row.videoId}
                          </a>
                          <button type="button" className="counter" onClick={() => copyVideoId(row.videoId)} aria-label={`复制视频ID ${row.videoId}`}>
                            {copiedVideoId === row.videoId ? '已复制' : '复制'}
                          </button>
                        </span>
                      ) : row[col.key] || ''}
                    </td>
                  ))}
                  <td
                    style={{
                      borderBottom: '1px solid var(--border)',
                      padding: '8px 12px',
                      whiteSpace: 'nowrap',
                      position: 'sticky',
                      right: 0,
                      zIndex: 1,
                      background: 'var(--bg)',
                      boxShadow: '-8px 0 8px -8px rgba(0, 0, 0, 0.2)',
                    }}
                  >
                    <button
                      type="button" className="counter" onClick={() => scrapeRow(row)} disabled={scrapingId === row.id}
                    >{scrapingId === row.id ? '抓取中…' : '抓取'}</button>{' '}
                    <button
                      type="button"
                      className="counter"
                      onClick={() => handleRemoveRow(row.id)}
                      disabled={removingId === row.id}
                    >
                      {removingId === row.id ? 'Removing…' : '移除'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function ExcelImportLog({ logs, onClose }) {
  const colors = { info: 'var(--text)', success: '#2e7d32', error: '#c0392b' }
  const [copied, setCopied] = useState(false)

  const copyLogs = async () => {
    const text = logs.map((entry) => `[${entry.time}] [${entry.level}] ${entry.message}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore clipboard permission failures */
    }
  }

  return (
    <section aria-live="polite" style={{ marginTop: 16, textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '8px 0' }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>日志</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="counter" onClick={copyLogs}>{copied ? '已复制' : '复制'}</button>
          <button type="button" className="counter" onClick={onClose}>关闭</button>
        </div>
      </div>
      <ul style={{ margin: 0, padding: '10px 12px 10px 36px', border: '1px solid var(--border)', borderRadius: 8 }}>
        {logs.map((entry) => <li key={entry.id} style={{ color: colors[entry.level], margin: '4px 0' }}><time>{entry.time}</time>　{entry.message}</li>)}
      </ul>
    </section>
  )
}

export default VideoManagementPage
