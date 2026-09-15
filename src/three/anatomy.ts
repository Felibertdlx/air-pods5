import { Vector3 } from 'three'
import type { V3 } from '../timeline/types'

/**
 * Landmarks measured on the real meshes in Blender (see
 * public/models/pods.manifest.json) converted into scene space.
 *
 * glTF export rewrites Blender's Z-up basis into Y-up:  (x, y, z) → (x, z, -y).
 * Both models are then scaled in one place so that 1 scene unit = 1 cm.
 */

/** One source unit of the earbud file, in centimetres. */
export const POD_SCALE = 30.2 / 2.652 / 10 // ≈ 1.1388
/** The case file is modelled in millimetres. */
export const CASE_SCALE = 0.1

/** Blender (x, y, z) → scene (x, z, −y), then scaled. */
function fromBlender(v: V3, scale: number): Vector3 {
  return new Vector3(v[0], v[2], -v[1]).multiplyScalar(scale)
}

function dirFromBlender(v: V3): Vector3 {
  return new Vector3(v[0], v[2], -v[1]).normalize()
}

const B = {
  grille: [0.0818, 0.55, 0.2433] as V3,
  spout: [0.4308, -0.2753, 0.8632] as V3,
  micTop: [0.7002, -0.38, 0.9313] as V3,
  vent: [-0.7206, -0.307, 0.5678] as V3,
  headCentre: [-0.0547, -0.0136, 0.6009] as V3,
  driver: [-0.012, 0.0738, 0.5494] as V3,
  driverAxis: [0.3879, 0.7943, -0.4676] as V3,
  battery: [-0.1726, -0.2551, 0.743] as V3,
  board: [-0.3502, -0.3505, -0.7025] as V3,
  stemTip: [-0.3502, -0.3505, -1.326] as V3,
  bboxMin: [-0.6086, -0.7728, -1.326] as V3,
  bboxMax: [0.5208, 0.7728, 1.326] as V3,
}

/** Positions in the left bud's own space, in centimetres. */
export const POD = {
  grille: fromBlender(B.grille, POD_SCALE),
  spout: fromBlender(B.spout, POD_SCALE),
  micTop: fromBlender(B.micTop, POD_SCALE),
  vent: fromBlender(B.vent, POD_SCALE),
  head: fromBlender(B.headCentre, POD_SCALE),
  driver: fromBlender(B.driver, POD_SCALE),
  battery: fromBlender(B.battery, POD_SCALE),
  board: fromBlender(B.board, POD_SCALE),
  stemTip: fromBlender(B.stemTip, POD_SCALE),
  /** Outward normal of the speaker mesh — the direction sound leaves the bud. */
  axis: dirFromBlender(B.driverAxis),
  min: fromBlender(B.bboxMin, POD_SCALE),
  max: fromBlender(B.bboxMax, POD_SCALE),
}

/** Total bud height in cm (≈ 3.02). */
export const POD_HEIGHT = Math.abs(POD.max.y - POD.min.y)

export const CASE = {
  /** Outer size in cm. */
  size: new Vector3(50.1, 46.19, 21.19).multiplyScalar(CASE_SCALE),
  /** Lid hinge, in case-root space. */
  hinge: fromBlender([0, -9.4, 9.7942], CASE_SCALE),
  // 58° left the lid's front edge hanging over the wells — not enough
  // clearance for the buds to rise without visually grazing it. A real
  // case's lid swings back past vertical; 104° puts the open lid's edge
  // well clear of the column the buds actually travel through.
  openRad: (104 * Math.PI) / 180,
  /** Floor of the moulded wells, in case-root space (y). */
  wellFloorY: -21.4 * CASE_SCALE,
  /** Half-distance between the two wells along x. */
  wellHalfX: 11.5 * CASE_SCALE,
}

/**
 * Where a bud sits when it is stowed. The stem tip lands on the well floor,
 * so the offset follows from the bud's own geometry rather than from taste.
 */
export const SEAT_Y = CASE.wellFloorY - POD.stemTip.y

/**
 * The right bud is the left one mirrored across Blender's Y axis, which the
 * Y-up conversion turns into a mirror across scene Z.
 */
export function mirrorForRight(v: Vector3): Vector3 {
  return new Vector3(v.x, v.y, -v.z)
}
