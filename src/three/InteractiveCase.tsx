import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { Mesh, MeshPhysicalMaterial, Object3D } from 'three'
import { engine } from '../audio/engine'
import {
  CASE,
  CASE_SCALE,
  POD_SCALE,
  POD_SEAT_TRIM,
  SEAT_Y,
} from './anatomy'
import { dressModel } from './materials'

/**
 * The Design tab's own rig — open and close the case, pull the buds out and
 * put them back, press the button — independent of the scroll timeline.
 *
 * This deliberately doesn't reuse `Product` (the film's rig): that one reads
 * its whole state from the sampled score every frame, and threading an
 * override through it for "no score, just clicks" would have cost more than
 * this much smaller, self-contained version. The physical setup — hinge
 * angle, well geometry, pod scale — is the same real data from `anatomy.ts`
 * either way.
 */

const POD_URL = '/models/pods.glb'
const CASE_URL = '/models/case.glb'
const DRACO = '/draco/'

useGLTF.preload(POD_URL, DRACO)
useGLTF.preload(CASE_URL, DRACO)

/** Walks up the parent chain — used to tell "a mesh somewhere inside the
 * button" from "a mesh somewhere inside the left bud" regardless of which
 * particular sub-mesh the ray actually hit. */
function within(obj: Object3D | null, ancestor: Object3D | null): boolean {
  let o = obj
  while (o) {
    if (o === ancestor) return true
    o = o.parent
  }
  return false
}

interface Spring {
  pos: number
  vel: number
  target: number
}

function step(s: Spring, stiffness: number, damping: number, dt: number) {
  const accel = (s.target - s.pos) * stiffness - s.vel * damping
  s.vel += accel * dt
  s.pos += s.vel * dt
}

export interface InteractiveCaseProps {
  /** Called with a short label while a named part is hovered, or null. */
  onHotspot: (label: string | null) => void
  /** Full material quality (clearcoat etc.) — off on the low tier, same as
   * the main scene. */
  hi: boolean
}

export function InteractiveCase({ onHotspot, hi }: InteractiveCaseProps) {
  const podGltf = useGLTF(POD_URL, DRACO)
  const caseGltf = useGLTF(CASE_URL, DRACO)

  const { caseScene, podScene, nodes } = useMemo(() => {
    const kase = caseGltf.scene.clone(true)
    const pod = podGltf.scene.clone(true)
    dressModel(kase, hi)
    dressModel(pod, hi)
    // The case file is modelled in millimetres; everything else in the
    // scene is centimetres. Scaling the root here is the same fix
    // FigureCanvas applies for its own live case figures.
    const caseRoot = kase.getObjectByName('Case') as Object3D
    caseRoot.scale.setScalar(CASE_SCALE)
    caseRoot.position.set(0, 0, 0)
    // Matches the film's rig (Product.tsx): the case mesh presents correctly
    // with a half turn baked in, but the well positions measured in
    // anatomy.ts are in the *un-turned* frame — rotating the mesh here
    // rather than folding the turn into the seat math is what keeps those
    // two consistent.
    caseRoot.rotation.y = Math.PI
    const n = {
      lid: kase.getObjectByName('Boitier_Couvercle') as Object3D,
      button: kase.getObjectByName('Boitier_Bouton') as Object3D,
      led: kase.getObjectByName('Boitier_LED') as Mesh | undefined,
      L: pod.getObjectByName('Pod_L') as Object3D,
      R: pod.getObjectByName('Pod_R') as Object3D,
    }
    n.L.scale.setScalar(POD_SCALE)
    n.R.scale.setScalar(POD_SCALE)
    return { caseScene: kase, podScene: pod, nodes: n }
  }, [caseGltf.scene, podGltf.scene, hi])

  const open = useRef<Spring>({ pos: 0, vel: 0, target: 0 })
  const podsOut = useRef<Spring>({ pos: 0, vel: 0, target: 0 })
  const press = useRef<Spring>({ pos: 0, vel: 0, target: 0 })
  const btnRestZ = useRef(0)
  const bob = useRef(0)

  useEffect(() => {
    btnRestZ.current = nodes.button.position.z
  }, [nodes.button])

  const toggleOpen = () => {
    const next = open.current.target > 0.5 ? 0 : 1
    open.current.target = next
    if (!next) podsOut.current.target = 0
    engine.hinge(!!next)
  }

  const togglePods = () => {
    if (open.current.target < 0.5) return
    const next = podsOut.current.target > 0.5 ? 0 : 1
    podsOut.current.target = next
    engine.lift(!!next)
  }

  const tapButton = () => {
    press.current.target = 1
    window.setTimeout(() => {
      press.current.target = 0
    }, 90)
    engine.press()
  }

  const label = (obj: Object3D | null): string | null => {
    if (!obj) return null
    if (within(obj, nodes.button)) return 'Bouton d’appairage'
    if (within(obj, nodes.L) || within(obj, nodes.R))
      return open.current.target > 0.5 ? 'AirPod — cliquer pour retirer' : 'AirPod'
    switch (obj.name) {
      case 'Boitier_Charniere':
        return 'Charnière en acier inoxydable'
      case 'Boitier_LED':
        return 'Voyant d’état'
      case 'Boitier_USBC_Fond':
      case 'Boitier_USBC_Languette':
        return 'Port USB-C'
      default:
        return open.current.target > 0.5 ? 'Cliquer pour fermer' : 'Cliquer pour ouvrir'
    }
  }

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (within(e.object, nodes.button)) tapButton()
    else if (within(e.object, nodes.L) || within(e.object, nodes.R)) togglePods()
    else toggleOpen()
  }

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    onHotspot(label(e.object))
  }

  const handleOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    onHotspot(null)
  }

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 20)
    bob.current += dt

    step(open.current, 130, 16, dt)
    step(podsOut.current, 90, 14, dt)
    step(press.current, 260, 20, dt)

    nodes.lid.rotation.x = open.current.pos * CASE.openRad
    nodes.button.position.z = btnRestZ.current - press.current.pos * 0.4

    const led = nodes.led?.material as MeshPhysicalMaterial | undefined
    if (led) {
      led.emissiveIntensity =
        1.4 + Math.sin(state.clock.elapsedTime * 0.8) * 0.2 + press.current.pos * 1.6
    }

    for (const side of ['L', 'R'] as const) {
      const g = nodes[side]
      const sign = side === 'L' ? -1 : 1
      const seatX = sign * (CASE.wellHalfX - POD_SEAT_TRIM)
      const seatY = SEAT_Y
      const freeY = seatY + 3.4
      const freeX = seatX * 1.7
      const t = podsOut.current.pos
      g.position.set(
        seatX + (freeX - seatX) * t,
        seatY + (freeY - seatY) * t + Math.sin(bob.current * 0.9 + (side === 'L' ? 0 : 1.7)) * 0.05 * t,
        0,
      )
      g.rotation.y = t * (side === 'L' ? -0.3 : 0.3)
    }
  })

  return (
    <group onClick={handleClick} onPointerOver={handleOver} onPointerOut={handleOut}>
      {/* dispose={null}: these materials share the perforation textures
          cached in materials.ts with the main scroll scene's own copies of
          these models. Letting R3F's default unmount cleanup dispose them
          here would pull the texture out from under whichever canvas
          didn't unmount, so this canvas only frees its own geometry. */}
      <primitive object={caseScene} dispose={null} />
      <primitive object={podScene} dispose={null} />
    </group>
  )
}
