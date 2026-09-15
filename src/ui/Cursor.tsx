import { useEffect, useRef } from 'react'
import { useStore } from '../state/store'

/**
 * A ring that trails the pointer and changes state without ever announcing
 * itself: a dot at rest, a wider ring where the product can be turned, a
 * tightened ring while it is being turned. Hidden entirely on touch, where a
 * fake cursor is nonsense.
 */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const mode = useStore((s) => s.cursor)

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return

    const p = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const r = { ...p }
    let raf = 0
    let visible = false

    const onMove = (e: PointerEvent) => {
      p.x = e.clientX
      p.y = e.clientY
      if (!visible) {
        visible = true
        r.x = p.x
        r.y = p.y
        if (dot.current) dot.current.style.opacity = '1'
        if (ring.current) ring.current.style.opacity = '1'
      }
    }
    const onLeave = () => {
      visible = false
      if (dot.current) dot.current.style.opacity = '0'
      if (ring.current) ring.current.style.opacity = '0'
    }

    const tick = () => {
      // the ring lags the dot; that lag is the whole character of it
      r.x += (p.x - r.x) * 0.11
      r.y += (p.y - r.y) * 0.11
      if (dot.current) dot.current.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`
      if (ring.current) ring.current.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    window.addEventListener('pointermove', onMove)
    document.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <div className="cursor" data-mode={mode} aria-hidden="true">
      <div className="cursor__ring" ref={ring} />
      <div className="cursor__dot" ref={dot} />
    </div>
  )
}
