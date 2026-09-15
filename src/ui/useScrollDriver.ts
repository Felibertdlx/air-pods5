import Lenis from 'lenis'
import { useEffect } from 'react'
import { scroll, useStore } from '../state/store'
import { requestSnap } from '../three/signal'

/**
 * Scroll is the transport for the whole film, so it gets smoothed once, here,
 * and written to a plain object. Nothing reads it through React.
 *
 * The document is in two halves: a tall, empty track that the 3D timeline is
 * mapped onto, and the written sections that follow it. Progress is measured
 * against the track alone, so adding or editing a section below never shifts
 * a single camera move.
 */

/**
 * Jump to a document position. Set by the driver once it is up.
 *
 * Always a cut, never a glide: the timeline is mapped onto twenty-odd
 * thousand pixels of track, so animating the scrollbar from the end back to
 * the start would replay the entire film backwards at speed.
 */
export const goTo = {
  to: (_y: number) => {},
}

function trackEnd() {
  const track = document.getElementById('track')
  const h = track?.offsetHeight ?? document.documentElement.scrollHeight
  return Math.max(1, h - window.innerHeight)
}

export function useScrollDriver() {
  const reduced = useStore((s) => s.reducedMotion)
  const setCanvasLive = useStore((s) => s.setCanvasLive)

  useEffect(() => {
    let pinned: number | null = null

    const update = () => {
      if (pinned !== null) {
        scroll.t = pinned
        return
      }
      const end = trackEnd()
      const y = window.scrollY
      scroll.t = Math.min(1, Math.max(0, y / end))
      // Once the sections have covered the canvas there is nothing to draw.
      setCanvasLive(y < end + window.innerHeight * 0.9)
    }

    if (import.meta.env.DEV) {
      // Hold the timeline at one point without moving the scrollbar, so a
      // shot can be inspected with the page still at the top.
      ;(window as unknown as { hold: (t: number | null) => void }).hold = (t) => {
        pinned = t === null ? null : Math.min(1, Math.max(0, t))
      }
    }

    if (reduced) {
      // No inertia for anyone who has asked for less motion — the timeline
      // still plays, it just tracks the scrollbar exactly.
      goTo.to = (y) => {
        window.scrollTo({ top: y, behavior: 'auto' })
        update()
        requestSnap()
      }
      window.addEventListener('scroll', update, { passive: true })
      window.addEventListener('resize', update)
      update()
      return () => {
        window.removeEventListener('scroll', update)
        window.removeEventListener('resize', update)
      }
    }

    const lenis = new Lenis({
      duration: 1.75,
      // a long, shallow ease-out: the weight that makes it feel like film
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      // Under 1: one wheel notch advances less of the timeline, so a shot
      // cannot be skipped past with a single flick. Combined with the longer
      // track this makes the piece about twice as long as it was — slower to
      // watch, without becoming a chore to get through.
      wheelMultiplier: 0.8,
      touchMultiplier: 1.15,
      syncTouch: true,
    })

    // The snap has to wait for the scroll to actually move. Lenis applies an
    // immediate scrollTo on its next raf, so snapping in the same tick would
    // pin the follower to the position we are leaving — and the camera would
    // then sweep the whole way there, which is the glitch this exists to stop.
    let snapFrames = 0
    goTo.to = (y) => {
      lenis.scrollTo(y, { immediate: true })
      snapFrames = 2
    }

    let raf = 0
    const frame = (time: number) => {
      lenis.raf(time)
      update()
      if (snapFrames > 0) {
        snapFrames--
        requestSnap()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    window.addEventListener('resize', update)

    if (import.meta.env.DEV) {
      ;(window as unknown as { seek: (t: number) => void }).seek = (t) =>
        lenis.scrollTo(Math.min(1, Math.max(0, t)) * trackEnd(), { immediate: true })
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', update)
      lenis.destroy()
      goTo.to = () => {}
    }
  }, [reduced, setCanvasLive])
}
