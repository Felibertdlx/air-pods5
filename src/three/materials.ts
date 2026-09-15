import {
  Color,
  DoubleSide,
  FrontSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Plane,
  Vector3,
  type Mesh,
  type Object3D,
  type Texture,
} from 'three'
import { perforationMaps } from './textures'

/**
 * Blender exports plain glTF metal/rough. This upgrades the handful of
 * surfaces that carry the look — the clearcoat on the shell, the perforation
 * detail on the mesh, the anisotropy on the hinge — and wires them up for the
 * x-ray transition.
 */

type Dressed = MeshStandardMaterial | MeshPhysicalMaterial

export interface Skin {
  /** Shell and lid: the surfaces that must read as one polished piece. */
  shells: MeshPhysicalMaterial[]
  /** Everything that should dissolve when the camera goes inside. */
  fading: MeshPhysicalMaterial[]
  /** Internal components — they stay solid, but get lit differently. */
  internals: MeshStandardMaterial[]
  /** The emissive status light. */
  led: MeshStandardMaterial | null
  /** Every lit surface, for the one place the environment is applied. */
  lit: Dressed[]
  clip: Plane
}

const SHELL_NAMES = /^(Shell|Spout)_/
const CASE_SHELL = /^(Boitier_Corps|Boitier_Couvercle)$/
const MESH_NAMES = /^GrilleSpeaker_/
const VENT_NAMES = /^VentBack_/
const PORT_NAMES = /^MicPortTop_/
const INSERT = /^Boitier_Logement$/
const CASE_CONTACT = /^Boitier_Contact_/

/**
 * Not paper white.
 *
 * An 0.96-albedo shell under ACES has almost nothing left above it: the lit
 * side and the highlight land on the same output value and the form stops
 * reading. Sitting the base a little under white keeps the specular the
 * brightest thing on the product, which is what makes a white object look
 * polished rather than like a white silhouette.
 */
const WHITE = new Color('#eeeef1')
const CASE_WHITE = new Color('#ececef')

/**
 * Fresnel x-ray.
 *
 * Plain opacity makes a shell look like a weak ghost and loses its shape
 * entirely; real transmission is expensive and, on a near-white shell, mostly
 * reads as milk. What actually works is what a medical x-ray does: the
 * surfaces facing you go almost clear so the parts behind them show, while
 * the grazing edges stay solid so the object keeps its silhouette.
 */
