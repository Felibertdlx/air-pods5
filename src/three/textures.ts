import { CanvasTexture, RepeatWrapping, type Texture } from 'three'

/**
 * The acoustic mesh and the vent are modelled as smooth surfaces — the holes
 * are far too small to carry as geometry. They are generated here instead, as
 * a matched roughness / normal / occlusion set, so a macro shot shows real
 * perforations catching the light rather than a flat grey oval.
 */

function makeCanvas(size: number) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return c
}

function finish(c: HTMLCanvasElement, repeat: number): Texture {
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}

interface Grid {
  /** Holes across the tile. */
  count: number
  /** Hole radius as a fraction of the cell. */
  radius: number
  /** Stagger alternate rows, as a real perforation pattern does. */
  stagger: boolean
}

/** Height field: 0 = hole (deep), 1 = land (surface). */
function heightField(size: number, g: Grid): Float32Array {
  const data = new Float32Array(size * size)
  const cell = size / g.count
  const r = cell * g.radius
  const soft = cell * 0.09

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const row = Math.floor(y / cell)
      const shift = g.stagger && row % 2 === 1 ? cell * 0.5 : 0
      const cx = (Math.floor((x - shift) / cell) + 0.5) * cell + shift
      const cy = (row + 0.5) * cell
      const d = Math.hypot(x - cx, y - cy)
      // smooth edge so the normal map does not alias at grazing angles
      const h = Math.min(1, Math.max(0, (d - r) / soft + 0.5))
      data[y * size + x] = h
    }
  }
  return data
}

function toNormal(h: Float32Array, size: number, strength: number) {
  const c = makeCanvas(size)
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const at = (x: number, y: number) =>
    h[((y + size) % size) * size + ((x + size) % size)]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const len = Math.hypot(dx, dy, 1)
      const i = (y * size + x) * 4
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255
      img.data[i + 2] = (1 / len) * 0.5 * 255 + 127.5
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

function toGrey(
  h: Float32Array,
  size: number,
  lo: number,
  hi: number,
  grain = 0,
) {
  const c = makeCanvas(size)
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(size, size)
  for (let i = 0; i < h.length; i++) {
    const n = grain ? (Math.random() - 0.5) * grain : 0
    const value = Math.max(0, Math.min(1, lo + (hi - lo) * h[i] + n)) * 255
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = value
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return c
}

export interface PerforationMaps {
  normal: Texture
  roughness: Texture
  ao: Texture
}

function perforation(size: number, grid: Grid, repeat: number, strength: number): PerforationMaps {
  const h = heightField(size, grid)
  return {
    normal: finish(toNormal(h, size, strength), repeat),
    // holes read as matte and dark, the land between them stays satin
    roughness: finish(toGrey(h, size, 0.95, 0.42, 0.03), repeat),
    ao: finish(toGrey(h, size, 0.18, 1.0), repeat),
  }
}

let cached: Record<string, PerforationMaps> | null = null

export function perforationMaps(hi: boolean) {
  if (cached) return cached
  const size = hi ? 512 : 256
  cached = {
    /** The speaker mesh: dense, staggered, very fine. */
    mesh: perforation(size, { count: 34, radius: 0.31, stagger: true }, 5, 3.2),
    /** The pressure vent: a coarser slotted grid. */
    vent: perforation(size, { count: 20, radius: 0.26, stagger: false }, 3, 2.6),
    /** Microphone ports: a single tight cluster. */
    port: perforation(size, { count: 12, radius: 0.3, stagger: true }, 1.6, 2.2),
  }
  return cached
}

/** A soft round falloff, used for particle sprites and light blooms. */
export function radialSprite(size = 128, power = 2.4): Texture {
  const c = makeCanvas(size)
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const mid = (size - 1) / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - mid, y - mid) / mid
      const a = Math.pow(Math.max(0, 1 - d), power)
      const i = (y * size + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
      img.data[i + 3] = a * 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const t = new CanvasTexture(c)
  t.needsUpdate = true
  return t
}
