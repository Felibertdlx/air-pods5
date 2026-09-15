import { Environment, Lightformer } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import type { AmbientLight, DirectionalLight, Group } from 'three'
import type { Profile } from '../lib/quality'
import type { Theme } from '../state/store'
import { envLevel, intro, read } from './signal'

/**
 * A five-light product rig, plus an environment built from emissive panels
 * rather than an HDRI file. Panels mean the reflections in the shell are
 * authored — you can see where the softbox is — and nothing has to be
 * downloaded.
 */

interface Props {
  profile: Profile
  theme: Theme
}

export function Studio({ profile, theme }: Props) {
  const scene = useThree((s) => s.scene)
  const rig = useRef<Group>(null)
  const key = useRef<DirectionalLight>(null)
  const rim = useRef<DirectionalLight>(null)
  const fill = useRef<DirectionalLight>(null)
  const top = useRef<DirectionalLight>(null)
  const amb = useRef<AmbientLight>(null)

  const dark = theme === 'dark'

  useFrame((_, dt) => {
    const s = read()
    // The rig turns slowly enough that the highlight sweeping across the shell
    // is a movement you notice rather than a change you catch after the fact.
    const k = 1 - Math.pow(0.05, dt)

    if (rig.current) {
      rig.current.rotation.y += (s.lightAngle - rig.current.rotation.y) * k
    }

    // Hard lights are kept modest in both moods: most of the light on a glossy
    // white shell arrives from the environment panels, and stacking bright
    // directionals on top of that is what turns it into a featureless blob.
    // Dark is not "the same scene turned down" — it is a black room with
    // harder sources, so the product stays the brightest thing in frame.
    // The opening beat fades the rig in from dark rather than the product
    // simply appearing lit — everything below already scales off `e`, so
    // folding the intro in here is the one place it needs to happen.
    const e = s.exposure * intro.ease
    if (amb.current) amb.current.intensity = (dark ? 0.04 : 0.07) * intro.ease
    if (key.current) key.current.intensity = (dark ? 1.5 : 2.5) * e
    // Fill and ambient are what flatten a white product. Kept low on purpose:
    // the shadow side is allowed to go genuinely dark, which is where the
    // contrast comes from.
    if (fill.current) fill.current.intensity = (dark ? 0.14 : 0.3) * e
    // The top light is the one that clips on a high-angle shot of the lid, so
    // it stays the weakest of the four.
    if (top.current) top.current.intensity = (dark ? 0.32 : 0.4) * e
    if (rim.current) rim.current.intensity = (dark ? 1.9 : 0.75) * e * s.rim

    // The environment is a light too, and the dominant one on a glossy shell.
    // Leaving it at full brightness while the four directionals faded up meant
    // the opening beat was only ever a partial fade: the product arrived
    // already wearing its reflections. The product's own materials carry the
    // authored per-surface version of this (see materials.setEnvironment) —
    // this covers the few frames before those are bound, and anything in the
    // scene that is not part of the product.
    scene.environmentIntensity = envLevel(s.exposure)
  })

  return (
    <>
      <ambientLight ref={amb} intensity={dark ? 0.04 : 0.07} />

      <group ref={rig}>
        {/*
          Key — high and to the left, the one that shapes the form.
          Warm by a hair. A white object lit by one neutral source is a grey
          gradient; splitting the key warm against a cool fill is what gives
          the shadow side a different colour from the lit side, which is how
          the eye reads curvature on something this featureless.
        */}
        <directionalLight
          ref={key}
          position={[-7.5, 9.5, 7]}
          intensity={2.6}
          color={dark ? '#fff4e6' : '#fff6ec'}
          castShadow={profile.shadows}
          shadow-mapSize={[profile.contact || 512, profile.contact || 512]}
          shadow-camera-near={1}
          shadow-camera-far={40}
          shadow-camera-left={-9}
          shadow-camera-right={9}
          shadow-camera-top={9}
          shadow-camera-bottom={-9}
          shadow-bias={-0.0006}
          shadow-normalBias={0.02}
        />
        {/* Fill — opposite, much softer, and cool against the warm key */}
        <directionalLight
          ref={fill}
          position={[8, 2.5, 6]}
          intensity={0.85}
          color={dark ? '#dce7ff' : '#eaf0ff'}
        />
        {/* Top — the long specular running down the lid */}
        <directionalLight ref={top} position={[0.5, 12, -1]} intensity={1.15} />
        {/*
          Rim — behind and high, carves the edge away from the ground.
          A directional rather than a spot: a spot's inverse-square falloff
          would make the rim depend on how far the shot happens to be, and this
          camera travels from a few centimetres to a couple of metres.
        */}
        <directionalLight
          ref={rim}
          position={[3.2, 5.5, -12]}
          intensity={2.2}
          color={dark ? '#d6e8ff' : '#ffffff'}
        />
      </group>

      {/*
        The environment is the actual studio. A mid-grey room with bright
        panels floating in it is what gives a white glossy surface its
        gradient: dark where it reflects the room, bright where it reflects a
        softbox. A uniformly bright environment would flatten it.

        Deliberately *outside* the rig group. The panels are rasterised into a
        cubemap once (frames={1}) and that map is applied in world space, so a
        transform on the group they are declared in does nothing at all —
        nesting it here only ever implied a sweep it could not perform. The
        reflections are turned with the rig by rotating the map itself, on the
        product's own materials.
      */}
      <Environment resolution={profile.envRes} frames={1}>
        {/* A darker room in both moods: the gap between the panels and the
            room is the contrast, and a bright room closes that gap. */}
        <color attach="background" args={[dark ? '#050507' : '#3d3d45']} />
        {/* the big softbox that draws the long highlight down the shell */}
        <Lightformer
          form="rect"
          intensity={dark ? 6 : 3.0}
          position={[-4.5, 6, 5]}
          rotation={[-0.5, -0.6, 0]}
          scale={[9, 5, 1]}
          color="#fff7ef"
        />
        {/* a narrow strip for the crisp edge highlight */}
        <Lightformer
          form="rect"
          intensity={dark ? 9 : 2.4}
          position={[6, 2.5, -5]}
          rotation={[0.2, 2.3, 0]}
          scale={[7, 0.8, 1]}
          color="#eaf2ff"
        />
        {/* a second, smaller box opposite, for the secondary specular —
            cool, so the two speculars are not the same white */}
        <Lightformer
          form="rect"
          intensity={dark ? 3.2 : 1.2}
          position={[5.5, 4.5, 4]}
          rotation={[-0.4, 0.7, 0]}
          scale={[3.4, 2.6, 1]}
          color="#eef3ff"
        />
        {/* cool bounce from below, so the underside is not a black hole */}
        <Lightformer
          form="rect"
          intensity={dark ? 0.7 : 0.45}
          position={[0, -5.5, 2]}
          rotation={[1.5, 0, 0]}
          scale={[10, 6, 1]}
          color={dark ? '#41527d' : '#e8ecf6'}
        />
        {/* ring behind the camera: something for the shell to reflect head-on */}
        <Lightformer
          form="ring"
          intensity={dark ? 2.4 : 0.8}
          position={[0, 1, 13]}
          scale={[7, 7, 1]}
          color="#ffffff"
        />
      </Environment>
    </>
  )
}
