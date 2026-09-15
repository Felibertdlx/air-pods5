import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  CatmullRomCurve3,
  Color,
  Group,
  NormalBlending,
  ShaderMaterial,
  TubeGeometry,
  Vector3,
} from 'three'
import { POD } from '../anatomy'
import { read } from '../signal'

/**
 * Two related ideas share one implementation: data moving around the board,
 * and charge moving from the cell to the contacts. Both are drawn as hairline
 * tubes with a pulse running along them — no dashboards, no readouts, nothing
 * that looks like a heads-up display.
 *
 * Tubes rather than lines: a line has no thickness in WebGL beyond one pixel,
 * which looks cheap under a macro lens and disappears entirely on a high-DPR
 * screen.
 */

const vertex = /* glsl */ `
  varying float vU;
  varying float vRim;
  void main() {
    vU = uv.x;
    vec3 n = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // brighter where the tube turns away, so it reads as round
    vRim = 1.0 - abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`

const fragment = /* glsl */ `
  uniform float uTime;
  uniform float uAmount;
  uniform float uSpeed;
  uniform float uPulses;
  uniform vec3  uColour;
  varying float vU;
  varying float vRim;

  void main() {
    // the constant hairline that shows the route exists at all
    float base = 0.16;

    // travelling pulses along the tube
    float p = fract(vU * uPulses - uTime * uSpeed);
    float pulse = pow(1.0 - p, 12.0);

    // fade both ends so the tube does not stop abruptly in mid-air
    float ends = smoothstep(0.0, 0.06, vU) * (1.0 - smoothstep(0.94, 1.0, vU));

    float a = (base + pulse * 1.6) * ends * uAmount * (0.45 + vRim * 0.8);
    gl_FragColor = vec4(uColour * (0.6 + pulse * 1.8), a);
  }
`

function tube(points: Vector3[], radius: number, segments: number) {
  const curve = new CatmullRomCurve3(points, false, 'catmullrom', 0.4)
  return new TubeGeometry(curve, segments, radius, 6, false)
}

interface Props {
  colour: string
  /** Additive light reads on a dark ground; on a light one it vanishes. */
  additive: boolean
}

export function Circuit({ colour, additive }: Props) {
  const dataGroup = useRef<Group>(null)
  const energyGroup = useRef<Group>(null)

  const makeMaterial = (speed: number, pulses: number) =>
    new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAmount: { value: 0 },
        uSpeed: { value: speed },
        uPulses: { value: pulses },
        uColour: { value: new Color('#ffffff') },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })

  const { dataGeos, energyGeos, dataMat, energyMat } = useMemo(() => {
    const board = POD.board
    const chip = board.clone().add(new Vector3(0.18, 0.28, 0.06))

    // Traces fanning across the board, on the board's own plane.
    const dataGeos = [-0.12, -0.04, 0.04, 0.12].map((z, i) => {
      const a = board.clone().add(new Vector3(-0.05, -0.62, z))
      const b = board.clone().add(new Vector3(-0.02, -0.18 + i * 0.03, z * 1.3))
      const c = chip.clone().add(new Vector3(0, -0.04 + i * 0.02, z * 0.5))
      return tube([a, b, c], 0.0055, 44)
    })
    // A short loop around the chip: the signal arriving and leaving.
    dataGeos.push(
      tube(
        [
          chip.clone().add(new Vector3(0.02, 0.1, -0.1)),
          chip.clone().add(new Vector3(0.05, 0.16, 0)),
          chip.clone().add(new Vector3(0.02, 0.1, 0.1)),
        ],
        0.005,
        30,
      ),
    )

    // Charge: cell in the head → down the stem → contacts at the tip.
    const energyGeos = [-0.05, 0.05].map((z) =>
      tube(
        [
          POD.battery.clone().add(new Vector3(0, -0.06, z)),
          POD.battery.clone().add(new Vector3(-0.1, -0.5, z)),
          board.clone().add(new Vector3(0.03, 0.2, z)),
          board.clone().add(new Vector3(0.02, -0.4, z)),
          POD.stemTip.clone().add(new Vector3(0, 0.18, z)),
        ],
        0.0062,
        70,
      ),
    )

    return {
      dataGeos,
      energyGeos,
      dataMat: makeMaterial(0.3, 3),
      energyMat: makeMaterial(0.15, 1.6),
    }
  }, [])

  useEffect(() => {
    for (const m of [dataMat, energyMat]) {
      m.uniforms.uColour.value.set(colour)
      m.blending = additive ? AdditiveBlending : NormalBlending
      m.needsUpdate = true
    }
  }, [dataMat, energyMat, colour, additive])

  useFrame((state) => {
    const s = read()
    const t = state.clock.elapsedTime
    dataMat.uniforms.uTime.value = t
    energyMat.uniforms.uTime.value = t
    dataMat.uniforms.uAmount.value = s.fxData
    energyMat.uniforms.uAmount.value = s.fxEnergy
    if (dataGroup.current) dataGroup.current.visible = s.fxData > 0.01
    if (energyGroup.current) energyGroup.current.visible = s.fxEnergy > 0.01
  })

  return (
    <>
      <group ref={dataGroup}>
        {dataGeos.map((g, i) => (
          <mesh key={i} geometry={g} material={dataMat} frustumCulled={false} />
        ))}
      </group>
      <group ref={energyGroup}>
        {energyGeos.map((g, i) => (
          <mesh key={i} geometry={g} material={energyMat} frustumCulled={false} />
        ))}
      </group>
    </>
  )
}
