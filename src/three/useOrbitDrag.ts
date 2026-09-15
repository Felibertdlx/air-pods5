import { useEffect, useMemo } from 'react'
import { useStore } from '../state/store'
import { read } from './signal'

export interface Orbit {
  az: number
  pol: number
  dolly: number
}

/**
 * Drag to turn, wheel or pinch to move closer.
 *
 * The offsets sit on top of the scripted camera rather than replacing it, and
 * they ease back to zero when let go — so the viewer can always look around
 * without ever being able to strand themselves somewhere the film cannot
 * recover from. Scroll is never captured, so the page never traps you.
 */
export function useOrbitDrag(): Orbit {
  const setCursor = useStore((s) => s.setCursor)
  const orbit = useMemo<Orbit>(() => ({ az: 0, pol: 0, dolly: 1 }), [])

  useEffect(() => {
    const goal = { az: 0, pol: 0, dolly: 1 }
    let dragging = false
    let lastX = 0
    let lastY = 0
    let raf = 0
    let pinchStart = 0

    const interactive = () => read().interactive === true

    const onDown = (e: PointerEvent) => {
      if (!interactive() || e.button !== 0) return
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      setCursor('dragging')
    }

    const onMove = (e: PointerEvent) => {
      if (!dragging) {
        if (interactive()) setCursor('drag')
        else setCursor('idle')
        return
      }
      const w = Math.max(window.innerWidth, 600)
      goal.az -= ((e.clientX - lastX) / w) * 4.2
      goal.pol += ((e.clientY - lastY) / w) * 3.0
      goal.pol = Math.max(-0.5, Math.min(0.5, goal.pol))
      lastX = e.clientX
      lastY = e.clientY
    }

    const onUp = () => {
      dragging = false
      setCursor(interactive() ? 'drag' : 'idle')
    }

    const onWheel = (e: WheelEvent) => {
      if (!interactive()) return
      // Only take the gesture when it is clearly a zoom; otherwise the page
      // must keep scrolling, because scroll is the timeline.
      if (!e.ctrlKey) return
      e.preventDefault()
      goal.dolly = Math.max(0.45, Math.min(1.6, goal.dolly + e.deltaY * 0.0015))
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchStart = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        )
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !interactive() || !pinchStart) return
      e.preventDefault()
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      )
      goal.dolly = Math.max(0.45, Math.min(1.6, goal.dolly * (pinchStart / d)))
      pinchStart = d
    }

    const tick = () => {
      const free = interactive()
      // Outside an interactive moment the offsets unwind, so the scripted
      // framing is always exactly what the next shot was composed for.
      if (!free) {
        goal.az *= 0.94
        goal.pol *= 0.94
        goal.dolly += (1 - goal.dolly) * 0.06
      } else if (!dragging) {
        goal.az *= 0.995
        goal.pol *= 0.985
      }
      orbit.az += (goal.az - orbit.az) * 0.065
      orbit.pol += (goal.pol - orbit.pol) * 0.065
      orbit.dolly += (goal.dolly - orbit.dolly) * 0.06
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
    }
  }, [orbit, setCursor])

  return orbit
}
