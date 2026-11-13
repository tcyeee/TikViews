const RETRY_DELAY_MS = 2000

let queue = []
let retried = false

function flush() {
  if (typeof window === 'undefined' || !window.goatcounter?.count) return
  if (queue.length === 0) return
  const pending = queue
  queue = []
  for (const hit of pending) {
    try {
      window.goatcounter.count(hit)
    } catch {
      // best-effort: dashboard unreachable or blocked, drop silently
    }
  }
}

/**
 * Best-effort analytics event. Never throws: silently no-ops when the
 * GoatCounter script is blocked (ad blocker) or still loading. Events fired
 * before the async script is ready are queued and retried once after
 * RETRY_DELAY_MS, then dropped so they don't pile up.
 */
export function track(path, title) {
  if (typeof window === 'undefined') return
  try {
    if (window.goatcounter?.count) {
      window.goatcounter.count({ path, title, event: true })
      return
    }
    queue.push({ path, title, event: true })
    if (!retried) {
      retried = true
      window.setTimeout(() => {
        flush()
        queue = []
        retried = false
      }, RETRY_DELAY_MS)
    }
  } catch {
    // best-effort: never let analytics break the app
  }
}
