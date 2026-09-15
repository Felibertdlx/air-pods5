import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'
import { useStore } from '../state/store'

/**
 * The curtain. It holds until the models are decoded and the first frame is on
 * screen, then lifts — because the one thing that would undo the whole effect
 * is arriving to a half-drawn product.
 *
 * The lift is a CSS transition driven by one state flag rather than a timeline
 * library. A tween chain here has to survive strict mode's double mount, refs
 * being reattached, and a progress tween competing for the same element; a
 * class toggle has none of those failure modes, and looks identical.
 */

const HOLD_MS = 420
const FADE_MS = 900

export function Loader() {
  const { progress } = useProgress()
  const loaded = useStore((s) => s.loaded)
  const enter = useStore((s) => s.enter)
  const [lifting, setLifting] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (!loaded) return
    const lift = window.setTimeout(() => setLifting(true), HOLD_MS)
    const drop = window.setTimeout(() => {
      setGone(true)
      enter()
    }, HOLD_MS + FADE_MS)
    return () => {
      window.clearTimeout(lift)
      window.clearTimeout(drop)
    }
  }, [loaded, enter])

  if (gone) return null

  return (
    <div className="loader" data-lifting={lifting || undefined}>
      <div className="loader__inner">
        <p className="loader__label">AirPods 5</p>
        <span className="loader__track">
          <span
            className="loader__bar"
            style={{
              transform: `scaleX(${lifting ? 1 : Math.max(0.04, progress / 100)})`,
            }}
          />
        </span>
      </div>
    </div>
  )
}
