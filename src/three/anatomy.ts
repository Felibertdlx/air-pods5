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
 * The bud mesh's own geometric centre sits ~0.03cm off its object origin —
 * measured from the world-space bounding box of the seated left and right
 * buds, which should be mirror images of each other and aren't quite.
 * Positioning both from `sign * wellHalfX` therefore pushes the left bud's
 * shell that much further past its well's wall than the right one, which is
 * what read as the left bud visibly overhanging the case. Trimming both
 * seat positions inward by this amount is a placement fix for a modelling
 * asymmetry, not a claim that the wells themselves are off-centre.
 */
export const POD_SEAT_TRIM = 0.08

/**
 * Where a bud sits when it is stowed. The stem tip lands on the well floor,
 * so the offset follows from the bud's own geometry rather than from taste.
 */
export const SEAT_Y = CASE.wellFloorY - POD.stemTip.y

/** Heading of a direction in the horizontal plane, measured from +z toward +x. */
function heading(v: Vector3) {
  return Math.atan2(v.x, v.z)
}

/**
 * How far a stowed bud is turned about the vertical so its speaker faces the
 * centre of the case — the way a real pair sits in the wells, nozzle to
 * nozzle across the divider, rather than both pointing the same way out of
 * the back.
 *
 * Derived from the measured driver axis rather than dialled in by eye: take
 * the axis's heading in the horizontal plane, subtract it from the heading we
 * want the bud to end up with (+x for the left bud, −x for the right), and
 * that difference is the turn.
 *
 * The two are not negatives of each other, which looks wrong until you
 * remember the right bud's mesh is mirrored across z rather than across x
 * (see mirrorForRight) — its axis starts from a different heading, so it
 * needs a different correction to end up pointing back at its partner.
 *
 * NOT APPLIED YET, on purpose. Turning the buds by this much inside the
 * wells they have now doesn't work: `build_well` in the case's own build
 * script lofts each well from a fixed profile — a nearly circular head
 * pocket over a 2.4 × 1.9 mm stem slot — moulded around the bud at zero
 * yaw. A bud is an L, so turning it either swings the head out of the
 * pocket or the stem out of the slot; both read as the buds sinking in
 * crooked and poking through the shell. The wells have to be re-lofted at
 * this same angle before the buds can be turned to match.
 */
export const SEAT_YAW = {
  L: Math.PI / 2 - heading(POD.axis),
  R: -Math.PI / 2 - heading(new Vector3(POD.axis.x, POD.axis.y, -POD.axis.z)),
}

/**
 * The right bud is the left one mirrored across Blender's Y axis, which the
 * Y-up conversion turns into a mirror across scene Z.
 */
export function mirrorForRight(v: Vector3): Vector3 {
  return new Vector3(v.x, v.y, -v.z)
}
