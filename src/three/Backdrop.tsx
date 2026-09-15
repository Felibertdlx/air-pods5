import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  BackSide,
  Color,
  MathUtils,
  Mesh,
  ShaderMaterial,
  type Group,
} from 'three'
import type { Theme } from '../state/store'

/**
 * A graded cyclorama rather than a flat fill.
 *
 * A white product on a near-white flat background loses its edge, and anything
 * crossing the frame becomes obvious because there is nothing else to look at.
 * A soft radial falloff — brighter behind the product, darker towards the
 * corners — is what a real studio backdrop does, and it gives the shell a
 * boundary on every side without adding a single visible element.
 *
 * The grade is evaluated per pixel around the *lens axis*, not baked into a
 * texture on the sphere. A painted gradient puts the bright spot at one fixed
 * longitude: correct in the opening shot, and then slowly wrong as the camera
 * orbits past it, until the product is sitting against the dark side of its
 * own backdrop. Measuring the falloff from the middle of the frame means the
 * subject is always on the bright part and the frame edges are always the
 * darker part, from any angle the film happens to take.
 *
 * One opaque sphere that crossfades between two grades in the shader. The
 * obvious alternative — a second, transparent sphere fading over the first —
 * has to disable depth testing to sit behind everything, and a transparent
 * draw with depth testing off is composited after the opaque pass: it paints
 * over the product instead of sitting behind it.
 */

const GRADES: Record<Theme, [string, string, string]> = {
  studio: ['#d8d8e0', '#b6b6c2', '#8a8a94'],
  dark: ['#15151b', '#08080b', '#010102'],
}

/** How long the mood takes to change hands, in seconds. */
const THEME_SECONDS = 1.1

const linear = (hex: string) => new Color(hex).convertSRGBToLinear()

function stops(theme: Theme) {
  const [inner, mid, outer] = GRADES[theme]
  return {
    inner: { value: linear(inner) },
    mid: { value: linear(mid) },
    outer: { value: linear(outer) },
  }
}

const vertex = /* glsl */ `
  varying vec3 vView;
  varying vec3 vWorld;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // Direction from the lens to this point, in view space — and, because the
    // sphere is centred on the camera, the same direction in world space.
    vView = normalize(mv.xyz);
    vWorld = normalize(position);
    gl_Position = projectionMatrix * mv;
  }
`

const fragment = /* glsl */ `
  uniform vec3 uInnerA;
  uniform vec3 uMidA;
  uniform vec3 uOuterA;
  uniform vec3 uInnerB;
  uniform vec3 uMidB;
  uniform vec3 uOuterB;
  uniform float uMix;
  varying vec3 vView;
  varying vec3 vWorld;

  // How wide the lit pool on the backdrop is, as the sine of an angle from
  // the lens axis — a property of the wall, not of the lens pointed at it.
  // Normalising this to the corner of the frame instead was wrong in a way
  // that only showed up on the hero shot: it made the whole falloff fit
  // whatever lens was mounted, so a 23mm-equivalent macro squeezed the entire
  // gradient into one frame and painted a bright oval behind the title. Fixed
  // in angle, a long lens sees a small and nearly flat piece of the backdrop
  // and a wide one sees the falloff, which is what a backdrop does.
  const float SPREAD = 0.72;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  // Three stops as a quadratic Bezier rather than two chained smoothsteps.
  // Chaining them put a knee where the second one started: a faint but
  // perfectly visible ellipse drawn on the backdrop, which is worse than no
  // gradient at all. A Bezier has no join to see.
  vec3 grade(vec3 inner, vec3 mid, vec3 outer, float r) {
    float t = smoothstep(0.0, 1.0, r);
    return mix(mix(inner, mid, t), mix(mid, outer, t), t);
  }

  void main() {
    // Angular distance from the lens axis: the bright part of the backdrop is
    // always directly behind the subject, whatever direction the camera faces.
    float r = clamp(length(vView.xy) / SPREAD, 0.0, 1.0);
    vec3 col = mix(
      grade(uInnerA, uMidA, uOuterA, r),
      grade(uInnerB, uMidB, uOuterB, r),
      uMix
    );
    // One world-anchored term, so the backdrop is not perfectly welded to the
    // lens: the floor falls away below the horizon and the wall lifts above
    // it. Tilting the camera now changes the background, which is the cue
    // that says the product is standing in a room. Kept narrow — the written
    // sections sit on this, and every stop of falloff is contrast taken off
    // the type that has to stay readable over it.
    col *= mix(0.89, 1.04, smoothstep(-0.55, 0.65, vWorld.y));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    // Noise at one quantisation step, applied after the transfer curve. A
    // gradient this large and this smooth collapses into visible bands on an
    // 8-bit display — banding across the backdrop is the single most reliable
    // tell of a cheap render. This trades the bands for noise half a code
    // value deep, which no screen this runs on can resolve.
    gl_FragColor.rgb += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  }
`

export function Backdrop({ theme }: { theme: Theme }) {
  const root = useRef<Group>(null)
  const mesh = useRef<Mesh>(null)
  /** Linear 0 → 1 handover progress; the shader gets the eased version. */
  const progress = useRef(0)

  const material = useMemo(() => {
    const a = stops('studio')
    const b = stops('dark')
    return new ShaderMaterial({
      uniforms: {
        uInnerA: a.inner,
        uMidA: a.mid,
        uOuterA: a.outer,
        uInnerB: b.inner,
        uMidB: b.mid,
        uOuterB: b.outer,
        uMix: { value: 0 },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      side: BackSide,
      depthWrite: false,
      toneMapped: false,
    })
  }, [])

  useFrame((state, dt) => {
    // The backdrop rides with the camera, so it is always behind the subject
    // however far the shot travels — and never shows a horizon.
    if (root.current) root.current.position.copy(state.camera.position)

    // Switching ambience is itself a shot: a long crossfade, not a cut — and
    // eased at both ends, so it neither snaps away from the mood it is
    // leaving nor creeps into the one it is joining. An exponential chase
    // does the opposite: fastest at the instant of the change, then a tail
    // that never quite lands.
    const want = theme === 'dark' ? 1 : 0
    const p = progress.current
    progress.current = MathUtils.clamp(
      p + Math.sign(want - p) * (dt / THEME_SECONDS),
      0,
      1,
    )
    const t = progress.current
    material.uniforms.uMix.value = t * t * (3 - 2 * t)
  })

  return (
    <group ref={root}>
      <mesh ref={mesh} material={material} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[70, 48, 32]} />
      </mesh>
    </group>
  )
}
