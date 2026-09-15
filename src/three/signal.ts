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
 * The opening beat: a couple of seconds before the scroll timeline is the
 * thing in charge. Written once a frame by the rig — the only thing driving
 * the camera — and read by the studio for the matching light fade-in, so the
 * two halves of the reveal share one clock instead of drifting apart.
 */
export const INTRO_SECONDS = 2.3
/** When, in the intro, the case gets its one press — after the reveal has
 * mostly settled, before scroll is expected to have started. */
const PRESS_AT = 1.7
const PRESS_HALF = 0.16
export const intro = { ease: 1, press: 0 }

function smoothstep(t: number) {
  return t * t * (3 - 2 * t)
}

/** A short symmetric rise-and-fall, 0 → 1 → 0, centred on `center`. */
function bump(elapsed: number, center: number, half: number) {
  const d = Math.abs(elapsed - center)
  if (d > half) return 0
  return smoothstep(1 - d / half)
}

let pressOverride: number | null = null

/** `elapsed` is time since the canvas mounted; `skip` is reduced-motion. */
export function updateIntro(elapsed: number, skip: boolean) {
  intro.ease = skip ? 1 : smoothstep(Math.min(1, elapsed / INTRO_SECONDS))
  intro.press = pressOverride ?? (skip ? 0 : bump(elapsed, PRESS_AT, PRESS_HALF))
}

if (import.meta.env.DEV) {
  ;(window as unknown as { forcePress: (v: number | null) => void }).forcePress = (v) => {
    pressOverride = v
  }
}

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
  Object.assign(window, { introSignal: intro })
}
