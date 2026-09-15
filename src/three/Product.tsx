import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import {
  Euler,
  Group,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three'
import type { Profile } from '../lib/quality'
import { useStore } from '../state/store'
import {
  CASE,
  CASE_SCALE,
  POD_SCALE,
  POD_SEAT_TRIM,
  SEAT_Y,
  SEAT_YAW,
} from './anatomy'
import { applyExplode, buildParts, type Part } from './explode'
import { dressModel, setClip, setXray } from './materials'
import { intro, read } from './signal'

const POD_URL = '/models/pods.glb'
const CASE_URL = '/models/case.glb'
/** Decoder served from the app, not a CDN: the page works offline. */
const DRACO = '/draco/'

useGLTF.preload(POD_URL, DRACO)
useGLTF.preload(CASE_URL, DRACO)

interface Props {
  profile: Profile
  /** Drag-orbit offset contributed by the pointer, in radians. */
  orbit: { az: number; pol: number }
  /** Effects that live in the studied bud's own space. */
  children?: ReactNode
}

const seatP = new Vector3()
const seatQ = new Quaternion()
/** Case rotation, then the bud's own turn toward the centre of the case. */
const seatQSide = new Quaternion()
const seatYawQ = new Quaternion()
const freeP = new Vector3()
const freeQ = new Quaternion()
const freeE = new Euler()
const seatE = new Euler()
const camDir = new Vector3()
const away = new Vector3()
const UP_AXIS = new Vector3(0, 1, 0)

export function Product({ profile, orbit, children }: Props) {
  const podGltf = useGLTF(POD_URL, DRACO)
  const caseGltf = useGLTF(CASE_URL, DRACO)
  const { camera } = useThree()
  const setLoaded = useStore((s) => s.setLoaded)

  // The loader caches one scene per URL, so each mount gets its own clone —
  // this component moves nodes around and replaces materials, and must not do
  // that to the cached original.
  //
  // Scene, nodes, materials and the part table are derived in a single memo on
  // purpose: split across several, a double-invoked render can leave the
  // dressed materials belonging to one clone and the rendered meshes to
  // another, and every material effect silently stops working.
  const { podScene, caseScene, nodes, skins, parts } = useMemo(() => {
    const pod = podGltf.scene.clone(true)
    const kase = caseGltf.scene.clone(true)
    const hi = profile.tier !== 'low'
    const n = {
      L: pod.getObjectByName('Pod_L') as Object3D,
      R: pod.getObjectByName('Pod_R') as Object3D,
      lid: kase.getObjectByName('Boitier_Couvercle') as Object3D,
      insert: kase.getObjectByName('Boitier_Logement') as Mesh,
      button: kase.getObjectByName('Boitier_Bouton') as Object3D,
    }
    return {
      podScene: pod,
      caseScene: kase,
      nodes: n,
      skins: { pods: dressModel(pod, hi), case: dressModel(kase, hi) },
      parts: {
        L: buildParts(n.L, false),
        R: buildParts(n.R, true),
      } as Record<'L' | 'R', Part[]>,
    }
  }, [podGltf.scene, caseGltf.scene, profile.tier])

  const caseGroup = useRef<Group>(null)
  const fxGroup = useRef<Group>(null)
  const spin = useRef(0)
  const warm = useRef(0)
  /** Lid angle as a lightly underdamped spring, not a direct assignment — a
   * hinge has mass. Tuned just shy of critical so the lid overshoots its
   * target by a fraction of a degree and settles, instead of stopping dead. */
  const lid = useRef({ pos: 0, vel: 0 })
  /** The button's resting depth, captured once so the press offset is
   * relative rather than an assumption about the source file's origin. */
  const btnRestZ = useRef(0)

  useEffect(() => {
    nodes.L.scale.setScalar(POD_SCALE)
    nodes.R.scale.setScalar(POD_SCALE)
    btnRestZ.current = nodes.button.position.z
    setLoaded(true)
    if (import.meta.env.DEV) {
      Object.assign(window, { skins, podScene, caseScene, nodes })
    }
  }, [nodes, skins, podScene, caseScene, setLoaded])

  useFrame((state, dt) => {
    const s = read()
    const t = state.clock.elapsedTime

    // Turning clipping on for the first time adds a define and forces a shader
    // recompile — a quarter-second stall, and it would land exactly on the shot
    // where the lens passes through the shell. Compile it here instead, during
    // the first few frames, while the loader is still covering the canvas.
    if (warm.current < 3) {
      warm.current++
      camera.getWorldDirection(camDir)
      setClip(skins.pods, warm.current < 3 ? 1 : 0, camera.position, camDir)
      setXray(skins.pods.fading, warm.current < 3 ? 1 : 0)
      setXray(skins.case.fading, warm.current < 3 ? 1 : 0)
      return
    }

    // ---- case -------------------------------------------------------------
    const cg = caseGroup.current
    if (cg) {
      cg.position.fromArray(s.casePos)
      // The half turn is baked in here rather than on an inner group, so the
      // case's world matrix is the frame the wells are measured in.
      cg.rotation.set(s.caseRot[0], s.caseRot[1] + Math.PI, s.caseRot[2])
      cg.updateMatrixWorld(true)
    }
    // The lid's origin already sits on the hinge axis in the source file, so
    // opening it is a single rotation — but driven through a spring rather
    // than set directly, so the hinge carries a touch of mechanical weight.
    {
      const target = s.lid * CASE.openRad
      const l = lid.current
      const stiffness = 140
      const damping = 15.5
      const accel = (target - l.pos) * stiffness - l.vel * damping
      l.vel += accel * dt
      l.pos += l.vel * dt
      nodes.lid.rotation.x = l.pos
    }

    // ---- earbuds: blend between stowed and free ---------------------------
    spin.current += dt * 0.12 * s.spin
    freeE.set(s.podRot[0] + orbit.pol, s.podRot[1] + spin.current + orbit.az, s.podRot[2])
    freeQ.setFromEuler(freeE)

    for (const side of ['L', 'R'] as const) {
      const g = nodes[side]
      if (!cg) break
      const sign = side === 'L' ? -1 : 1

      // The stowed pose is built in the case's *scripted* frame — the half
      // turn baked into the group is deliberately left out of both the
      // position and the rotation.
      //
      // Going through the group's world matrix instead put the half turn into
      // the position but not into the free pose, so the left bud's well sat on
      // the opposite side of the world from where the left bud flies to: the
      // two of them swapped sides on the way out, crossing over and cutting
      // straight through the case to get there. Expressing both ends of the
      // blend in one frame makes leaving the case the vertical lift it should
      // be. Which physical well a bud lands in stops mattering — they are
      // identical.
      seatE.set(s.caseRot[0], s.caseRot[1], s.caseRot[2])
      seatQ.setFromEuler(seatE)
      seatP
        .set(sign * (CASE.wellHalfX - POD_SEAT_TRIM), SEAT_Y, 0)
        .applyQuaternion(seatQ)
        .add(cg.position)

      // Stowed, a bud is turned so its speaker faces the centre of the case,
      // the way a real pair sits. The wells are moulded at this same angle
      // (anatomy.SEAT_YAW), so the two have to move together.
      seatYawQ.setFromAxisAngle(UP_AXIS, SEAT_YAW[side])
      seatQSide.copy(seatQ).multiply(seatYawQ)

      freeP.set(s.podPos[0] + sign * s.podSpread, s.podPos[1], s.podPos[2])
      if (side === 'R') {
        // The second bud withdraws straight away from the lens rather than
        // sliding sideways: a shape crossing an otherwise empty frame is the
        // one thing that pulls the eye off the subject.
        away.copy(freeP).sub(camera.position).normalize()
        freeP.addScaledVector(away, s.solo * 16)
      } else {
        freeP.x = MathUtils.lerp(freeP.x, s.podPos[0], s.solo)
        freeP.z = MathUtils.lerp(freeP.z, s.podPos[2], s.solo)
      }
      freeP.y += Math.sin(t * 0.34 + (side === 'L' ? 0 : 1.9)) * 0.04 * s.podsOut

      g.position.lerpVectors(seatP, freeP, s.podsOut)
      g.quaternion.copy(seatQSide).slerp(freeQ, s.podsOut)
      if (side === 'R') g.visible = s.solo < 0.995

      applyExplode(
        parts[side],
        side === 'L' ? s.explode : s.explode * (1 - s.solo),
        t,
      )
    }

    // Effects are authored in the left bud's own centimetre space, so they
    // simply inherit its pose.
    if (fxGroup.current) {
      fxGroup.current.position.copy(nodes.L.position)
      fxGroup.current.quaternion.copy(nodes.L.quaternion)
    }

    // ---- material state ---------------------------------------------------
    setXray(skins.pods.fading, s.xray)
    setXray(skins.case.fading, s.caseXray)

    // The moulded insert has its own channel so the electronics can be shown
    // without also dissolving the outer shell. Applied after setXray so it wins.
    const im = nodes.insert.material as MeshPhysicalMaterial
    nodes.insert.visible = s.caseInsert > 0.015
    if (nodes.insert.visible) {
      const o = s.caseInsert * (1 - s.caseXray * 0.85)
      im.transparent = o < 0.995
      im.opacity = o
      im.depthWrite = o > 0.6
    }

    camera.getWorldDirection(camDir)
    setClip(skins.pods, s.clip, camera.position, camDir)

    // The one press in the opening beat — a real mechanical travel on the
    // real button mesh, not a texture swap.
    nodes.button.position.z = btnRestZ.current - intro.press * 0.4

    if (skins.case.led) {
      skins.case.led.emissiveIntensity =
        1.6 + Math.sin(t * 0.8) * 0.25 + s.fxEnergy * 2.6 + intro.press * 1.4
    }
    for (const m of skins.pods.internals) {
      m.envMapIntensity = MathUtils.lerp(0.45, 1.05, s.xray)
    }
  })

  return (
    <group>
      <group ref={caseGroup}>
        <group scale={CASE_SCALE}>
          <primitive object={caseScene} />
        </group>
      </group>

      <primitive object={podScene} />

      <group ref={fxGroup}>{children}</group>
    </group>
  )
}
