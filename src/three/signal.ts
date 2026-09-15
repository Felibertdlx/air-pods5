import { sample, type Sampled } from '../timeline/sample'

/**
 * One sampled frame of the score per animation frame, shared by every scene
 * component. The alternative — each component sampling for itself, or state
 * going through React — would either duplicate work or re-render the tree
 * sixty times a second.
 */

let current: Sampled = sample(0)

/** Smoothed scroll position. Scroll is discrete; the camera must not be. */
export const clock = {
  /** Raw progress written by the scroll driver, 0 → 1. */
  target: 0,
  /** Critically damped follower — this is what the film actually plays at. */
  t: 0,
  /** d(t)/d(frame), used for motion-reactive effects. */
  velocity: 0,
  elapsed: 0,
}

let snapNext = false

/**
 * Cut, don't travel.
 *
 * Jumping the scrollbar — replaying from the start, or following a section
 * link — moves the timeline by most of its length at once. Left to damp, the
 * camera would fly through every shot in a second and a half, which reads as
 * a glitch rather than as a jump. This lands the follower on the new position
 * in one frame instead.
 */
export function requestSnap() {
  snapNext = true
}

export function advance(dt: number, damping: number) {
  const before = clock.t
  if (snapNext) {
    snapNext = false
    clock.t = clock.target
  } else {
    // frame-rate independent exponential approach
    const k = 1 - Math.pow(damping, dt * 60)
    clock.t += (clock.target - clock.t) * k
  }
  clock.velocity = (clock.t - before) / Math.max(dt, 1e-4)
  clock.elapsed += dt
  current = sample(clock.t)
  return current
}

export function read(): Sampled {
  return current
}

if (import.meta.env.DEV) {
  // Snap the follower when a shot is seeked to, so screenshots show the shot
  // itself rather than the camera still travelling towards it.
  ;(window as unknown as { snap: () => void }).snap = () => {
    clock.t = clock.target
  }
}
