import { Vector3 } from 'three'
import { POD } from '../three/anatomy'
import type { Frame, FrameInput, V3 } from './types'

/**
 * The film, written as a score.
 *
 * Every key is a moment; channels that are not mentioned hold their previous
 * value. Camera positions near the product are derived from the landmarks
 * measured on the real mesh, so a macro shot is aimed at the actual speaker
 * mesh rather than at a guessed coordinate.
 */

const v = (x: Vector3): V3 => [x.x, x.y, x.z]

/** A point `d` cm out from `p` along `dir`, optionally nudged. */
function off(p: Vector3, dir: Vector3, d: number, nudge?: V3): V3 {
  const r = p.clone().addScaledVector(dir, d)
  if (nudge) r.add(new Vector3(...nudge))
  return v(r)
}

const AX = POD.axis // outward normal of the speaker mesh
const UP = new Vector3(0, 1, 0)
/** In the speaker's plane, pointing roughly "up" across the inner face. */
const TAN = new Vector3().crossVectors(AX, UP).cross(AX).normalize()

export const DEFAULTS: Frame = {
  at: 0,
  ease: 'inOut',
  cam: [0, 0, 21],
  look: [0, 0, 0],
  fov: 24,
  roll: 0,
  casePos: [0, 0, 0],
  caseRot: [0, 0, 0],
  lid: 0,
  caseXray: 0,
  caseInsert: 1,
  podsOut: 0,
  podPos: [0, 0, 0],
  podRot: [0, 0, 0],
  podSpread: 1.15,
  solo: 0,
  explode: 0,
  xray: 0,
  clip: 0,
  spin: 0,
  fxSound: 0,
  fxMic: 0,
  fxData: 0,
  fxEnergy: 0,
  exposure: 1,
  rim: 1,
  lightAngle: 0,
  ground: 1,
}

/** Where the buds hover once they are out of the case. */
const AIR: V3 = [0, 2.5, 0]
/**
 * Where the case goes to get out of the way. Far enough below that it leaves
 * the frame quickly instead of drifting across it for several seconds — with
 * the camera this far back, anything half-in shot reads as a mistake.
 */
const AWAY: V3 = [0, -16, 0]

