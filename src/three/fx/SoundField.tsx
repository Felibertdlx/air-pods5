import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  NormalBlending,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three'
import { POD } from '../anatomy'
import { read } from '../signal'

/**
 * Sound, as displaced air rather than as a bar graph.
 *
 * Particles are seeded on a disc across the speaker mesh and pushed out along
 * the acoustic axis by a travelling wave. Because the wave is evaluated per
 * vertex in the shader, the whole field is one draw call and the motion is
 * continuous rather than stepped.
 */

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uAmount;
  uniform float uSize;
  uniform vec3  uAxis;
  uniform vec3  uOrigin;

  attribute float aSeed;
  attribute float aRing;      // 0..1 across the emitter disc
  attribute float aPhase;

  varying float vFade;
  varying float vRing;

  void main() {
    // travel: each particle repeatedly walks out along the axis
    float speed = 0.55 + aSeed * 0.35;
    float travel = fract(uTime * speed * 0.125 + aPhase);

    // a wavefront rather than a cloud: narrow crests, most of the field dark
    float crest = smoothstep(0.0, 0.06, travel) * (1.0 - smoothstep(0.45, 1.0, travel));
    float ripple = pow(0.5 + 0.5 * sin(travel * 26.0 - uTime * 1.5), 2.0);

    vec3 pos = position;
    pos += uAxis * (travel * 3.4 * uAmount);

    // The beam widens as it leaves the mesh. Measured from the emitter, not
    // from the model origin — about the origin it would drift off to one side.
    float spread = 1.0 + travel * 1.35;
    vec3 rel = pos - uOrigin;
    vec3 radial = rel - uAxis * dot(rel, uAxis);
    pos += radial * (spread - 1.0);

    // a slight lateral wobble keeps it from looking like a machine
    pos += vec3(
      sin(uTime * 0.5 + aSeed * 12.0),
      cos(uTime * 0.4 + aSeed * 9.0),
      sin(uTime * 0.6 + aSeed * 7.0)
    ) * 0.014 * travel;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float atten = 1.0 - travel;
    vFade = crest * ripple * atten * atten * uAmount;
    vRing = aRing;
    gl_PointSize = uSize * (0.35 + aSeed * 0.9) * (1.0 + travel * 0.7) / -mv.z;
  }
`

const fragment = /* glsl */ `
  uniform vec3  uColour;
  uniform float uGain;
  varying float vFade;
  varying float vRing;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = dot(uv, uv);
    if (d > 0.25) discard;
    float a = (1.0 - d * 4.0);
    a *= a * a;
    // the outer ring of the emitter is dimmer, so the beam has a soft edge
    gl_FragColor = vec4(uColour, a * vFade * (1.0 - vRing * 0.55) * uGain);
  }
`

interface Props {
  count: number
  colour: string
  /** Additive light reads on a dark ground; on a light one it vanishes. */
  additive: boolean
}

export function SoundField({ count, colour, additive }: Props) {
  const points = useRef<Points>(null)

  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    const ring = new Float32Array(count)
    const phase = new Float32Array(count)

    // Build an orthonormal frame on the acoustic axis so the emitter disc
    // actually lies in the plane of the speaker mesh.
    const axis = POD.axis.clone()
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), axis)
    const p = new Vector3()

    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(Math.random()) * 0.3
      const a = Math.random() * Math.PI * 2
      p.set(Math.cos(a) * r, Math.sin(a) * r, 0).applyQuaternion(q).add(POD.grille)
      pos[i * 3] = p.x
      pos[i * 3 + 1] = p.y
      pos[i * 3 + 2] = p.z
      seed[i] = Math.random()
      ring[i] = r / 0.3
      phase[i] = Math.random()
    }

    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new Float32BufferAttribute(seed, 1))
    g.setAttribute('aRing', new Float32BufferAttribute(ring, 1))
    g.setAttribute('aPhase', new Float32BufferAttribute(phase, 1))
    g.boundingSphere = null
    return g
  }, [count])

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uAmount: { value: 0 },
          uSize: { value: 110 },
          uAxis: { value: POD.axis.clone() },
          uOrigin: { value: POD.grille.clone() },
          uColour: { value: new Color('#ffffff') },
          uGain: { value: 0.85 },
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
    // Additive light accumulates where particles overlap; at the same alpha
    // the beam would clip to a solid slab instead of reading as a wavefront.
    material.uniforms.uGain.value = additive ? 0.22 : 0.85
    material.needsUpdate = true
  }, [material, colour, additive])

  useFrame((state) => {
    const s = read()
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uAmount.value = s.fxSound
    if (points.current) points.current.visible = s.fxSound > 0.01
  })

  return (
    <points ref={points} geometry={geometry} material={material} frustumCulled={false} />
  )
}
