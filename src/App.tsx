import { useEffect } from 'react'
import { UI } from './i18n/strings'
import { SCROLL_VH } from './timeline/script'
import { useStore } from './state/store'
import { Scene } from './three/Scene'
import { Chrome } from './ui/Chrome'
import { Cursor } from './ui/Cursor'
import { Loader } from './ui/Loader'
import { Overlay } from './ui/Overlay'
import { Sections } from './ui/Sections'
import { useScrollDriver } from './ui/useScrollDriver'

export default function App() {
  const theme = useStore((s) => s.theme)
  const lang = useStore((s) => s.lang)
  useScrollDriver()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  return (
    <>
      {/* The canvas is fixed; the tall track below is what the scroll moves. */}
      <div className="stage">
        <Scene />
      </div>

      <Overlay />
      <Chrome />
      <Cursor />
      <Loader />

      {/* The timeline's transport: empty, and exactly as tall as the film. */}
      <div
        className="track"
        id="track"
        style={{ height: `${SCROLL_VH}vh` }}
        aria-hidden="true"
      />

      {/* A text outline of the piece, for anyone not receiving the canvas. */}
      <div className="sr-only">
        <h1>{UI[lang].outline.title}</h1>
        <p>{UI[lang].outline.body}</p>
      </div>

      <Sections />
    </>
  )
}
