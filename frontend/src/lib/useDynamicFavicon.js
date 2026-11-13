import { useEffect } from 'react'

const SIZE = 32
const RING_RADIUS = 13
const DOT_RADIUS = 4
const MAX_OFFSET = 7
const EASE = 0.18

/**
 * Redraws the browser tab favicon on every frame so the inner dot
 * drifts toward the cursor's position within the viewport, inspired
 * by viii.me. Restores the original favicon on unmount.
 */
export function useDynamicFavicon(active = true) {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return

    const link = document.querySelector('link[rel="icon"]')
    const originalHref = link?.getAttribute('href')

    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    const ctx = canvas.getContext('2d')

    let target = { x: 0, y: 0 }
    let current = { x: 0, y: 0 }
    let running = true
    let raf = 0

    const handlePointerMove = (e) => {
      target = {
        x: ((e.clientX / window.innerWidth) * 2 - 1) * MAX_OFFSET,
        y: ((e.clientY / window.innerHeight) * 2 - 1) * MAX_OFFSET,
      }
    }
    const handlePointerLeave = () => {
      target = { x: 0, y: 0 }
    }

    const draw = () => {
      current.x += (target.x - current.x) * EASE
      current.y += (target.y - current.y) * EASE

      const cx = SIZE / 2
      const cy = SIZE / 2

      ctx.clearRect(0, 0, SIZE, SIZE)

      ctx.beginPath()
      ctx.arc(cx, cy, RING_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = '#faf8f4'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#2b2824'
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(cx + current.x, cy + current.y, DOT_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = '#2b2824'
      ctx.fill()

      link?.setAttribute('href', canvas.toDataURL('image/png'))

      if (running) raf = requestAnimationFrame(draw)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerleave', handlePointerLeave, { passive: true })
    raf = requestAnimationFrame(draw)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerleave', handlePointerLeave)
      if (link && originalHref) link.setAttribute('href', originalHref)
    }
  }, [active])
}
