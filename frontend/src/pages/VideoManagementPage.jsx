import { useEffect, useRef, useState } from 'react'
import { CheckIcon, CopyIcon, XIcon } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Pagination,
  PaginationContent,
  PaginationFirst,
  PaginationItem,
  PaginationLast,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { useMessages } from '@/lib/MessageContext.jsx'
import { cn } from '@/lib/utils'
import { track } from '@/lib/analytics.js'

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

// 已下架/私密/已删除是 yt-dlp 确认过的内容状态，视为批量抓取中的正常终态，
// 不应被当作系统性故障计入连续失败熔断计数
const CONTENT_TERMINAL_STATUSES = new Set(['已下架', '私密', '已删除'])

const SCRAPE_STATUS_VARIANTS = {
  未抓取: 'secondary',
  已抓取: 'success',
  已下架: 'warning',
  私密: 'outline',
  已删除: 'outline',
  抓取失败: 'destructive',
}

const SCRAPE_STATUS_CLASS = {
  私密: 'border-violet-200 text-violet-700 dark:border-violet-900 dark:text-violet-400',
  已删除: 'text-muted-foreground',
}

function ScrapeStatusBadge({ status }) {
  const label = status || '未抓取'
  const variant = SCRAPE_STATUS_VARIANTS[label] || 'secondary'
  return (
    <Badge variant={variant} className={cn('rounded-full', SCRAPE_STATUS_CLASS[label])}>
      {label}
    </Badge>
  )
}

const EMPTY_FILTERS = { authorNickname: '', authorId: '', videoId: '', scrapeStatus: '' }
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

// 批量抓取请求之间的随机间隔，避免短时间内高频请求触发 TikTok 对本服务器 IP 的限流
const BATCH_SCRAPE_MIN_DELAY_MS = 2000
const BATCH_SCRAPE_MAX_DELAY_MS = 5000

function randomBatchDelay() {
  return BATCH_SCRAPE_MIN_DELAY_MS + Math.random() * (BATCH_SCRAPE_MAX_DELAY_MS - BATCH_SCRAPE_MIN_DELAY_MS)
}

