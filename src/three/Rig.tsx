import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { MathUtils, PerspectiveCamera, Vector3 } from 'three'
import { viewportFit } from '../lib/quality'
import { scroll, useStore } from '../state/store'
import { advance, clock, intro, updateIntro } from './signal'

/**
 * The only thing that moves the camera.
 *
 * Scroll position feeds a critically damped follower, the follower samples the
 * score, and the score's camera channel is applied here. Nothing else in the
 * scene touches the camera, which is what keeps every move intentional.
 */

interface Props {
  /** Drag contribution: azimuth / elevation offsets and a dolly factor. */
  orbit: { az: number; pol: number; dolly: number }
}

const target = new Vector3()
const look = new Vector3()
const offset = new Vector3()
const spherical = { r: 0, theta: 0, phi: 0 }

/**
 * Every scripted distance is pushed out, and no shot is ever allowed closer
 * than MIN_RADIUS. The move, the arc and the timing are untouched — only the
 * stand-off changes, so the piece keeps its choreography but stops crowding
 * the product.
 */
const PULL_BACK = 1.3
/** Safety only — stops a shot landing exactly on a surface. */
const MIN_RADIUS = 0.3
/**
 * The opening beat starts a touch further back than the shot itself calls
 * for, and settles in over `INTRO_SECONDS` — "the camera is slightly further
 * away, then arrives" rather than the product simply appearing at its final
 * distance.
 */
const INTRO_PULL = 1.22
/** Small azimuthal drift that resolves to zero as the intro settles. */
const INTRO_DRIFT = 0.09

export function Rig({ orbit }: Props) {
  const { camera, size } = useThree()
  const fit = useRef(viewportFit(1))
  const started = useRef(false)
  const reduced = useStore((s) => s.reducedMotion)
  const entered = useStore((s) => s.entered)
  // The intro clock starts when the loader curtain actually lifts, not when
  // the canvas mounts — loading time is network-dependent, and the reveal
  // has to begin when the product is first visible, not some variable delay
  // before that.
  const enterAt = useRef<number | null>(null)

  useEffect(() => {
    fit.current = viewportFit(size.width / size.height)
  }, [size.width, size.height])

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 20)
    clock.target = scroll.t
    if (entered && enterAt.current === null) enterAt.current = state.clock.elapsedTime
    const introElapsed = enterAt.current === null ? 0 : state.clock.elapsedTime - enterAt.current
    updateIntro(introElapsed, reduced)

    // On the first frame, snap rather than sweeping in from the default pose.
    if (!started.current) {
      clock.t = clock.target
      started.current = true
    }

    const s = advance(dt, 1 - fit.current.damping)
    const cam = camera as PerspectiveCamera

    look.set(s.look[0], s.look[1], s.look[2])
    target.set(s.cam[0], s.cam[1], s.cam[2])

    // Drag-orbit is applied in the camera's spherical frame around the look
    // target, so it composes with the scripted move instead of fighting it.
    offset.copy(target).sub(look)
    spherical.r = offset.length()
    spherical.theta = Math.atan2(offset.x, offset.z)
    spherical.phi = Math.acos(MathUtils.clamp(offset.y / spherical.r, -1, 1))

    spherical.theta += orbit.az + (1 - intro.ease) * INTRO_DRIFT
    spherical.phi = MathUtils.clamp(spherical.phi - orbit.pol, 0.12, Math.PI - 0.12)
    const introPull = MathUtils.lerp(INTRO_PULL, 1, intro.ease)
    spherical.r = Math.max(
      MIN_RADIUS,
      spherical.r * PULL_BACK * introPull * fit.current.dolly * orbit.dolly,
    )

    const sinPhi = Math.sin(spherical.phi)
    target.set(
      look.x + spherical.r * sinPhi * Math.sin(spherical.theta),
      look.y + spherical.r * Math.cos(spherical.phi),
      look.z + spherical.r * sinPhi * Math.cos(spherical.theta),
    )

    cam.position.copy(target)
    cam.up.set(Math.sin(s.roll), Math.cos(s.roll), 0)
    cam.lookAt(look)

    const fov = s.fov + fit.current.fovBias
    if (Math.abs(cam.fov - fov) > 1e-3) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }
  })

  return null
}
