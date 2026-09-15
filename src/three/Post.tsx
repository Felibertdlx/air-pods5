import {
  Bloom,
  BrightnessContrast,
  EffectComposer,
  SMAA,
  Vignette,
} from '@react-three/postprocessing'
import type { Profile } from '../lib/quality'
import type { Theme } from '../state/store'

/**
 * Restraint is the point.
 *
 * Everything stays sharp: no depth of field. A product this small is read by
 * its edges, and throwing any part of it out of focus costs more than the
 * cinematic softness buys — the macro shots in particular need the whole
 * object crisp, not just the plane the lens happens to be on.
 *
 * Bloom is reserved for the status light. Set low enough to catch a white
 * shell's speculars it wraps the product in a halo, which reads as an
 * on-camera flash rather than a studio.
 */

interface Props {
  profile: Profile
  theme: Theme
}

export function Post({ profile, theme }: Props) {
  const dark = theme === 'dark'

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <SMAA />
      {profile.bloom ? (
        <Bloom
          intensity={dark ? 0.16 : 0.07}
          luminanceThreshold={dark ? 0.98 : 1.05}
          luminanceSmoothing={0.08}
          mipmapBlur
          radius={0.5}
        />
      ) : (
        <></>
      )}
      {/* Contrast only. Pulling brightness down as well would buy the range
          back by making a white product grey, which is the wrong trade. */}
      <BrightnessContrast brightness={0} contrast={dark ? 0.16 : 0.2} />
      <Vignette offset={0.26} darkness={dark ? 0.62 : 0.34} />
    </EffectComposer>
  )
}
