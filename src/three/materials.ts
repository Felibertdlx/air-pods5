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
} from 'three'
import { perforationMaps } from './textures'

/**
 * Blender exports plain glTF metal/rough. This upgrades the handful of
 * surfaces that carry the look — the clearcoat on the shell, the perforation
 * detail on the mesh, the anisotropy on the hinge — and wires them up for the
 * x-ray transition.
 */

export interface Skin {
  /** Shell and lid: the surfaces that must read as one polished piece. */
  shells: MeshPhysicalMaterial[]
  /** Everything that should dissolve when the camera goes inside. */
  fading: MeshPhysicalMaterial[]
  /** Internal components — they stay solid, but get lit differently. */
  internals: MeshStandardMaterial[]
  /** The emissive status light. */
  led: MeshStandardMaterial | null
  clip: Plane
}

const SHELL_NAMES = /^(Shell|Spout)_/
const CASE_SHELL = /^(Boitier_Corps|Boitier_Couvercle)$/
const MESH_NAMES = /^GrilleSpeaker_/
const VENT_NAMES = /^VentBack_/
const PORT_NAMES = /^MicPortTop_/
const INSERT = /^Boitier_Logement$/

const WHITE = new Color('#f6f6f7')
const CASE_WHITE = new Color('#f4f4f6')

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

function upgradeToPhysical(mesh: Mesh, hi: boolean): MeshPhysicalMaterial {
  const src = mesh.material as MeshStandardMaterial
  const m = new MeshPhysicalMaterial({
    color: src.color,
    roughness: src.roughness,
    metalness: src.metalness,
    map: src.map ?? null,
  })
  m.name = src.name
  m.envMapIntensity = 1
  if (hi) {
    m.clearcoat = 1
    m.clearcoatRoughness = 0.055
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

    if (SHELL_NAMES.test(name) || CASE_SHELL.test(name)) {
      const m = upgradeToPhysical(mesh, hi)
      m.color.copy(CASE_SHELL.test(name) ? CASE_WHITE : WHITE)
      m.roughness = 0.12
      m.metalness = 0
      m.envMapIntensity = 1.15
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
      m.color.set('#e7e7ea')
      m.envMapIntensity = 0.7
      skin.fading.push(m)
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
      m.envMapIntensity = 1.35
      m.name = mat.name
      patchXray(m)
      mesh.material = m
      if (mesh.geometry.attributes.uv && !mesh.geometry.attributes.uv1) {
        mesh.geometry.setAttribute('uv1', mesh.geometry.attributes.uv)
      }
      skin.fading.push(m)
      return
    }

    // The four charging contacts — real gold, not the source file's default
    // silver, matching the copy ("quatre contacts dorés") and giving the
    // wells something for the eye to land on, the way the real case's do.
    if (mat?.name === 'M_Contact') {
      mat.color.set('#d4af6a')
      if ('metalness' in mat) (mat as MeshStandardMaterial).metalness = 1
      if ('roughness' in mat) (mat as MeshStandardMaterial).roughness = 0.32
      mat.envMapIntensity = 1.4
      skin.internals.push(mat)
      return
    }

    if (mat?.name === 'M_LED') {
      mat.emissiveIntensity = 2.2
      mat.toneMapped = false
      skin.led = mat
      return
    }

    // Internal components: keep them standard, they are never the hero surface.
    mat.envMapIntensity = 0.65
    skin.internals.push(mat)
  })

  return skin
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
  skin.clip.constant = -camDir.dot(camPos) - 0.02
  for (const m of skin.fading) {
    const planes = on ? [skin.clip] : null
    if (m.clippingPlanes !== planes) {
      m.clippingPlanes = planes
      m.side = on ? DoubleSide : FrontSide
      m.needsUpdate = true
    }
  }
}

