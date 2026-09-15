import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState } from 'react'
import { ACESFilmicToneMapping } from 'three'
import { useStore } from '../state/store'
import { InteractiveCase } from '../three/InteractiveCase'

/**
 * The Design tab's interactive figure: open and close the case, lift the
 * buds out and put them back, press the button, orbit and zoom freely.
 *
 * Mounts only near the viewport, same as the passive figures elsewhere on
 * the page — one extra WebGL context at a time, not one per section.
 */
export function DesignStudio() {
  const host = useRef<HTMLElement>(null)
  const [near, setNear] = useState(false)
  const [hotspot, setHotspot] = useState<string | null>(null)
  const theme = useStore((s) => s.theme)
  const tier = useStore((s) => s.tier)
  const dark = theme === 'dark'

  useEffect(() => {
    const el = host.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return
    }
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), {
      rootMargin: '25% 0px',
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <figure
      className="figure figure--live figure--wide figure--interactive"
      ref={host as never}
      aria-label="Le boîtier de charge, manipulable : glisser pour tourner, cliquer pour ouvrir, presser le bouton, retirer les écouteurs"
      role="img"
    >
      <div className="figure__frame">
        {near ? (
          <Canvas
            dpr={tier === 'low' ? 1 : [1, 1.75]}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: 'low-power',
              toneMapping: ACESFilmicToneMapping,
              toneMappingExposure: 1,
            }}
            camera={{ fov: 26, near: 0.1, far: 90, position: [7, 3, 13] }}
          >
            <ambientLight intensity={dark ? 0.1 : 0.18} />
            <directionalLight position={[-7.5, 9.5, 7]} intensity={dark ? 1.6 : 2.6} />
            <directionalLight position={[3.2, 5.5, -12]} intensity={dark ? 2.2 : 0.9} />
            <Environment resolution={128} frames={1}>
              <color attach="background" args={[dark ? '#050507' : '#3d3d45']} />
              <Lightformer
                form="rect"
                intensity={dark ? 6 : 3}
                position={[-4.5, 6, 5]}
                rotation={[-0.5, -0.6, 0]}
                scale={[9, 5, 1]}
              />
              <Lightformer
                form="rect"
                intensity={dark ? 9 : 2.4}
                position={[6, 2.5, -5]}
                rotation={[0.2, 2.3, 0]}
                scale={[7, 0.8, 1]}
                color="#eaf2ff"
              />
              <Lightformer form="ring" intensity={dark ? 2.4 : 0.8} position={[0, 1, 13]} scale={[7, 7, 1]} />
            </Environment>
            <Suspense fallback={null}>
              <InteractiveCase onHotspot={setHotspot} hi={tier !== 'low'} />
            </Suspense>
            <OrbitControls
              makeDefault
              enablePan={false}
              minDistance={8}
              maxDistance={22}
              minPolarAngle={0.35}
              maxPolarAngle={Math.PI - 0.35}
              dampingFactor={0.08}
              rotateSpeed={0.6}
            />
          </Canvas>
        ) : null}
      </div>
      <figcaption className="figure__hint" data-show={hotspot ? 'true' : undefined}>
        {hotspot ?? 'Glisser pour tourner · cliquer pour explorer'}
      </figcaption>
    </figure>
  )
}
