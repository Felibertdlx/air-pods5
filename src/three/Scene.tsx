import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useState } from 'react'
import { ACESFilmicToneMapping } from 'three'
import { PROFILES, detectTier } from '../lib/quality'
import { useStore, type Theme } from '../state/store'
import { Backdrop } from './Backdrop'
import { Circuit } from './fx/Circuit'
import { MicIntake } from './fx/MicIntake'
import { SoundField } from './fx/SoundField'
import { Ground } from './Ground'
import { Post } from './Post'
import { Product } from './Product'
import { Rig } from './Rig'
import { Studio } from './Studio'
import { useOrbitDrag } from './useOrbitDrag'

const ACCENT: Record<Theme, string> = { studio: '#0e9f8a', dark: '#5fe3c6' }


export function Scene() {
  const theme = useStore((s) => s.theme)
  const setTier = useStore((s) => s.setTier)
  const [tier, setLocalTier] = useState(detectTier)
  const profile = PROFILES[tier]

  const orbit = useOrbitDrag()
  const dark = theme === 'dark'
  const live = useStore((s) => s.canvasLive)

  return (
    <Canvas
      dpr={profile.dpr}
      shadows={profile.shadows}
      gl={{
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance',
        // the shell has to be cut away when the camera passes through it
        localClippingEnabled: true,
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
      }}
      camera={{ fov: 24, near: 0.03, far: 220, position: [0, 0, 21] }}
      // Nothing to draw once the written sections have scrolled over the
      // canvas: the loop stops rather than rendering a hidden frame.
      frameloop={live ? 'always' : 'never'}
    >
      <PerformanceMonitor
        bounds={() => [48, 58]}
        onDecline={() => {
          const next = tier === 'high' ? 'medium' : 'low'
          if (next !== tier) {
            setLocalTier(next)
            setTier(next)
          }
        }}
      />
      <AdaptiveDpr pixelated={false} />

      <Studio profile={profile} theme={theme} />
      <Backdrop theme={theme} />
      <Ground theme={theme} />

      <Suspense fallback={null}>
        <Product profile={profile} orbit={orbit}>
          <SoundField count={profile.sound} colour={ACCENT[theme]} additive={dark} />
          <MicIntake count={profile.mic} colour={ACCENT[theme]} additive={dark} />
          <Circuit colour={ACCENT[theme]} additive={dark} />
        </Product>
      </Suspense>

      <Rig orbit={orbit} />
      <Post profile={profile} theme={theme} />
    </Canvas>
  )
}
