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

/**
 * A caption's first line is written as "01 — Surface": a shot number and its
 * subject, which is what a camera slate carries. Split here so the stylesheet
 * can treat the two halves as the different things they are — the number is a
 * live value that counts up as the film runs, the subject is a label. Copy
 * without a number (the opening card is just "AirPods 5") falls through as a
 * subject on its own.
 */
const SLATE = /^\s*(\d+)\s*[—–-]\s*(.+)$/

export function Overlay() {
  const root = useRef<HTMLDivElement>(null)
  const shot = useRef<HTMLSpanElement>(null)
  const subject = useRef<HTMLSpanElement>(null)
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
      const { canvasLive, lang, reducedMotion } = useStore.getState()
      if (root.current) root.current.style.opacity = canvasLive ? '1' : '0'

      const s = sample(scroll.t)
      const copy = s.caption ? CAPTIONS[s.caption.id]?.[lang] : undefined
      const key = s.caption ? `${s.caption.id}|${lang}` : ''

      if (key !== lastKey) {
        lastKey = key
        const slate = copy?.eyebrow ? SLATE.exec(copy.eyebrow) : null
        if (shot.current) shot.current.textContent = slate ? slate[1] : ''
        if (subject.current) {
          subject.current.textContent = slate ? slate[2] : (copy?.eyebrow ?? '')
        }
        if (title.current) title.current.textContent = copy?.title ?? ''
        if (body.current) body.current.textContent = copy?.body ?? ''
        // A short, staggered rise — the only motion the type ever makes.
        //
        // It has to finish inside the passage it belongs to. At 1.4s with a
        // 0.12 stagger the last line landed 1.64s after the caption changed,
        // and a caption handover in this score takes 0.006 of the track:
        // scrolled at any real speed the words were still arriving when the
        // shot they describe had already gone. Held under a second, it reads
        // as type settling rather than as type chasing the film.
        //
        // Reduced motion keeps the fade and drops the travel — the dissolve
        // is what tells you the line changed, the rise is only flourish.
        if (copy && block.current) {
          gsap.fromTo(
            block.current.querySelectorAll('[data-line]'),
            { yPercent: reducedMotion ? 0 : 24, opacity: 0 },
            {
              yPercent: 0,
              opacity: 1,
              duration: reducedMotion ? 0.25 : 0.72,
              stagger: reducedMotion ? 0 : 0.06,
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
        const text = String(n).padStart(2, '0')
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
        <p className="caption__slate" data-line>
          <span className="caption__shot" ref={shot} />
          <span className="caption__subject" ref={subject} />
        </p>
        <h2 className="caption__title" data-line ref={title} />
        <p className="caption__body" data-line ref={body} />
      </div>

      <div className="readout">
        <span className="readout__index">
          <span className="readout__now" ref={index}>
            01
          </span>
          <span className="readout__of">/ {TOTAL_KEYS}</span>
        </span>
        <span className="readout__track">
          <span className="readout__bar" ref={bar} />
        </span>
      </div>
    </div>
  )
}
