import { useEffect, useRef } from 'react'
import { useStore } from '../state/store'

/**
 * A ring that trails the pointer and changes state without ever announcing
 * itself: a dot at rest, a wider ring where the product can be turned, a
 * tightened ring while it is being turned. Hidden entirely on touch, where a
 * fake cursor is nonsense.
 *
 * Two things it also has to get right, because a custom cursor that gets them
 * wrong is worse than no custom cursor at all:
 *
 * - It stands down over the written half. There the system pointer is back —
 *   a caret over text, a hand over a link — and drawing a second cursor on
 *   top of the real one is what makes the whole device read as decoration.
 * - It answers a press. Every button on the page takes a scale on :active;
 *   over the canvas there is no button to scale, so the ring does it instead.
 *   Same gesture, same answer, wherever the pointer happens to be.
 *
 * The store's mode and this component's reading of the DOM are kept as two
 * separate attributes and resolved in the stylesheet by source order, rather
 * than being combined here. Combining them in the render would mean a hover
 * that only took effect the next time the store happened to change.
 */

/** Anything the pointer can act on, including over the canvas. */
const INTERACTIVE = 'a, button, summary, label, input, select, textarea, [role="button"]'

export function Cursor() {
  const root = useRef<HTMLDivElement>(null)
  const dot = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const mode = useStore((s) => s.cursor)

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return

    const p = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const r = { ...p }
    let raf = 0
    let visible = false
    let overPages = false
    let overLink = false
    // A trail is movement for its own sake. Someone who has asked for less of
    // it gets a ring that is simply where the pointer is.
    const lerp = useStore.getState().reducedMotion ? 1 : 0.11

    const show = (on: boolean) => {
      visible = on
      const o = on ? '1' : '0'
      if (dot.current) dot.current.style.opacity = o
      if (ring.current) ring.current.style.opacity = o
    }

    /** Set or remove a flag, and only when it has actually changed. */
    const flag = (name: string, on: boolean) => {
      const node = root.current
      if (!node) return
      if (on) node.dataset[name] = 'true'
      else delete node.dataset[name]
    }

    const onMove = (e: PointerEvent) => {
      p.x = e.clientX
      p.y = e.clientY
      if (!visible) {
        r.x = p.x
        r.y = p.y
        show(true)
      }

      // `e.target` is already the element under the pointer, so reading the
      // context costs one closest() per move rather than a hit test.
      const el = e.target as Element | null
      if (!el?.closest) return

      const pages = Boolean(el.closest('.pages'))
      if (pages !== overPages) {
        overPages = pages
        flag('over', pages)
      }

      const link = Boolean(el.closest(INTERACTIVE))
      if (link !== overLink) {
        overLink = link
        flag('link', link)
      }
    }

    const onLeave = () => show(false)
    const onDown = () => flag('press', true)
    const onUp = () => flag('press', false)

    const tick = () => {
      // the ring lags the dot; that lag is the whole character of it
      r.x += (p.x - r.x) * lerp
      r.y += (p.y - r.y) * lerp
      if (dot.current) dot.current.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`
      if (ring.current) ring.current.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    document.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <div className="cursor" ref={root} data-mode={mode} aria-hidden="true">
      <div className="cursor__ring" ref={ring} />
      <div className="cursor__dot" ref={dot} />
    </div>
  )
}
