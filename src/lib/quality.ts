import type { Tier } from '../state/store'

export interface Profile {
  tier: Tier
  dpr: [number, number]
  shadows: boolean
  /** Contact-shadow map resolution; 0 disables it. */
  contact: number
  bloom: boolean
  ao: boolean
  /** Particle budgets. */
  sound: number
  mic: number
  motes: number
  /** Environment probe resolution for the studio reflections. */
  envRes: number
}

export const PROFILES: Record<Tier, Profile> = {
  high: {
    tier: 'high',
    dpr: [1, 2],
    shadows: true,
    contact: 1024,
    bloom: true,
    ao: true,
    sound: 2600,
    mic: 900,
    motes: 420,
    envRes: 256,
  },
  medium: {
    tier: 'medium',
    dpr: [1, 1.5],
    shadows: true,
    contact: 512,
    bloom: true,
    ao: false,
    sound: 1200,
    mic: 480,
    motes: 200,
    envRes: 128,
  },
  low: {
    tier: 'low',
    dpr: [0.75, 1],
    shadows: false,
    contact: 0,
    bloom: false,
    ao: false,
    sound: 520,
    mic: 220,
    motes: 0,
    envRes: 64,
  },
}

/**
 * Pick a starting tier from what the device tells us. It is only a starting
 * point — PerformanceMonitor moves the resolution afterwards based on the
 * frame rate actually achieved.
 */
export function detectTier(): Tier {
  if (typeof window === 'undefined') return 'medium'

  const nav = navigator as Navigator & { deviceMemory?: number }
  const cores = nav.hardwareConcurrency ?? 4
  const memory = nav.deviceMemory ?? 4
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const small = Math.min(window.innerWidth, window.innerHeight) < 500

  let renderer = ''
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') ?? c.getContext('webgl')
    if (!gl) return 'low'
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (ext) renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)).toLowerCase()
  } catch {
    /* blocked by privacy settings — fall through to the heuristics below */
  }

  const weak =
    /(swiftshader|llvmpipe|software|mali-4|mali-t[0-7]|adreno \(tm\) [1-4]\d\d\b)/.test(
      renderer,
    )
  if (weak || cores <= 2 || memory <= 2) return 'low'
  if (coarse || small || cores <= 4 || memory <= 4) return 'medium'
  return 'high'
}

/**
 * Phones get their own composition rather than a squeezed desktop one: a
 * longer lens pulled further back, so the product still fills a tall frame.
 */
export function viewportFit(aspect: number) {
  // Portrait phone ≈ 0.46, desktop ≈ 1.78.
  const portrait = aspect < 0.85
  return {
    portrait,
    /** Multiplier on every camera distance. */
    dolly: portrait ? 1.34 : aspect < 1.25 ? 1.12 : 1,
    /** Added to the scripted field of view. */
    fovBias: portrait ? 6 : aspect < 1.25 ? 2.5 : 0,
    /**
     * How hard the camera chases the scroll position, per frame. Low numbers
     * give the move weight: the lens keeps travelling for a moment after the
     * wheel stops, which is what separates a camera move from a scrub.
     * Calmer still on a small screen, where scroll gestures are coarser.
     */
    damping: portrait ? 0.042 : 0.055,
  }
}
