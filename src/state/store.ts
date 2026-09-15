import { create } from 'zustand'
import type { Lang } from '../i18n/strings'

export type Theme = 'studio' | 'dark'
export type Tier = 'high' | 'medium' | 'low'
export type CursorMode = 'idle' | 'product' | 'drag' | 'dragging' | 'explore'

interface State {
  /** Raw scroll progress, 0 → 1. Written every scroll frame, read in useFrame. */
  progress: number
  setProgress: (v: number) => void

  loaded: boolean
  setLoaded: (v: boolean) => void
  entered: boolean
  enter: () => void

  theme: Theme
  toggleTheme: () => void

  lang: Lang
  setLang: (l: Lang) => void

  tier: Tier
  setTier: (t: Tier) => void

  /** False once the document sections have scrolled over the canvas. */
  canvasLive: boolean
  setCanvasLive: (v: boolean) => void

  cursor: CursorMode
  setCursor: (c: CursorMode) => void

  /** Label of the component under the pointer, or null. */
  hovered: string | null
  setHovered: (h: string | null) => void

  reducedMotion: boolean
}

/**
 * French unless the visitor has chosen otherwise. A browser set to English
 * still gets French on a first visit — this is a French piece — but the choice
 * they make is remembered.
 */
function storedLang(): Lang {
  try {
    const saved = localStorage.getItem('ap5.lang')
    if (saved === 'fr' || saved === 'en') return saved
  } catch {
    /* storage blocked */
  }
  return 'fr'
}

const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

export const useStore = create<State>((set) => ({
  progress: 0,
  setProgress: (v) => set({ progress: v }),

  loaded: false,
  setLoaded: (v) => set({ loaded: v }),
  entered: false,
  enter: () => set({ entered: true }),

  theme: 'studio',
  toggleTheme: () =>
    set((s) => ({ theme: s.theme === 'studio' ? 'dark' : 'studio' })),

  lang: storedLang(),
  setLang: (l) => {
    try {
      localStorage.setItem('ap5.lang', l)
    } catch {
      /* private window, or storage blocked — the choice just won't persist */
    }
    set({ lang: l })
  },

  tier: 'high',
  setTier: (t) => set({ tier: t }),

  canvasLive: true,
  setCanvasLive: (v) => set((s) => (s.canvasLive === v ? s : { canvasLive: v })),

  cursor: 'idle',
  setCursor: (c) => set({ cursor: c }),

  hovered: null,
  setHovered: (h) => set({ hovered: h }),

  reducedMotion: prefersReduced,
}))

/** Progress is read 60 times a second; going through React would be waste. */
export const scroll = { t: 0, velocity: 0 }