// 分段 sleep，以便停止按钮能在等待期间及时生效，而不用等到下一条抓取完成
async function interruptibleSleep(ms, stopRef) {
  const step = 200
  let waited = 0
  while (waited < ms) {
    if (stopRef.current) return
    await new Promise((resolve) => window.setTimeout(resolve, Math.min(step, ms - waited)))
    waited += step
  }
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`
}

function VideoManagementPage() {
  const { pushMessage } = useMessages()
  const [rows, setRows] = useState([])
  const [loadingVideos, setLoadingVideos] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [scrapingId, setScrapingId] = useState(null)
  const [batchScraping, setBatchScraping] = useState(false)
  const batchStopRef = useRef(false)
  const [batchPanelOpen, setBatchPanelOpen] = useState(false)
  const [batchTotal, setBatchTotal] = useState(0)
  const [batchCompleted, setBatchCompleted] = useState(0)
  const [batchCurrentRow, setBatchCurrentRow] = useState(null)
  const [batchDone, setBatchDone] = useState(false)
  const [batchStartedAt, setBatchStartedAt] = useState(null)
  const [batchElapsedMs, setBatchElapsedMs] = useState(0)
  const [copiedVideoId, setCopiedVideoId] = useState(null)
  const [settings, setSettings] = useState(COLUMNS.map((c) => ({ key: c.key, visible: true, width: 150 })))
  const [showSettings, setShowSettings] = useState(false)
  const fileInputRef = useRef(null)
  const [filterForm, setFilterForm] = useState(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const filteredRows = rows.filter((row) => {
    if (appliedFilters.authorNickname && !String(row.authorNickname || '').toLowerCase().includes(appliedFilters.authorNickname.toLowerCase())) return false
    if (appliedFilters.authorId && !String(row.authorId || '').toLowerCase().includes(appliedFilters.authorId.toLowerCase())) return false
    if (appliedFilters.videoId && !String(row.videoId || '').toLowerCase().includes(appliedFilters.videoId.toLowerCase())) return false
    if (appliedFilters.scrapeStatus && row.scrapeStatus !== appliedFilters.scrapeStatus) return false
    return true
  })
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleFilterSubmit = (e) => {
    e.preventDefault()
    setAppliedFilters(filterForm)
    setPage(1)
  }

  const handleFilterReset = () => {
    setFilterForm(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
    setPage(1)
  }

  const log = (level, message) => {
    pushMessage(level, message)
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

  useEffect(() => {
    if (!batchScraping || !batchStartedAt) return
    const timer = window.setInterval(() => {
      setBatchElapsedMs(Date.now() - batchStartedAt)
    }, 200)
    return () => window.clearInterval(timer)
  }, [batchScraping, batchStartedAt])

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
      setRows((current) => current.map((item) => item.id === row.id ? data.row : item))
      if (data.success) {
        log('success', `抓取完成：${row.videoId}`)
        return { success: true, blocked: false }
      }
      if (CONTENT_TERMINAL_STATUSES.has(data.row.scrapeStatus)) {
        // 视频已确认下架/私密/已删除，属于正常终态，不计入批量抓取的连续失败熔断
        log('warning', `${data.row.scrapeStatus}：${row.videoId}`)
        return { success: true, blocked: false }
      }
      if (data.blocked) {
        log('error', `服务器 IP 被 TikTok 临时限制：${row.videoId}${data.message ? `（${data.message}）` : ''}`)
        return { success: false, blocked: true }
      }
      log('error', `抓取失败：${row.videoId}${data.message ? `（${data.message}）` : ''}`)
      return { success: false, blocked: false }
    } catch (err) {
      log('error', `抓取失败：${err.message}`)
      return { success: false, blocked: false }
    } finally {
      setScrapingId(null)
    }
  }

  const MAX_CONSECUTIVE_FAILURES = 3

  const handleBatchScrapeClick = async () => {
    if (batchScraping) {
      batchStopRef.current = true
      log('info', '正在停止批量抓取…')
      return
    }
    if (rows.length === 0) return

    track('scrape/batch-start')
    const startedAt = Date.now()
    batchStopRef.current = false
    setBatchScraping(true)
    setBatchPanelOpen(true)
    setBatchDone(false)
    setBatchTotal(rows.length)
    setBatchCompleted(0)
    setBatchCurrentRow(null)
    setBatchStartedAt(startedAt)
    setBatchElapsedMs(0)
    log('info', `开始批量抓取，共 ${rows.length} 条`)
    let consecutiveFailures = 0
    try {
      for (const row of rows) {
        if (batchStopRef.current) {
          log('info', '批量抓取已停止')
          break
        }
        setBatchCurrentRow(row)
        const { success, blocked } = await scrapeRow(row)
        setBatchCompleted((c) => c + 1)
        if (blocked) {
          log('error', 'TikTok 已临时限制本服务器 IP 的访问，批量抓取已自动停止，请稍后再试')
          track('scrape/batch-blocked')
          break
        }
        if (success) {
          consecutiveFailures = 0
        } else {
          consecutiveFailures += 1
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            log('error', `连续抓取失败 ${MAX_CONSECUTIVE_FAILURES} 次，已自动停止批量抓取`)
            break
          }
        }
        if (batchStopRef.current) {
          log('info', '批量抓取已停止')
          break
        }
        await interruptibleSleep(randomBatchDelay(), batchStopRef)
      }
    } finally {
      setBatchScraping(false)
      batchStopRef.current = false
      setBatchCurrentRow(null)
      setBatchDone(true)
      setBatchElapsedMs(Date.now() - startedAt)
      track('scrape/batch-complete')
    }
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

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/excel/export')
      if (!res.ok) {
        let message = `Export failed (HTTP ${res.status})`
        try { message = (await res.json()).message || message } catch { /* response body wasn't JSON */ }
        throw new Error(message)
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename\*=UTF-8''([^;]+)/)
      const filename = match ? decodeURIComponent(match[1]) : `视频数据_${Date.now()}.xlsx`
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      log('success', `导出成功：${filename}`)
      track('excel/export')
    } catch (err) {
      log('error', `导出失败：${err.message || 'Unknown error'}`)
    } finally {
      setExporting(false)
    }
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
      track('excel/import')
      await fetchVideos()
    } catch (err) {
      log('error', err.name === 'AbortError' ? 'Import timed out: server response exceeded 60 seconds. Please try again.' : `Import failed: ${err.message || 'Unknown error'}`)
    } finally {
      window.clearTimeout(timeoutId)
      setUploading(false)
    }
  }

  return (
    <section className="w-full box-border px-5 py-8">
      <div className="flex items-baseline justify-end gap-3 flex-wrap">
        <Button type="button" variant="outline" size="sm" onClick={() => setShowSettings((v) => !v)}>
          字段设置
        </Button>
        <Button
          type="button"
          variant={batchScraping ? 'destructive' : 'default'}
          size="sm"
          onClick={handleBatchScrapeClick}
          disabled={clearing || uploading || (!batchScraping && rows.length === 0)}
        >
          {batchScraping ? '停止抓取' : '批量抓取'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={handleClearAll}
          disabled={clearing || uploading || batchScraping || rows.length === 0}
        >
          {clearing ? 'Clearing…' : '清空表格'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button type="button" variant="outline" size="sm" onClick={handleImportButtonClick} disabled={uploading || batchScraping}>
          {uploading ? 'Importing…' : 'Excel 导入'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleExport} disabled={exporting || batchScraping || rows.length === 0}>
          {exporting ? 'Exporting…' : 'Excel 导出'}
        </Button>
      </div>
      {showSettings && (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3 rounded-md border p-3">
          {COLUMNS.map((c) => {
            const setting = settings.find((s) => s.key === c.key) || { visible: true, width: 150 }
            return (
              <div key={c.key} className="flex items-center gap-2">
                <Checkbox
                  id={`col-${c.key}`}
                  checked={setting.visible}
                  onCheckedChange={(checked) =>
                    updateSettings(settings.map((s) => (s.key === c.key ? { ...s, visible: !!checked } : s)))
                  }
                />
                <Label htmlFor={`col-${c.key}`}>{c.label}</Label>
                <Input
                  aria-label={`${c.label}宽度`}
                  type="number"
                  min="60"
                  max="800"
                  value={setting.width}
                  className="h-8 w-[70px]"
                  onChange={(e) => updateSettings(settings.map((s) => (s.key === c.key ? { ...s, width: Number(e.target.value) } : s)))}
                />
              </div>
            )
          })}
        </div>
      )}

      <form onSubmit={handleFilterSubmit} className="mt-4 flex items-center gap-2.5 flex-wrap text-left">
        <Input
          type="text"
          placeholder="达人昵称"
          value={filterForm.authorNickname}
          onChange={(e) => setFilterForm((f) => ({ ...f, authorNickname: e.target.value }))}
          className="w-[160px]"
        />
        <Input
          type="text"
          placeholder="达人ID"
          value={filterForm.authorId}
          onChange={(e) => setFilterForm((f) => ({ ...f, authorId: e.target.value }))}
          className="w-[160px]"
        />
        <Input
          type="text"
          placeholder="视频ID"
          value={filterForm.videoId}
          onChange={(e) => setFilterForm((f) => ({ ...f, videoId: e.target.value }))}
          className="w-[160px]"
        />
        <Select
          value={filterForm.scrapeStatus || 'all'}
          onValueChange={(value) => setFilterForm((f) => ({ ...f, scrapeStatus: value === 'all' ? '' : value }))}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="未抓取">未抓取</SelectItem>
            <SelectItem value="已抓取">已抓取</SelectItem>
            <SelectItem value="已下架">已下架</SelectItem>
            <SelectItem value="私密">私密</SelectItem>
            <SelectItem value="已删除">已删除</SelectItem>
            <SelectItem value="抓取失败">抓取失败</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" size="sm">查询</Button>
        <Button type="button" variant="outline" size="sm" onClick={handleFilterReset}>重置</Button>
      </form>

      <p className="mt-4 text-left text-sm text-muted-foreground">
        共 {filteredRows.length} 条记录{filteredRows.length !== rows.length ? `（总 ${rows.length} 条）` : ''}
      </p>

      {loadingVideos ? (
        <p className="text-left text-sm text-muted-foreground">Loading…</p>
      ) : loadError ? (
        <p className="text-left text-sm text-destructive">{loadError}</p>
      ) : (
        <div className="mt-4 rounded-md border">
          {batchPanelOpen && (
            <div className="border-b bg-muted/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">
                  {batchDone ? '批量抓取已完成' : '批量抓取中…'}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => setBatchPanelOpen(false)}
                  aria-label="关闭批量抓取面板"
                >
                  <XIcon />
                </Button>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${batchTotal ? Math.min(100, (batchCompleted / batchTotal) * 100) : 0}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-sm text-muted-foreground flex-wrap">
                <span className="truncate">
                  {batchCompleted} / {batchTotal}
                  {!batchDone && batchCurrentRow
                    ? ` · 正在抓取：${batchCurrentRow.authorNickname || ''} ${batchCurrentRow.videoInfo || batchCurrentRow.videoId || ''}`
                    : ''}
                </span>
                <span className="shrink-0">
                  {batchDone ? `总耗时 ${formatDuration(batchElapsedMs)}` : `已用时 ${formatDuration(batchElapsedMs)}`}
                </span>
              </div>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                {COLUMNS.filter((col) => settings.find((s) => s.key === col.key)?.visible !== false).map((col) => (
                  <TableHead key={col.key} className="p-0 h-auto">
                    <div
                      style={{
                        resize: 'horizontal',
                        overflow: 'auto',
                        minWidth: 60,
                        maxWidth: 600,
                        width: settings.find((s) => s.key === col.key)?.width || 150,
                        boxSizing: 'border-box',
                      }}
                      className="px-3 py-2 whitespace-nowrap"
                    >
                      {col.label}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="sticky right-0 z-10 bg-background shadow-[-8px_0_8px_-8px_var(--border)]">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.map((row, index) => (
                <TableRow key={`${row.id ?? row.videoId ?? index}-${index}`}>
                  {COLUMNS.filter((col) => settings.find((s) => s.key === col.key)?.visible !== false).map((col) => (
                    <TableCell
                      key={col.key}
                      className={col.key === 'videoInfo' ? 'whitespace-normal overflow-hidden text-ellipsis' : 'overflow-hidden text-ellipsis'}
                    >
                      {col.key === 'videoId' && row.videoId ? (
                        <span className="inline-flex items-center gap-1">
                          <a
                            className="text-primary underline-offset-4 hover:underline"
                            href={`https://www.tiktok.com/@_/video/${encodeURIComponent(row.videoId)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {row.videoId}
                          </a>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            onClick={() => copyVideoId(row.videoId)}
                            aria-label={`复制视频ID ${row.videoId}`}
                          >
                            {copiedVideoId === row.videoId ? <CheckIcon className="text-green-600" /> : <CopyIcon />}
                          </Button>
                        </span>
                      ) : col.key === 'scrapeStatus' ? (
                        <ScrapeStatusBadge status={row.scrapeStatus} />
                      ) : row[col.key] || ''}
                    </TableCell>
                  ))}
                  <TableCell className="sticky right-0 z-[1] bg-background shadow-[-8px_0_8px_-8px_var(--border)]">
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => scrapeRow(row)}
                        disabled={scrapingId === row.id || batchScraping}
                      >
                        {scrapingId === row.id ? '抓取中…' : '抓取'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemoveRow(row.id)}
                        disabled={removingId === row.id || batchScraping}
                      >
                        {removingId === row.id ? 'Removing…' : '移除'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-end gap-3 flex-wrap px-1 py-3">
            <div className="flex items-center gap-2 text-sm">
              <span>每页</span>
              <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1) }}>
                <SelectTrigger size="sm" className="w-[76px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>条</span>
            </div>
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationFirst onClick={() => setPage(1)} disabled={currentPage <= 1} />
                </PaginationItem>
                <PaginationItem>
                  <PaginationPrevious onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} />
                </PaginationItem>
                <PaginationItem>
                  <span className="px-2 text-sm whitespace-nowrap">第 {currentPage} / {totalPages} 页</span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} />
                </PaginationItem>
                <PaginationItem>
                  <PaginationLast onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      )}
    </section>
  )
}

export default VideoManagementPage
