import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { CAPTIONS } from '../i18n/strings'
import { sample, TOTAL_KEYS } from '../timeline/sample'
import { scroll, useStore } from '../state/store'

/**
 * Text appears only where it says something about the shot in front of it.
 * Everything is written straight to the DOM on an animation frame — routing
 * captions through React state would re-render the tree at scroll rate for no
 * benefit — and the language is read from the store on the same frame, so
 * switching it takes effect without a re-render either.
 */

export function Overlay() {
  const root = useRef<HTMLDivElement>(null)
  const eyebrow = useRef<HTMLParagraphElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const body = useRef<HTMLParagraphElement>(null)
  const block = useRef<HTMLDivElement>(null)
  const index = useRef<HTMLSpanElement>(null)
  const bar = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let raf = 0
    let lastKey = ''
    let lastAlign = ''

    const tick = () => {
      // The captions belong to the film. Once the written sections have
      // covered the canvas they would just be text floating over other text.
      const { canvasLive, lang } = useStore.getState()
      if (root.current) root.current.style.opacity = canvasLive ? '1' : '0'

      const s = sample(scroll.t)
      const copy = s.caption ? CAPTIONS[s.caption.id]?.[lang] : undefined
      const key = s.caption ? `${s.caption.id}|${lang}` : ''

      if (key !== lastKey) {
        lastKey = key
        if (eyebrow.current) eyebrow.current.textContent = copy?.eyebrow ?? ''
        if (title.current) title.current.textContent = copy?.title ?? ''
        if (body.current) body.current.textContent = copy?.body ?? ''
        // a short, staggered rise — the only motion the type ever makes
        if (copy && block.current) {
          gsap.fromTo(
            block.current.querySelectorAll('[data-line]'),
            { yPercent: 40, opacity: 0 },
            {
              yPercent: 0,
              opacity: 1,
              duration: 1.4,
              stagger: 0.12,
              ease: 'power3.out',
              overwrite: true,
            },
          )
        }
      }

      const align = s.caption?.align ?? 'left'
      if (align !== lastAlign && block.current) {
        lastAlign = align
        block.current.dataset.align = align
      }

      if (block.current) {
        block.current.style.opacity = String(s.captionFade)
        block.current.style.visibility = s.captionFade < 0.01 ? 'hidden' : 'visible'
      }

      const n = Math.min(TOTAL_KEYS, s.index + 1)
      if (index.current) {
        const text = `${String(n).padStart(2, '0')} / ${TOTAL_KEYS}`
        if (index.current.textContent !== text) index.current.textContent = text
      }
      if (bar.current) bar.current.style.transform = `scaleX(${scroll.t})`

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="overlay" ref={root} aria-live="polite">
      <div className="caption" ref={block} data-align="centre">
        <p className="caption__eyebrow" data-line ref={eyebrow} />
        <h2 className="caption__title" data-line ref={title} />
        <p className="caption__body" data-line ref={body} />
      </div>

      <div className="readout">
        <span className="readout__index" ref={index}>
          01 / {TOTAL_KEYS}
        </span>
        <span className="readout__track">
          <span className="readout__bar" ref={bar} />
        </span>
      </div>
    </div>
  )
}
