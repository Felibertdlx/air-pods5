import { useLayoutEffect, useRef } from 'react'
import { UI } from '../i18n/strings'
import { useStore } from '../state/store'
import { DesignStudio } from './DesignStudio'
import { FigureCanvas } from './FigureCanvas'
import { goTo } from './useScrollDriver'

/**
 * The written half of the page.
 *
 * It sits below the timeline track and scrolls over the fixed canvas, so the
 * two halves share a document without fighting for the same space. Nothing
 * here is a card: the structure is made of hairlines, wide margins and type
 * scale, which is the same restraint the 3D half is built on.
 */

/** Milliseconds between one item arriving and the next. */
const REVEAL_STEP = 45
/** The ceiling on that. A list of twenty must not take a second to appear. */
const REVEAL_CAP = 270

/**
 * Reveal each `[data-reveal-group]` on the way past it, its children a beat
 * apart.
 *
 * Written as progressive enhancement rather than as a stylesheet rule: the
 * hidden state is stamped on by this effect, so a page whose script never ran
 * is a page that is simply readable. Hiding the article in CSS and trusting
 * an observer to give it back is a bet whose losing side is a blank page.
 *
 * useLayoutEffect, not useEffect: the hidden state has to be in place before
 * the browser paints, or anything already on screen flashes in and then hides
 * itself, which is worse than not animating at all.
 *
 * Each group is unobserved the moment it has fired. Nothing here re-runs on
 * scroll, and nothing blocks reading: the text is in the document either way,
 * this only decides when it becomes visible.
 */
function useReveal<T extends HTMLElement>() {
  const root = useRef<T>(null)

  useLayoutEffect(() => {
    const host = root.current
    if (!host) return
    // Movement is the part that causes trouble, so for anyone who has asked
    // for less of it there is nothing to reveal — the page is just there.
    if (useStore.getState().reducedMotion) return
    if (typeof IntersectionObserver === 'undefined') return

    const groups = Array.from(host.querySelectorAll<HTMLElement>('[data-reveal-group]'))
    const kids = new Map<Element, HTMLElement[]>()

    for (const group of groups) {
      const items = Array.from(group.children) as HTMLElement[]
      for (const item of items) item.dataset.reveal = 'pending'
      kids.set(group, items)
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const items = kids.get(entry.target) ?? []
          items.forEach((item, i) => {
            const delay = Math.min(i * REVEAL_STEP, REVEAL_CAP)
            // Set on the item, never on the group: a custom property written
            // to a parent recalculates styles for every child under it.
            item.style.setProperty('--reveal-delay', `${delay}ms`)
            item.dataset.reveal = 'in'
          })
          io.unobserve(entry.target)
        }
      },
      // A little short of the bottom edge, so a group starts arriving as it
      // comes into the frame rather than once it is already being read.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.01 },
    )

    for (const group of groups) io.observe(group)
    return () => io.disconnect()
  }, [])

  return root
}

/** Titles carry an intentional line break; honour it without dangerouslySet. */
function Title({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n')
  return (
    <h2 className={className ?? 'sec__title'}>
      {lines.map((l, i) => (
        <span key={i}>
          {l}
          {i < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </h2>
  )
}

export function Sections() {
  const lang = useStore((s) => s.lang)
  const s = UI[lang].sections
  const pages = useReveal<HTMLElement>()

  return (
    <main className="pages" ref={pages}>
      {/* ── Design ─────────────────────────────────────────────────────── */}
      <section className="sec" id="design">
        <div className="sec__head" data-reveal-group>
          <p className="sec__eyebrow">{s.design.eyebrow}</p>
          <Title text={s.design.title!} />
        </div>

        <div className="sec__cols" data-reveal-group>
          <p className="sec__lead">{s.design.body}</p>
          <p className="sec__note">{s.design.note}</p>
        </div>

        <DesignStudio />

        <div className="sec__pair" data-reveal-group>
          <div>
            <h3>{s.design.movingTitle}</h3>
            <p>{s.design.movingBody}</p>
          </div>
          <div>
            <h3>{s.design.wellsTitle}</h3>
            <p>{s.design.wellsBody}</p>
          </div>
        </div>
      </section>

      {/* ── Sound ──────────────────────────────────────────────────────── */}
      <section className="sec sec--split" id="sound">
        <div className="figure--sticky">
          <FigureCanvas subject="earbud" alt={s.sound.altBud} />
        </div>

        <div className="sec__body" data-reveal-group>
          <p className="sec__eyebrow">{s.sound.eyebrow}</p>
          <Title text={s.sound.title!} className="sec__title sec__title--sm" />
          <p className="sec__lead">{s.sound.body}</p>

          <dl className="facts">
            {s.sound.facts.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Inside ─────────────────────────────────────────────────────── */}
      <section className="sec" id="inside">
        <div className="sec__head" data-reveal-group>
          <p className="sec__eyebrow">{s.inside.eyebrow}</p>
          <Title text={s.inside.title!} />
        </div>
        <p className="sec__lead sec__lead--wide">{s.inside.lead}</p>

        <ol className="parts" data-reveal-group>
          {s.inside.parts.map(([name, note], i) => (
            <li key={name}>
              <span className="parts__n">{String(i + 1).padStart(2, '0')}</span>
              <span className="parts__name">{name}</span>
              <span className="parts__note">{note}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Specs ──────────────────────────────────────────────────────── */}
      <section className="sec" id="specs">
        <div className="sec__head" data-reveal-group>
          <p className="sec__eyebrow">{s.specs.eyebrow}</p>
          <Title text={s.specs.title!} />
        </div>

        <div className="spec__wrap">
          <table className="spec">
            <caption className="sr-only">{s.specs.eyebrow}</caption>
            <tbody data-reveal-group>
              {s.specs.rows.map(([k, v]) => (
                <tr key={k}>
                  <th scope="row">{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="spec__sub">{s.specs.buildTitle}</h3>
        <div className="spec__wrap">
          <table className="spec">
            <caption className="sr-only">{s.specs.buildTitle}</caption>
            <tbody data-reveal-group>
              {s.specs.build.map(([k, v]) => (
                <tr key={k}>
                  <th scope="row">{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Close ──────────────────────────────────────────────────────── */}
      <section className="sec sec--close" data-reveal-group>
        <Title text={s.close.title} className="sec__title sec__title--lg" />
        <p className="sec__lead sec__lead--centre">{s.close.body}</p>
        {/* Wrapped, because the reveal below sets a transition on whichever
            elements it is given, and a bare button here would have had its
            own background/colour/press transition replaced by an opacity one
            the moment it arrived — the control would look right and then
            stop answering a press. The wrapper takes the reveal; the button
            keeps its own behaviour. */}
        <div className="sec__act">
          <button className="cta" onClick={() => goTo.to(0)}>
            {s.close.cta}
          </button>
        </div>
      </section>

      <footer className="foot" data-reveal-group>
        <p className="foot__mark">
          AirPods<span>5</span>
        </p>
        <p className="foot__note">{s.foot}</p>
      </footer>
    </main>
  )
}