export const SCRIPT: FrameInput[] = [
  // ── 1. Reveal ───────────────────────────────────────────────────────────
  {
    at: 0.0,
    // Product low in the frame, type above it: the opening shot is mostly air.
    cam: [0, 1.15, 23],
    look: [0, 1.15, 0],
    fov: 23,
    exposure: 0.62,
    rim: 0.15,
    lightAngle: -1.15,
    ground: 0.35,
    caption: { id: 'hero', align: 'centre' },
  },
  {
    at: 0.035,
    cam: [3.0, 1.9, 20.6],
    look: [0, 0.75, 0],
    caseRot: [0, 0.42, 0],
    exposure: 1,
    rim: 1,
    lightAngle: -0.3,
    ground: 1,
  },
  {
    at: 0.072,
    cam: [6.2, 2.0, 16.2],
    look: [0, 0.1, 0],
    caseRot: [0, 1.05, 0],
    lightAngle: 0.35,
    caption: { id: 'surface' },
  },

  // ── 2. Approach ─────────────────────────────────────────────────────────
  {
    at: 0.108,
    cam: [4.6, 1.5, 13.0],
    look: [0, 0.15, 0],
    fov: 26,
    caseRot: [0, 1.9, 0],
    lightAngle: 0.8,
    caption: { id: 'form' },
  },
  {
    at: 0.142,
    cam: [0.9, 5.6, 11.0],
    look: [0, 0.9, 0],
    fov: 28,
    // Half a turn: the hinge is at the back of the case, so this is the only
    // moment in the piece where it faces the lens.
    caseRot: [0, 3.35, 0],
    caption: { id: 'hinge' },
  },

  // ── 3. The lid ──────────────────────────────────────────────────────────
  {
    // Steep enough to actually see down into the wells — the reveal has to
    // reveal something, and the case rim hides the buds from a low angle.
    at: 0.182,
    cam: [0.6, 7.6, 8.6],
    look: [0, 0.7, 0],
    fov: 30,
    lid: 1,
    // The turn completes, bringing the front back round: the lid hinges away
    // from the lens, which is the only way the open case shows its wells.
    caseRot: [0, 6.283185, 0],
    ground: 0.7,
    // Looking down at the lid presents the largest flat-ish area in the piece
    // straight at the key light, and it clips. Trimming the level for these
    // shots specifically keeps the gradient on the capot rather than losing
    // it to white.
    exposure: 0.82,
    caption: { id: 'open' },
  },

  // ── 4. The buds rise ────────────────────────────────────────────────────
  {
    at: 0.222,
    cam: [0.8, 10.2, 8.4],
    look: [0, 1.9, 0],
    fov: 28,
    lid: 1,
    podsOut: 1,
    podPos: AIR,
    podSpread: 1.15,
    caseRot: [0, 6.283185, 0],
    ground: 0.45,
    exposure: 0.84,
    caption: { id: 'wells' },
  },
  {
    at: 0.262,
    cam: [4.8, 4.4, 11.4],
    look: [0, 0.35, 0],
    fov: 27,
    podPos: [0, 0.2, 0],
    podSpread: 1.9,
    podRot: [0, 0.3, 0],
    casePos: AWAY,
    lid: 0.85,
    ground: 0,
    caption: { id: 'pair' },
  },

  // ── 5. Orbit ────────────────────────────────────────────────────────────
  {
    at: 0.3,
    cam: [11.2, 2.2, 3.4],
    look: [0, 0, 0],
    fov: 26,
    podPos: [0, 0, 0],
    podRot: [0, 0.6, 0],
    podSpread: 2.0,
    casePos: AWAY,
    lid: 0,
    caption: { id: 'mirror' },
  },
  {
    at: 0.335,
    cam: [6.4, -1.8, -9.2],
    look: [0, 0, 0],
    podRot: [0, 1.0, 0],
    podSpread: 1.7,
  },

  // ── 6. Showroom — one bud, free to turn ─────────────────────────────────
  {
    at: 0.372,
    cam: [-3.8, 1.3, -8.8],
    look: [0, 0, 0],
    fov: 25,
    solo: 1,
    podSpread: 0,
    podRot: [0, 2.1, 0],
    spin: 1,
    interactive: true,
    caption: { id: 'study' },
  },
  {
    at: 0.41,
    cam: [-5.4, 0.9, 6.0],
    look: [0, 0.1, 0],
    fov: 24,
    solo: 1,
    podSpread: 0,
    podRot: [0, 3.3, 0],
    spin: 1,
    interactive: true,
  },

  // ── 7. Macro: the speaker mesh ──────────────────────────────────────────
  // Long lens, kept well back: the mesh still reads because of the focal
  // length, not because the lens is pressed against it.
  {
    at: 0.448,
    cam: off(POD.grille, AX, 5.4, [0, 0.6, 0]),
    look: v(POD.grille),
    fov: 19,
    podRot: [0, 0, 0],
    solo: 1,
    podSpread: 0,
    caption: { id: 'aperture' },
  },
  {
    at: 0.482,
    cam: off(POD.grille, AX, 3.1),
    look: v(POD.grille),
    fov: 21,
    solo: 1,
    podSpread: 0,
  },

  // ── 8. Through the shell ────────────────────────────────────────────────
  // The crossing is a moment, not a destination: the lens passes the surface
  // and keeps going, rather than parking with its nose against a component.
  {
    at: 0.512,
    cam: off(POD.grille, AX, 0.9),
    look: off(POD.driver, AX, -0.4),
    fov: 32,
    clip: 1,
    xray: 0.55,
    solo: 1,
    podSpread: 0,
    ground: 0,
    caption: { id: 'through' },
  },
  // The lens crosses the surface and keeps going, coming out the far side —
  // the pass-through is a movement, not a place to stop. Three keys rather
  // than two: at two, the crossing was over before you had registered that
  // the shell had opened at all.
  {
    at: 0.527,
    cam: off(POD.grille, AX, -0.35),
    look: v(POD.driver),
    fov: 38,
    clip: 1,
    xray: 0.85,
    ground: 0,
  },
  {
    at: 0.548,
    cam: off(POD.driver, AX, -3.4, [0.6, 0.5, 0]),
    look: v(POD.driver),
    fov: 30,
    clip: 1,
    xray: 1,
    ground: 0,
  },

  // ── 9. Inside, seen from outside ────────────────────────────────────────
  // Out the far side and back to a working distance, with the shell now glass.
  {
    at: 0.576,
    cam: off(POD.driver, TAN, 5.6, [2.6, 0.4, 1.8]),
    look: v(POD.driver),
    fov: 26,
    clip: 0,
    xray: 1,
    caption: { id: 'driver' },
  },

  // ── 10. Exploded ────────────────────────────────────────────────────────
  {
    at: 0.618,
    cam: [8.4, 2.2, 8.0],
    look: [0, 0.1, 0],
    fov: 25,
    explode: 1,
    xray: 0.72,
    podRot: [0, 0.45, 0],
    caption: { id: 'assembly' },
  },
  {
    at: 0.64,
    cam: [8.6, 1.6, 9.0],
    look: [0, 0.3, 0],
    fov: 24,
    explode: 1,
    xray: 0.8,
    podRot: [0, 0.2, 0],
  },
  {
    at: 0.665,
    cam: [-6.6, 3.4, 8.8],
    look: [0, 0.1, 0],
    fov: 26,
    explode: 1,
    xray: 0.72,
    podRot: [0, -0.35, 0],
  },

  // ── 11. Sound ───────────────────────────────────────────────────────────
  {
    at: 0.694,
    cam: off(POD.grille, AX, 7.2, [0, 0.4, 0]),
    look: v(POD.grille),
    fov: 24,
    explode: 0,
    xray: 0.18,
    fxSound: 1,
    podRot: [0, 0, 0],
    caption: { id: 'output' },
  },

  // ── 12. Microphones ─────────────────────────────────────────────────────
  {
    at: 0.734,
    cam: off(POD.micTop, new Vector3(0.82, 0.3, 0.48).normalize(), 5.0),
    look: v(POD.micTop),
    fov: 19,
    fxSound: 0.25,
    fxMic: 1,
    xray: 0.12,
    caption: { id: 'intake' },
  },

  // ── 13. Electronics ─────────────────────────────────────────────────────
  {
    at: 0.774,
    cam: off(POD.board, new Vector3(-0.75, 0.15, 0.64).normalize(), 5.2),
    look: v(POD.board),
    fov: 21,
    fxMic: 0.15,
    fxData: 1,
    xray: 1,
    caption: { id: 'silicon' },
  },

  // ── 14. Energy ──────────────────────────────────────────────────────────
  {
    at: 0.812,
    cam: off(POD.battery, new Vector3(0.55, 0.35, 0.76).normalize(), 6.4),
    look: [
      (POD.battery.x + POD.board.x) / 2,
      (POD.battery.y + POD.board.y) / 2,
      (POD.battery.z + POD.board.z) / 2,
    ],
    fov: 25,
    fxData: 0.3,
    fxEnergy: 1,
    xray: 1,
    caption: { id: 'charge' },
  },

  // ── 15. The case, from inside ───────────────────────────────────────────
  {
    at: 0.856,
    cam: [0, 1.6, 13.4],
    look: [0, -1.4, 0],
    fov: 27,
    fxEnergy: 0.35,
    xray: 0.3,
    explode: 0,
    solo: 0,
    podSpread: 1.9,
    podPos: [0, 3.6, 0],
    casePos: [0, -1.6, 0],
    caseXray: 0.9,
    caseInsert: 0.35,
    lid: 0.3,
    ground: 0.3,
    caption: { id: 'reserve' },
  },
  {
    at: 0.892,
    cam: [4.2, -2.0, 8.6],
    look: [0, -1.6, 0],
    fov: 30,
    caseXray: 1,
    caseInsert: 0,
    casePos: [0, -1.6, 0],
    // clear of the top of the frame: the case is the subject here
    podPos: [0, 6.2, 0],
    fxEnergy: 0.8,
    ground: 0,
  },

  // ── 16. Reassembly ──────────────────────────────────────────────────────
  {
    at: 0.928,
    cam: [2.2, 4.8, 12.0],
    look: [0, 0.4, 0],
    fov: 28,
    caseXray: 0.25,
    caseInsert: 1,
    casePos: [0, 0, 0],
    caseRot: [0, 6.283185, 0],
    lid: 1,
    podPos: [0, 2.6, 0],
    podSpread: 1.15,
    podRot: [0, 0, 0],
    xray: 0,
    fxEnergy: 0,
    ground: 0.5,
    caption: { id: 'ret' },
  },
  {
    at: 0.958,
    cam: [0.7, 9.4, 7.4],
    look: [0, 0.8, 0],
    fov: 29,
    podsOut: 0,
    lid: 1,
    caseXray: 0,
    caseRot: [0, 6.283185, 0],
    ground: 0.8,
    exposure: 0.84,
    caption: { id: 'seated' },
  },
  {
    at: 0.978,
    cam: [3.6, 3.2, 13.0],
    look: [0, 0, 0],
    fov: 26,
    podsOut: 0,
    lid: 0,
    caseRot: [0, 6.9, 0],
    ground: 1,
    // The closing line goes here rather than on the final key: a caption set
    // at at:1 would own a span of zero length and never get on screen.
    caption: { id: 'hero', align: 'centre' },
  },
  {
    at: 1.0,
    cam: [0, 0.9, 24],
    look: [0, 0.9, 0],
    fov: 23,
    podsOut: 0,
    lid: 0,
    // Back to dead-on, exactly where it began.
    caseRot: [0, 12.566371, 0],
    lightAngle: 1.2,
  },
]

/** Expand the partial score into full frames. */
export function buildFrames(): Frame[] {
  const out: Frame[] = []
  let prev: Frame = { ...DEFAULTS }
  for (const k of SCRIPT) {
    // `interactive` is moment-scoped. `caption` carries over like any other
    // channel, so a line written once holds across every key that follows
    // until another key replaces it — or sets it to null to clear it.
    const { interactive, ...rest } = k
    const frame: Frame = { ...prev, ...rest, interactive }
    out.push(frame)
    prev = frame
  }
  return out
}

export const FRAMES = buildFrames()

/**
 * How many viewport heights the whole piece occupies.
 *
 * This is the master pacing control: the score is written in normalised time,
 * so lengthening the track stretches every move in it at once. Long, because
 * each shot should be allowed to land rather than being scrolled past.
 */
export const SCROLL_VH = 2700
