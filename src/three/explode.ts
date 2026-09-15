import { Vector3, type Object3D } from 'three'
import { POD } from './anatomy'

/**
 * The exploded view. Each part keeps a logical spatial relationship with the
 * bud — the driver stack fans out along its own axis, the stem stack drops
 * down the stem's axis — so the diagram still reads as one object taken apart
 * rather than a scatter of shapes.
 */

export interface Part {
  node: Object3D
  home: Vector3
  offset: Vector3
  /** Parts arrive in order, which is what makes it read as a disassembly. */
  delay: number
  /** Small idle drift once separated. */
  float: number
  label: string
}

const AXIS = POD.axis.clone()
const DOWN = new Vector3(0, -1, 0)
/** Across the inner face, perpendicular to the driver axis. */
const SIDE = new Vector3().crossVectors(AXIS, new Vector3(0, 1, 0)).normalize()

interface Rule {
  match: RegExp
  dir: Vector3
  dist: number
  delay: number
  float?: number
}

const RULES: Rule[] = [
  // outer surfaces move furthest, first
  { match: /^Shell_/, dir: new Vector3(0, 0, 0), dist: 0, delay: 0, float: 0.1 },
  { match: /^Spout_/, dir: AXIS.clone().add(new Vector3(0, 0.9, 0)), dist: 2.3, delay: 0.0 },
  { match: /^GrilleSpeaker_/, dir: AXIS, dist: 1.55, delay: 0.04 },
  { match: /^VentBack_/, dir: AXIS.clone().negate(), dist: 1.5, delay: 0.06 },
  { match: /^MicPortTop_/, dir: AXIS.clone().add(SIDE), dist: 1.95, delay: 0.02 },

  // driver stack fans along the acoustic axis
  { match: /^Driver_Dome_/, dir: AXIS, dist: 1.15, delay: 0.1 },
  { match: /^Driver_Diaphragm_/, dir: AXIS, dist: 0.86, delay: 0.14 },
  { match: /^Driver_VoiceCoil_/, dir: AXIS, dist: 0.6, delay: 0.18 },
  { match: /^Driver_Basket_/, dir: AXIS, dist: 0.3, delay: 0.22 },
  { match: /^Driver_Magnet_/, dir: AXIS.clone().negate(), dist: 0.52, delay: 0.26 },
  { match: /^Battery_/, dir: AXIS.clone().negate(), dist: 1.25, delay: 0.3 },
  { match: /^Sensor_Skin_/, dir: SIDE.clone().negate(), dist: 1.1, delay: 0.24 },

  // stem stack drops and spreads
  { match: /^Logic_Board_/, dir: DOWN, dist: 0.55, delay: 0.34 },
  { match: /^SoC_/, dir: new Vector3(1, -0.55, 0.35).normalize(), dist: 1.3, delay: 0.4 },
  { match: /^Component_/, dir: new Vector3(-1, -0.7, 0.2).normalize(), dist: 1.15, delay: 0.44 },
  { match: /^Antenna_/, dir: new Vector3(-1, -0.2, 0.55).normalize(), dist: 1.5, delay: 0.38 },
  { match: /^Mic_Top_/, dir: new Vector3(1, 0.55, 0.3).normalize(), dist: 1.45, delay: 0.2 },
  { match: /^Mic_Bottom_/, dir: new Vector3(0.2, -0.5, -1).normalize(), dist: 1.35, delay: 0.42 },
  { match: /^Contact_/, dir: DOWN, dist: 1.4, delay: 0.48 },
]

const LABELS: Record<string, string> = {
  Shell: 'Enclosure',
  Spout: 'Acoustic spout',
  GrilleSpeaker: 'Speaker mesh',
  VentBack: 'Pressure vent',
  MicPortTop: 'Microphone port',
  Driver_Dome: 'Dust dome',
  Driver_Diaphragm: 'Diaphragm',
  Driver_VoiceCoil: 'Voice coil',
  Driver_Basket: 'Driver basket',
  Driver_Magnet: 'Neodymium magnet',
  Battery: 'Battery cell',
  Sensor_Skin: 'Skin-detect sensor',
  Logic_Board: 'Logic board',
  SoC: 'Wireless chip',
  Component: 'Passive components',
  Antenna: 'Bluetooth antenna',
  Mic_Top: 'Beamforming microphone',
  Mic_Bottom: 'Voice microphone',
  Contact: 'Charging contact',
}

function labelFor(name: string) {
  const base = name.replace(/_(L|R)$/, '').replace(/_\d+$/, '')
  return LABELS[base] ?? base.replace(/_/g, ' ')
}

/** Build the part table for one bud. `mirror` flips Z for the right bud. */
export function buildParts(root: Object3D, mirror: boolean): Part[] {
  const parts: Part[] = []
  root.traverse((o) => {
    if (!(o as { isMesh?: boolean }).isMesh) return
    const rule = RULES.find((r) => r.match.test(o.name))
    if (!rule) return
    const dir = rule.dir.clone()
    if (mirror) dir.z *= -1
    if (dir.lengthSq() > 1e-6) dir.normalize()
    parts.push({
      node: o,
      home: o.position.clone(),
      offset: dir.multiplyScalar(rule.dist),
      delay: rule.delay,
      float: rule.float ?? 0.5,
      label: labelFor(o.name),
    })
  })
  return parts
}

const tmp = new Vector3()

/**
 * Apply the explosion. `amount` 0 → assembled, 1 → fully apart; `time` drives
 * the idle float so separated parts are never completely still.
 */
export function applyExplode(parts: Part[], amount: number, time: number) {
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    // stagger: each part has its own window inside the overall progress
    const u = Math.max(0, Math.min(1, (amount - p.delay) / (1 - p.delay)))
    const e = u * u * (3 - 2 * u)
    tmp.copy(p.offset).multiplyScalar(e)
    if (e > 0.02 && p.float > 0) {
      const ph = i * 1.7
      tmp.y += Math.sin(time * 0.3 + ph) * 0.026 * p.float * e
      tmp.x += Math.cos(time * 0.23 + ph) * 0.019 * p.float * e
    }
    p.node.position.copy(p.home).add(tmp)
  }
}
