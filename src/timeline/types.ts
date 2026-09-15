export type V3 = [number, number, number]

export type Ease = 'inOut' | 'in' | 'out' | 'linear'

export interface Caption {
  /** Key into the copy table; the words themselves live in src/i18n. */
  id: string
  /** Where the caption block sits. Most of the frame stays empty. */
  align?: 'left' | 'right' | 'centre'
}

/** Every animatable channel of the film, at one instant. */
export interface Frame {
  /** Normalised scroll position, 0 → 1. */
  at: number
  ease: Ease

  // ---- camera -------------------------------------------------------------
  cam: V3
  look: V3
  fov: number
  /** Extra roll in radians. Used sparingly, for the descent into the case. */
  roll: number

  // ---- case ---------------------------------------------------------------
  casePos: V3
  caseRot: V3
  /** 0 closed, 1 fully open (58°). */
  lid: number
  /** 0 opaque, 1 transparent. */
  caseXray: number
  /** Hide the moulded insert so the electronics read clearly. */
  caseInsert: number

  // ---- earbuds ------------------------------------------------------------
  /** 0 seated in the case, 1 at the free pose below. */
  podsOut: number
  podPos: V3
  podRot: V3
  /** Half-distance between the two buds along X, in cm. */
  podSpread: number
  /** 1 → the right bud recedes and only the left one is studied. */
  solo: number
  /** Component separation, 0 assembled → 1 fully exploded. */
  explode: number
  /** Shell transparency, 0 opaque → 1 glass. */
  xray: number
  /** 1 → the shell is cut away at the camera plane so it can be flown through. */
  clip: number
  /** Idle rotation speed multiplier for the studied bud. */
  spin: number

  // ---- effects ------------------------------------------------------------
  fxSound: number
  fxMic: number
  fxData: number
  fxEnergy: number

  // ---- grade --------------------------------------------------------------
  /** Global light level multiplier. */
  exposure: number
  /** Rim light strength — the edge that separates product from ground. */
  rim: number
  /** Azimuth of the whole studio rig. Turning it sweeps highlights over the
   *  shell, which is how the opening reveals the material. */
  lightAngle: number
  /** Contact shadow opacity. Fades out once the camera leaves the ground. */
  ground: number

  /**
   * A caption holds from the key that sets it until a key sets a different
   * one, so text stays on screen for a whole passage rather than for one
   * shot. Pass `null` to clear it deliberately.
   */
  caption?: Caption | null
  /** Free orbit on drag is only offered where it makes sense. */
  interactive?: boolean
}

export type FrameInput = Partial<Frame> & { at: number }
