import { UI } from '../i18n/strings'
import { useStore } from '../state/store'
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

  return (
    <main className="pages">
      {/* ── Design ─────────────────────────────────────────────────────── */}
      <section className="sec" id="design">
        <div className="sec__head">
          <p className="sec__eyebrow">{s.design.eyebrow}</p>
          <Title text={s.design.title!} />
        </div>

        <div className="sec__cols">
          <p className="sec__lead">{s.design.body}</p>
          <p className="sec__note">{s.design.note}</p>
        </div>

        <FigureCanvas subject="case-closed" alt={s.design.altClosed} wide />

        <div className="sec__pair">
          <div>
            <h3>{s.design.movingTitle}</h3>
            <p>{s.design.movingBody}</p>
          </div>
          <div>
            <h3>{s.design.wellsTitle}</h3>
            <p>{s.design.wellsBody}</p>
          </div>
        </div>

        <FigureCanvas subject="case-open" alt={s.design.altOpen} />
      </section>

      {/* ── Sound ──────────────────────────────────────────────────────── */}
      <section className="sec sec--split" id="sound">
        <div className="figure--sticky">
          <FigureCanvas subject="earbud" alt={s.sound.altBud} />
        </div>

        <div className="sec__body">
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
        <div className="sec__head">
          <p className="sec__eyebrow">{s.inside.eyebrow}</p>
          <Title text={s.inside.title!} />
        </div>
        <p className="sec__lead sec__lead--wide">{s.inside.lead}</p>

        <ol className="parts">
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
        <div className="sec__head">
          <p className="sec__eyebrow">{s.specs.eyebrow}</p>
          <Title text={s.specs.title!} />
        </div>

        <div className="spec__wrap">
          <table className="spec">
            <caption className="sr-only">{s.specs.eyebrow}</caption>
            <tbody>
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
            <tbody>
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
      <section className="sec sec--close">
        <Title text={s.close.title} className="sec__title sec__title--lg" />
        <p className="sec__lead sec__lead--centre">{s.close.body}</p>
        <button className="cta" onClick={() => goTo.to(0)}>
          {s.close.cta}
        </button>
      </section>

      <footer className="foot">
        <p className="foot__mark">
          AirPods<span>5</span>
        </p>
        <p className="foot__note">{s.foot}</p>
      </footer>
    </main>
  )
}
