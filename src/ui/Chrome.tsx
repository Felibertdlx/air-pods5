import { useEffect, useRef, useState } from 'react'
import { engine } from '../audio/engine'
import { LANGS, UI } from '../i18n/strings'
import { scroll, useStore } from '../state/store'
import { goTo } from './useScrollDriver'

/** Navigation, the two controls, and the scroll hint. */
export function Chrome() {
  const theme = useStore((s) => s.theme)
  const toggle = useStore((s) => s.toggleTheme)
  const lang = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  const tier = useStore((s) => s.tier)
  const hint = useRef<HTMLDivElement>(null)
  const restart = useRef<HTMLButtonElement>(null)
  const [showTier, setShowTier] = useState(false)
  const [sound, setSound] = useState(false)

  // Audio can only be created inside a user gesture, which is exactly the
  // constraint that makes muted-by-default the right behaviour anyway.
  const toggleSound = () => {
    if (engine.running) {
      engine.stop()
      setSound(false)
    } else {
      void engine.start().then(() => setSound(true))
    }
  }

  const t = UI[lang]
  const links = [
    { id: 'design', label: t.nav.design },
    { id: 'sound', label: t.nav.sound },
    { id: 'inside', label: t.nav.inside },
    { id: 'specs', label: t.nav.specs },
  ]

  useEffect(() => {
    let raf = 0
    const tick = () => {
      // The scroll hint belongs to the first moment only.
      if (hint.current) {
        const o = Math.max(0, 1 - scroll.t * 45)
        hint.current.style.opacity = String(o)
        hint.current.style.pointerEvents = o < 0.05 ? 'none' : 'auto'
      }
      // Replaying is only an offer once there is something to go back from,
      // and it steps aside for the written sections, where it would sit on
      // body copy and the closing call to action does the same job.
      // Note the delete: assigning '' leaves the attribute in place, and
      // `[data-show]` matches an empty attribute perfectly happily.
      if (restart.current) {
        const on = scroll.t > 0.02 && useStore.getState().canvasLive
        if (on) restart.current.dataset.show = 'true'
        else delete restart.current.dataset.show
        restart.current.tabIndex = on ? 0 : -1
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // The quality tier is only surfaced when it has actually been lowered —
  // otherwise it is noise.
  useEffect(() => {
    if (tier === 'high') return
    setShowTier(true)
    const id = window.setTimeout(() => setShowTier(false), 4200)
    return () => window.clearTimeout(id)
  }, [tier])

  const jump = (id: string) => {
    const el = document.getElementById(id)
    if (el) goTo.to(el.getBoundingClientRect().top + window.scrollY)
  }

  return (
    <>
      <header className="chrome">
        <button className="chrome__mark" onClick={() => goTo.to(0)} aria-label={t.markLabel}>
          AirPods<span className="chrome__mark-num">5</span>
        </button>

        <nav className="chrome__links" aria-label={t.nav.design}>
          {links.map((l) => (
            <button key={l.id} onClick={() => jump(l.id)}>
              {l.label}
            </button>
          ))}
        </nav>

        <div className="chrome__tools">
          <button
            className="sound"
            onClick={toggleSound}
            aria-label={sound ? t.soundOn : t.soundOff}
            aria-pressed={sound}
            data-on={sound || undefined}
          >
            <span className="sound__bars" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </button>

          <div className="lang" role="group" aria-label={t.langLabel}>
            {LANGS.map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                data-on={lang === l || undefined}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            className="chrome__theme"
            onClick={toggle}
            aria-label={theme === 'studio' ? t.themeToDark : t.themeToStudio}
            aria-pressed={theme === 'dark'}
          >
            <span className="chrome__theme-track">
              <span className="chrome__theme-knob" />
            </span>
            <span className="chrome__theme-label">
              {theme === 'studio' ? t.studio : t.dark}
            </span>
          </button>
        </div>
      </header>

      <button
        className="restart"
        ref={restart}
        onClick={() => goTo.to(0)}
        aria-label={t.replayLabel}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M12 5V2.5L8.2 6 12 9.5V7a5 5 0 1 1-5 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>{t.replay}</span>
      </button>

      <div className="hint" ref={hint}>
        <span className="hint__rule" />
        <span className="hint__text">{t.scroll}</span>
      </div>

      <div className="tier" data-show={showTier || undefined}>
        {t.tier(tier)}
      </div>
    </>
  )
}
