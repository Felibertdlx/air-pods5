import { Environment, Lightformer, useGLTF } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ACESFilmicToneMapping, Group, Object3D } from 'three'
import { CASE, CASE_SCALE, POD_SCALE } from '../three/anatomy'
import { dressModel } from '../three/materials'
import { useStore } from '../state/store'

/**
 * The section figures, rendered live from the same two models.
 *
 * They were baked Cycles stills, which looked right but quietly contradicted
 * the line at the bottom of the page: nothing above is a video. These are the
 * real geometry, turning slowly.
 *
 * Each one mounts only while it is near the viewport and unmounts again after,
 * so the page never holds more than one extra WebGL context at a time.
 */

const DRACO = '/draco/'
export type Subject = 'case-closed' | 'case-open' | 'earbud'

/** Drag state, shared between the DOM handlers and the render loop. */
export interface Turn {
  az: number
  pol: number
  dragging: boolean
  touched: boolean
}

function Model({ subject, turn }: { subject: Subject; turn: Turn }) {
  const pods = useGLTF('/models/pods.glb', DRACO)
  const kase = useGLTF('/models/case.glb', DRACO)
  const spin = useRef<Group>(null)

  const node = useMemo(() => {
    if (subject === 'earbud') {
      const scene = pods.scene.clone(true)
      dressModel(scene, true)
      const bud = scene.getObjectByName('Pod_L') as Object3D
      bud.scale.setScalar(POD_SCALE)
      bud.position.set(0, 0, 0)
      return bud
    }
    const scene = kase.scene.clone(true)
    dressModel(scene, true)
    const root = scene.getObjectByName('Case') as Object3D
    root.scale.setScalar(CASE_SCALE)
    root.position.set(0, 0, 0)
    if (subject === 'case-open') {
      const lid = scene.getObjectByName('Boitier_Couvercle')
      if (lid) lid.rotation.x = CASE.openRad
    }
    return root
  }, [pods.scene, kase.scene, subject])

  // Turns by itself until somebody takes hold of it, then does what they say.
  // It never drifts back: having wrestled an object into a position, watching
  // it creep away again is the most irritating thing a viewer can be shown.
  useFrame((_, dt) => {
    const g = spin.current
    if (!g) return
    if (!turn.touched) turn.az += dt * 0.12
    g.rotation.y += (turn.az - g.rotation.y) * (1 - Math.pow(0.002, dt))
    g.rotation.x += (turn.pol - g.rotation.x) * (1 - Math.pow(0.002, dt))
  })

  return (
    <group ref={spin} rotation-y={subject === 'earbud' ? 0.6 : -0.5}>
      <primitive object={node} />
    </group>
  )
}

function Stage({
  subject,
  dark,
  turn,
}: {
  subject: Subject
  dark: boolean
  turn: Turn
}) {
  const dist = subject === 'earbud' ? 9 : 14
  return (
    <>
      <ambientLight intensity={dark ? 0.09 : 0.16} />
      <directionalLight position={[-7.5, 9.5, 7]} intensity={dark ? 1.55 : 2.5} />
      <directionalLight position={[3.2, 5.5, -12]} intensity={dark ? 2.4 : 0.9} />
      <Environment resolution={128} frames={1}>
        <color attach="background" args={[dark ? '#050507' : '#3d3d45']} />
        <Lightformer
          form="rect"
          intensity={dark ? 6 : 3}
          position={[-4.5, 6, 5]}
          rotation={[-0.5, -0.6, 0]}
          scale={[9, 5, 1]}
        />
        <Lightformer
          form="rect"
          intensity={dark ? 9 : 2.4}
          position={[6, 2.5, -5]}
          rotation={[0.2, 2.3, 0]}
          scale={[7, 0.8, 1]}
          color="#eaf2ff"
        />
        <Lightformer form="ring" intensity={dark ? 2.4 : 0.8} position={[0, 1, 13]} scale={[7, 7, 1]} />
      </Environment>
      <Suspense fallback={null}>
        <Model subject={subject} turn={turn} />
      </Suspense>
      <perspectiveCamera position={[0, 0, dist]} />
    </>
  )
}

interface Props {
  subject: Subject
  alt: string
  wide?: boolean
}

export function FigureCanvas({ subject, alt, wide }: Props) {
  const host = useRef<HTMLElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const theme = useStore((s) => s.theme)
  const tier = useStore((s) => s.tier)
  const turn = useMemo<Turn>(
    () => ({ az: 0, pol: 0, dragging: false, touched: false }),
    [],
  )

  // Drag to turn. Handled on the wrapper rather than through raycasting so the
  // whole frame is the grab area — on a small figure, having to land on the
  // product itself is a worse experience than it sounds.
  useEffect(() => {
    const el = frame.current
    if (!el) return
    let lastX = 0
    let lastY = 0

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      turn.dragging = true
      turn.touched = true
      lastX = e.clientX
      lastY = e.clientY
      el.setPointerCapture(e.pointerId)
      el.dataset.grab = 'true'
    }
    const move = (e: PointerEvent) => {
      if (!turn.dragging) return
      // Vertical drags are clamped hard: tipping a product past its own
      // horizon reads as broken rather than as inspection.
      const w = Math.max(el.clientWidth, 240)
      turn.az += ((e.clientX - lastX) / w) * 3.4
      turn.pol = Math.max(-0.5, Math.min(0.5, turn.pol + ((e.clientY - lastY) / w) * 2.4))
      lastX = e.clientX
      lastY = e.clientY
    }
    const up = (e: PointerEvent) => {
      turn.dragging = false
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      delete el.dataset.grab
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [turn, near])

  useEffect(() => {
    const el = host.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => setNear(e.isIntersecting),
      { rootMargin: '25% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const dist = subject === 'earbud' ? 9 : 14

  return (
    <figure
      className={`figure figure--live${wide ? ' figure--wide' : ''}`}
      ref={host as never}
      aria-label={alt}
      role="img"
    >
      <div className="figure__frame" ref={frame}>
        {near ? (
          <Canvas
            dpr={tier === 'low' ? 1 : [1, 1.75]}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: 'low-power',
              toneMapping: ACESFilmicToneMapping,
              toneMappingExposure: 1,
            }}
            camera={{ fov: 26, near: 0.1, far: 90, position: [0, 0, dist] }}
          >
            <Stage subject={subject} dark={theme === 'dark'} turn={turn} />
          </Canvas>
        ) : null}
      </div>
    </figure>
  )
}
