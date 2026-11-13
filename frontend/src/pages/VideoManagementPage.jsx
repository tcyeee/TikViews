import { useEffect, useRef, useState } from 'react'

const COLUMNS = [
  { key: 'authorNickname', label: '达人昵称' },
  { key: 'authorId', label: '达人ID' },
  { key: 'videoInfo', label: '视频信息' },
  { key: 'videoId', label: '视频ID' },
  { key: 'publishTime', label: '发布时间' },
  { key: 'vv', label: 'VV' },
]

function VideoManagementPage() {
  const [rows, setRows] = useState([])
  const [loadingVideos, setLoadingVideos] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [logs, setLogs] = useState([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const log = (level, message) =>
    setLogs((entries) => [...entries, { id: `${Date.now()}-${Math.random()}`, time: new Date().toLocaleTimeString(), level, message }])

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
  }, [])

  const handleImportButtonClick = () => {
    fileInputRef.current?.click()
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
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>视频管理</h1>
        <div>
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
      </div>

      {logs.length > 0 && <ExcelImportLog logs={logs} />}

      <p style={{ textAlign: 'left', marginTop: 16 }}>
        共 {rows.length} 条记录
      </p>

      {loadingVideos ? (
        <p style={{ textAlign: 'left' }}>Loading…</p>
      ) : loadError ? (
        <p style={{ textAlign: 'left', color: '#c0392b' }}>{loadError}</p>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    style={{
                      borderBottom: '2px solid var(--border)',
                      padding: '8px 12px',
                      whiteSpace: 'nowrap',
                      color: 'var(--text-h)',
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.videoId || index}-${index}`}>
                  {COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        padding: '8px 12px',
                        whiteSpace: col.key === 'videoInfo' ? 'normal' : 'nowrap',
                      }}
                    >
                      {row[col.key] || ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function ExcelImportLog({ logs }) {
  const colors = { info: 'var(--text)', success: '#2e7d32', error: '#c0392b' }
  return (
    <section aria-live="polite" style={{ marginTop: 16, textAlign: 'left' }}>
      <h2 style={{ margin: '8px 0', fontSize: 16 }}>Excel 导入日志</h2>
      <ul style={{ margin: 0, padding: '10px 12px 10px 36px', border: '1px solid var(--border)', borderRadius: 8 }}>
        {logs.map((entry) => <li key={entry.id} style={{ color: colors[entry.level], margin: '4px 0' }}><time>{entry.time}</time>　{entry.message}</li>)}
      </ul>
    </section>
  )
}

export default VideoManagementPage
