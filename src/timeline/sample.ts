import { FRAMES } from './script'
import type { Caption, Ease, Frame, V3 } from './types'

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

const EASES: Record<Ease, (t: number) => number> = {
  linear: (t) => t,
  inOut: (t) => t * t * (3 - 2 * t),
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
}

/**
 * Uniform Catmull-Rom. Camera position and look-at run through this so the
 * path stays C1 continuous across key boundaries — no visible corner where
 * one move hands over to the next.
 */
function spline(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t
  const t3 = t2 * t
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  )
}

function splineV3(a: V3, b: V3, c: V3, d: V3, t: number, out: V3): V3 {
  out[0] = spline(a[0], b[0], c[0], d[0], t)
  out[1] = spline(a[1], b[1], c[1], d[1], t)
  out[2] = spline(a[2], b[2], c[2], d[2], t)
  return out
}

function lerpV3(a: V3, b: V3, t: number, out: V3): V3 {
  out[0] = a[0] + (b[0] - a[0]) * t
  out[1] = a[1] + (b[1] - a[1]) * t
  out[2] = a[2] + (b[2] - a[2]) * t
  return out
}

const at = (i: number) => FRAMES[Math.max(0, Math.min(FRAMES.length - 1, i))]

/**
 * The caption track, derived once.
 *
 * Captions carry forward in the score, so consecutive keys usually share one.
 * Collapsing them into spans means the text can simply hold: it appears at the
 * start of its passage, stays at full opacity throughout, and dissolves only
 * as the next one takes over.
 */
interface Stop {
  at: number
  until: number
  caption?: Caption | null
}

/**
 * How much of the whole timeline one caption handover occupies.
 *
 * Small on purpose. With twenty captions, every 0.001 here costs 4% of the
 * piece spent mid-fade — at 0.013 half the timeline was a dissolve, which is
 * the opposite of letting text sit and be read.
 */
const DISSOLVE = 0.006

const STOPS: Stop[] = (() => {
  const out: Stop[] = []
  for (let i = 0; i < FRAMES.length; i++) {
    const c = FRAMES[i].caption
    if (i === 0 || c !== FRAMES[i - 1].caption) {
      out.push({ at: FRAMES[i].at, until: 1, caption: c })
    }
  }
  for (let i = 0; i < out.length - 1; i++) out[i].until = out[i + 1].at
  return out
})()

function stopAt(p: number): Stop {
  let lo = 0
  let hi = STOPS.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (STOPS[mid].at <= p) lo = mid
    else hi = mid - 1
  }
  return STOPS[lo]
}

export interface Sampled extends Omit<Frame, 'at' | 'ease' | 'caption'> {
  /** Index of the key that owns the current moment. */
  index: number
  /** Progress inside that key's segment, 0 → 1. */
  local: number
  caption?: Caption | null
  captionFade: number
}

const scratch: Sampled = {
  ...(FRAMES[0] as unknown as Sampled),
  index: 0,
  local: 0,
  captionFade: 0,
  cam: [0, 0, 0],
  look: [0, 0, 0],
  casePos: [0, 0, 0],
  caseRot: [0, 0, 0],
  podPos: [0, 0, 0],
  podRot: [0, 0, 0],
}

const NUM_KEYS = [
  'fov',
  'roll',
  'lid',
  'caseXray',
  'caseInsert',
  'podsOut',
  'podSpread',
  'solo',
  'explode',
  'xray',
  'clip',
  'spin',
  'fxSound',
  'fxMic',
  'fxData',
  'fxEnergy',
  'exposure',
  'rim',
  'lightAngle',
  'ground',
] as const

/**
 * Read the whole scene state at scroll position `t` (0 → 1).
 * Returns a shared object — copy anything you need to keep.
 */
export function sample(t: number): Sampled {
  const p = clamp01(t)
  let i = 0
  while (i < FRAMES.length - 2 && FRAMES[i + 1].at <= p) i++

  const a = FRAMES[i]
  const b = FRAMES[i + 1] ?? a
  const span = Math.max(1e-6, b.at - a.at)
  const raw = clamp01((p - a.at) / span)
  const u = EASES[b.ease ?? 'inOut'](raw)

  scratch.index = i
  scratch.local = raw

  splineV3(at(i - 1).cam, a.cam, b.cam, at(i + 2).cam, u, scratch.cam)
  splineV3(at(i - 1).look, a.look, b.look, at(i + 2).look, u, scratch.look)
  lerpV3(a.casePos, b.casePos, u, scratch.casePos)
  lerpV3(a.caseRot, b.caseRot, u, scratch.caseRot)
  lerpV3(a.podPos, b.podPos, u, scratch.podPos)
  lerpV3(a.podRot, b.podRot, u, scratch.podRot)

  for (const k of NUM_KEYS) {
    scratch[k] = a[k] + (b[k] - a[k]) * u
  }

  scratch.interactive = raw < 0.5 ? a.interactive : b.interactive

  // A caption holds for its whole passage and dissolves only at the handover
  // to the next one, so text is readable for as long as the passage lasts
  // rather than for the middle of a single shot.
  const stop = stopAt(p)
  scratch.caption = stop.caption
  // The opening and closing lines are already on screen at the ends of the
  // track, so they are not faded in from nothing or out to nothing.
  const rise = stop.at <= 0 ? 1 : (p - stop.at) / DISSOLVE
  const fall = stop.until >= 1 ? 1 : (stop.until - p) / DISSOLVE
  scratch.captionFade = stop.caption
    ? EASES.inOut(clamp01(Math.min(rise, fall)))
    : 0

  return scratch
}

/** Index of the current chapter, for the readout in the corner. */
export const TOTAL_KEYS = FRAMES.length
