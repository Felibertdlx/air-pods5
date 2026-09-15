import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  CanvasTexture,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  type Group,
} from 'three'
import type { Theme } from '../state/store'
import { read } from './signal'

/**
 * The shadow the product casts on nothing.
 *
 * A real shadow-catcher plane has edges, and in a piece where the camera goes
 * under the product and out to the side those edges are always eventually
 * visible — which instantly reads as a 3D scene rather than a photograph.
 * This is a soft ellipse with no boundary: it grounds the hero shots and
 * disappears the moment the product leaves the ground.
 */

function blobTexture(size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )
  // two stops, weighted to a dense core — a linear falloff looks like a smudge
  g.addColorStop(0, 'rgba(0,0,0,0.95)')
  g.addColorStop(0.34, 'rgba(0,0,0,0.55)')
  g.addColorStop(0.62, 'rgba(0,0,0,0.16)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const t = new CanvasTexture(c)
  t.needsUpdate = true
  return t
}

export function Ground({ theme }: { theme: Theme }) {
  const root = useRef<Group>(null)
  const core = useRef<Mesh>(null)
  const halo = useRef<Mesh>(null)
  const texture = useMemo(blobTexture, [])

  useFrame(() => {
    const s = read()
    const g = s.ground
    if (root.current) root.current.visible = g > 0.01
    const dark = theme === 'dark'
    const cm = core.current?.material as MeshBasicMaterial | undefined
    const hm = halo.current?.material as MeshBasicMaterial | undefined
    if (cm) cm.opacity = g * (dark ? 0.5 : 0.34)
    if (hm) hm.opacity = g * (dark ? 0.2 : 0.14)
  })

  return (
    <group ref={root} position={[0, -2.46, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* tight core, directly beneath the product */}
      <mesh ref={core} scale={[3.5, 2.0, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={texture}
          transparent
          depthWrite={false}
          opacity={0.34}
          side={DoubleSide}
          toneMapped={false}
          color="#25252c"
        />
      </mesh>
      {/* wide, very faint halo so the core does not end abruptly */}
      <mesh ref={halo} scale={[9, 5.5, 1]} position={[0, 0, -0.004]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={texture}
          transparent
          depthWrite={false}
          opacity={0.14}
          side={DoubleSide}
          toneMapped={false}
          color="#2a2a32"
        />
      </mesh>
    </group>
  )
}
