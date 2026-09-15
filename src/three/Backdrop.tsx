import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  BackSide,
  CanvasTexture,
  Mesh,
  ShaderMaterial,
  SRGBColorSpace,
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
 * One opaque sphere that crossfades between two grades in the shader. The
 * obvious alternative — a second, transparent sphere fading over the first —
 * has to disable depth testing to sit behind everything, and a transparent
 * draw with depth testing off is composited after the opaque pass: it paints
 * over the product instead of sitting behind it.
 */

const GRADES: Record<Theme, [string, string, string]> = {
  studio: ['#d6d6de', '#b4b4c0', '#85858f'],
  dark: ['#15151b', '#08080b', '#010102'],
}

function gradient(theme: Theme, size = 512) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const [inner, mid, outer] = GRADES[theme]
  // centred slightly high, where the product sits in most shots
  const g = ctx.createRadialGradient(
    size * 0.5,
    size * 0.44,
    0,
    size * 0.5,
    size * 0.44,
    size * 0.8,
  )
  g.addColorStop(0, inner)
  g.addColorStop(0.45, mid)
  g.addColorStop(1, outer)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.needsUpdate = true
  return t
}

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragment = /* glsl */ `
  uniform sampler2D uStudio;
  uniform sampler2D uDark;
  uniform float uMix;
  varying vec2 vUv;
  void main() {
    vec4 a = texture2D(uStudio, vUv);
    vec4 b = texture2D(uDark, vUv);
    gl_FragColor = vec4(mix(a.rgb, b.rgb, uMix), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function Backdrop({ theme }: { theme: Theme }) {
  const root = useRef<Group>(null)
  const mesh = useRef<Mesh>(null)

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uStudio: { value: gradient('studio') },
          uDark: { value: gradient('dark') },
          uMix: { value: 0 },
        },
        vertexShader: vertex,
        fragmentShader: fragment,
        side: BackSide,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )

  useFrame((state, dt) => {
    // The backdrop rides with the camera, so it is always behind the subject
    // however far the shot travels — and never shows a horizon.
    if (root.current) root.current.position.copy(state.camera.position)
    // Switching ambience is itself a shot: a long crossfade, not a cut.
    const want = theme === 'dark' ? 1 : 0
    const u = material.uniforms.uMix
    u.value += (want - u.value) * (1 - Math.pow(0.12, dt))
  })

  return (
    <group ref={root}>
      <mesh ref={mesh} material={material} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[70, 48, 32]} />
      </mesh>
    </group>
  )
}