function patchXray(m: MeshPhysicalMaterial) {
  const uniforms = { uXray: { value: 0 } }
  m.userData.xray = uniforms
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uXray = uniforms.uXray
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uXray;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         if (uXray > 0.0) {
           float facing = abs(dot(normalize(vNormal), normalize(vViewPosition)));
           // 1 at the silhouette, ~0 face-on
           float edge = pow(1.0 - facing, 2.2);
           float clear = mix(1.0, 0.055 + edge * 1.25, uXray);
           gl_FragColor.a *= clamp(clear, 0.0, 1.0);
           // the rim picks up a little extra light, the way glass does
           gl_FragColor.rgb += edge * uXray * 0.16;
         }`,
      )
  }
  m.customProgramCacheKey = () => 'xray'
}

/**
 * How much of the studio a surface catches, before exposure.
 *
 * Kept in userData because the live envMapIntensity is this value times the
 * current exposure — see setEnvironment. Writing the intensity directly
 * anywhere else is overwritten on the next frame.
 */
function catches(m: Dressed, amount: number) {
  m.userData.envBase = amount
  m.envMapIntensity = amount
}

function upgradeToPhysical(mesh: Mesh, hi: boolean): MeshPhysicalMaterial {
  const src = mesh.material as MeshStandardMaterial
  const m = new MeshPhysicalMaterial({
    color: src.color,
    roughness: src.roughness,
    metalness: src.metalness,
    map: src.map ?? null,
  })
  m.name = src.name
  catches(m, 1)
  if (hi) {
    m.clearcoat = 1
    // The coat is where the sharp reflection lives — an order of magnitude
    // tighter than the substrate beneath it. That separation is the point of
    // a clearcoat, and it is what lacquered plastic actually does: one crisp
    // highlight riding on a soft one.
    m.clearcoatRoughness = 0.035
  }
  patchXray(m)
  mesh.material = m
  return m
}

/** Walk a loaded model and bring every surface up to product-render quality. */
export function dressModel(root: Object3D, hi: boolean): Skin {
  const maps = perforationMaps(hi)
  const skin: Skin = {
    shells: [],
    fading: [],
    internals: [],
    led: null,
    lit: [],
    clip: new Plane(new Vector3(0, 0, -1), 1e4),
  }

  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false

    const name = mesh.name
    const mat = mesh.material as MeshStandardMaterial

    // The four case contacts sit right where the moulded insert's rounded
    // corner pulls in from the shell's own bounding box, and at full size
    // one on the left pokes through that curved surface — visible from
    // outside the closed case. Shrinking them slightly, in place, clears it
    // without having to guess a directional nudge for a corner condition.
    if (CASE_CONTACT.test(name)) {
      mesh.scale.multiplyScalar(0.6)
    }

    if (SHELL_NAMES.test(name) || CASE_SHELL.test(name)) {
      const m = upgradeToPhysical(mesh, hi)
      m.color.copy(CASE_SHELL.test(name) ? CASE_WHITE : WHITE)
      // The substrate is not a mirror — it is pigmented plastic, and it
      // scatters. Polishing it to 0.12 *and* putting a tight coat on top gave
      // two near-identical speculars stacked on each other, which is the
      // signature of a render rather than a photograph. The diffuse body
      // stays soft; the coat above it does the reflecting.
      m.roughness = hi ? 0.28 : 0.15
      m.metalness = 0
      catches(m, 1.15)
      // Only a trace of sheen. More than this lifts every grazing angle at
      // once, which turns the whole silhouette into one flat bright rim.
      m.sheen = 0.1
      m.sheenRoughness = 0.55
      m.sheenColor = new Color('#ffffff')
      m.ior = 1.52
      m.side = FrontSide
      m.transparent = false
      m.userData.baseOpacity = 1
      skin.shells.push(m)
      skin.fading.push(m)
      skin.lit.push(m)
      return
    }

    if (INSERT.test(name)) {
      const m = upgradeToPhysical(mesh, false)
      // Was 0.45 — glossy enough that the wells' own shape mostly read from
      // specular highlights rather than shading, which flattened the stem
      // channel into the same soft bowl as the head pocket. More matte
      // lets the actual geometry carry the read, closer to the real
      // moulded insert's finish.
      m.roughness = 0.6
      // A touch below the shell that surrounds it. A moulded insert is a
      // separate part in a separate finish; matching it exactly to the shell
      // is what makes the inside of a case read as one printed lump.
      m.color.set('#e4e4e8')
      catches(m, 0.7)
      skin.fading.push(m)
      skin.lit.push(m)
      return
    }

    if (MESH_NAMES.test(name) || VENT_NAMES.test(name) || PORT_NAMES.test(name)) {
      const set = MESH_NAMES.test(name)
        ? maps.mesh
        : VENT_NAMES.test(name)
          ? maps.vent
          : maps.port
      // Dark, but never black: a woven metal mesh returns a lot of specular
      // from its land areas, and the holes read as holes only if there is
      // something around them catching light.
      const m = new MeshPhysicalMaterial({
        color: new Color(MESH_NAMES.test(name) ? '#33343a' : '#26272c'),
        roughness: 0.42,
        metalness: 0.75,
        normalMap: set.normal,
        roughnessMap: set.roughness,
        aoMap: set.ao,
        aoMapIntensity: 0.65,
        side: DoubleSide,
      })
      m.normalScale.set(1.1, 1.1)
      catches(m, 1.35)
      m.name = mat.name
      patchXray(m)
      mesh.material = m
      if (mesh.geometry.attributes.uv && !mesh.geometry.attributes.uv1) {
        mesh.geometry.setAttribute('uv1', mesh.geometry.attributes.uv)
      }
      skin.fading.push(m)
      skin.lit.push(m)
      return
    }

    // The four charging contacts. Tried real gold here, matching the copy
    // ("quatre contacts dorés") — but at the seam between the lid and body
    // there's a sliver where a contact reads as poking through the outer
    // shell, and gold is exactly saturated enough to make that obvious
    // where the stock silver used to hide it. Reverted until that seam gap
    // itself is fixed; a small metalness/roughness bump only, still under
    // the shell's own colour so it doesn't stand out from the outside.
    if (mat?.name === 'M_Contact') {
      if ('metalness' in mat) (mat as MeshStandardMaterial).metalness = 1
      if ('roughness' in mat) (mat as MeshStandardMaterial).roughness = 0.32
      catches(mat, 1.1)
      skin.internals.push(mat)
      skin.lit.push(mat)
      return
    }

    if (mat?.name === 'M_LED') {
      mat.emissiveIntensity = 2.2
      mat.toneMapped = false
      skin.led = mat
      return
    }

    // Internal components: keep them standard, they are never the hero surface.
    catches(mat, 0.65)
    skin.internals.push(mat)
    skin.lit.push(mat)
  })

  return skin
}

/**
 * Bind the studio to the product, and grade it.
 *
 * Three only honours a material's own envMapIntensity when that material
 * carries its own envMap; for a surface lit purely by scene.environment the
 * renderer overwrites the uniform with scene.environmentIntensity on every
 * frame. Every authored value above — the shell catching more of the room
 * than the components buried inside it — was therefore being thrown away,
 * and the score's exposure channel never reached the environment at all,
 * even though the environment is where nearly all the light on a glossy
 * white shell comes from. Pointing each material at the same texture hands
 * those values back, at the cost of applying the exposure here.
 *
 * `rotation` turns the reflections with the light rig. The panels are baked
 * into a cubemap once, so rotating the group they are declared in moves
 * nothing: without this the directional lights swept across the product and
 * the authored highlight in the shell sat perfectly still.
 */
export function setEnvironment(
  skin: Skin,
  env: Texture | null,
  gain: number,
  rotation: number,
) {
  for (const m of skin.lit) {
    if (m.envMap !== env) m.envMap = env
    m.envMapIntensity = (m.userData.envBase as number) * gain
    m.envMapRotation.y = rotation
  }
}

/**
 * Drive the x-ray transition. `amount` 0 → solid, 1 → glass.
 *
 * The fade itself lives in the shader (see patchXray); all this does is
 * switch the material into a transparent, non-depth-writing state so the
 * components behind it are actually drawn, and switch it back cleanly.
 */
export function setXray(mats: MeshPhysicalMaterial[], amount: number) {
  const a = Math.max(0, Math.min(1, amount))
  for (const m of mats) {
    const u = m.userData.xray as { uXray: { value: number } } | undefined
    if (u) u.uXray.value = a
    const wantTransparent = a > 0.004
    if (m.transparent !== wantTransparent) {
      m.transparent = wantTransparent
      m.needsUpdate = true
    }
    // Writing depth while translucent would hide everything behind it, which
    // is the one thing this effect exists to avoid.
    m.depthWrite = !wantTransparent
  }
}

/** The margin kept between the lens and any surface it passes through. The
 *  camera's near plane uses the same number, so the two agree about where
 *  the front of the lens is. */
export const LENS_MARGIN = 0.02

/**
 * Cut the shell away at the camera plane so the camera can pass through it.
 * Without this the lens simply ends up inside a closed surface and the frame
 * goes black.
 */
export function setClip(
  skin: Skin,
  active: number,
  camPos: Vector3,
  camDir: Vector3,
) {
  const on = active > 0.01
  skin.clip.normal.copy(camDir)
  // keep everything more than a hair in front of the lens
  skin.clip.constant = -camDir.dot(camPos) - LENS_MARGIN
  for (const m of skin.fading) {
    const planes = on ? [skin.clip] : null
    if (m.clippingPlanes !== planes) {
      m.clippingPlanes = planes
      m.side = on ? DoubleSide : FrontSide
      m.needsUpdate = true
    }
  }
}
