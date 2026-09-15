import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  NormalBlending,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three'
import { POD } from '../anatomy'
import { read } from '../signal'

/**
 * The inverse of the speaker: particles fall inward from the surrounding air
 * and converge on the two microphone ports. Each one starts on a sphere around
 * its target and spirals in, so the movement reads as "being gathered" rather
 * than as rain.
 */

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uAmount;
  uniform float uSize;
  uniform vec3  uTargetA;
  uniform vec3  uTargetB;

  attribute float aSeed;
  attribute float aPhase;
  attribute float aSide;     // 0 → top mic, 1 → stem mic

  varying float vFade;

  void main() {
    vec3 target = mix(uTargetA, uTargetB, aSide);

    // 1 at the far edge, 0 at the port
    float travel = 1.0 - fract(uTime * (0.068 + aSeed * 0.04) + aPhase);

    // spiral: rotate the start offset about the inward direction as it closes
    float ang = (1.0 - travel) * (3.4 + aSeed * 2.2);
    float c = cos(ang), s = sin(ang);
    vec3 o = position;
    vec3 spun = vec3(o.x * c - o.z * s, o.y, o.x * s + o.z * c);

    // ease so particles slow into the port instead of hitting it
    float r = travel * travel;
    vec3 pos = target + spun * r * (1.6 * uAmount + 0.2);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // bright just before arrival, gone at the far edge
    float near = 1.0 - travel;
    vFade = smoothstep(0.0, 0.25, near) * (1.0 - smoothstep(0.82, 1.0, near)) * uAmount;
    gl_PointSize = uSize * (0.4 + aSeed * 0.8) * (0.55 + near * 0.9) / -mv.z;
  }
`

const fragment = /* glsl */ `
  uniform vec3  uColour;
  uniform float uGain;
  varying float vFade;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = dot(uv, uv);
    if (d > 0.25) discard;
    float a = 1.0 - d * 4.0;
    gl_FragColor = vec4(uColour, a * a * a * vFade * uGain);
  }
`

interface Props {
  count: number
  colour: string
  /** Additive light reads on a dark ground; on a light one it vanishes. */
  additive: boolean
}

export function MicIntake({ count, colour, additive }: Props) {
  const points = useRef<Points>(null)

  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    const phase = new Float32Array(count)
    const side = new Float32Array(count)
    const p = new Vector3()

    for (let i = 0; i < count; i++) {
      // uniform direction on a sphere, radius carried by the shader
      const u = Math.random() * 2 - 1
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(1 - u * u)
      p.set(r * Math.cos(a), u * 0.75, r * Math.sin(a))
      pos[i * 3] = p.x
      pos[i * 3 + 1] = p.y
      pos[i * 3 + 2] = p.z
      seed[i] = Math.random()
      phase[i] = Math.random()
      side[i] = i % 3 === 0 ? 1 : 0 // most of the field feeds the top mic
    }

    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new Float32BufferAttribute(seed, 1))
    g.setAttribute('aPhase', new Float32BufferAttribute(phase, 1))
    g.setAttribute('aSide', new Float32BufferAttribute(side, 1))
    g.boundingSphere = null
    return g
  }, [count])

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uAmount: { value: 0 },
          uSize: { value: 85 },
          uTargetA: { value: POD.micTop.clone() },
          uTargetB: { value: POD.stemTip.clone().add(new Vector3(0, 0.55, -0.2)) },
          uColour: { value: new Color('#ffffff') },
          uGain: { value: 0.9 },
        },
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  )

  useEffect(() => {
    material.uniforms.uColour.value.set(colour)
    material.blending = additive ? AdditiveBlending : NormalBlending
    material.uniforms.uGain.value = additive ? 0.3 : 0.9
    material.needsUpdate = true
  }, [material, colour, additive])

  useFrame((state) => {
    const s = read()
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uAmount.value = s.fxMic
    if (points.current) points.current.visible = s.fxMic > 0.01
  })

  return (
    <points ref={points} geometry={geometry} material={material} frustumCulled={false} />
  )
}
