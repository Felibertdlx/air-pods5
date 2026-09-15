import { clock, read } from '../three/signal'

/**
 * The sound of the piece, synthesised rather than downloaded.
 *
 * Every voice is built from oscillators and filtered noise: nothing to fetch,
 * nothing to decode, a few kilobytes of code instead of a few megabytes of
 * audio — and, more usefully, each voice can be driven straight off the same
 * timeline the camera runs on instead of a transport trying to stay in step
 * with it. The chord changes because the film changed shot, not because a bar
 * went by.
 *
 * It starts silent and stays silent until somebody asks. Autoplaying audio is
 * blocked by browsers and resented by people, in that order.
 */

/** Where the harmony goes. Frequencies in Hz, low to high. */
const CHORDS: { at: number; notes: number[] }[] = [
  // D minor, open and bare — the reveal
  { at: 0.0, notes: [73.42, 146.83, 220.0, 293.66] },
  // adds the minor third as the case opens
  { at: 0.17, notes: [73.42, 146.83, 174.61, 293.66] },
  // B♭ major: the pair, warmer
  { at: 0.25, notes: [58.27, 116.54, 174.61, 233.08] },
  // F, suspended — the study and the macro
  { at: 0.36, notes: [87.31, 174.61, 233.08, 349.23] },
  // C, unresolved: crossing the surface
  { at: 0.5, notes: [65.41, 130.81, 196.0, 261.63] },
  // G minor, darker: inside the shell
  { at: 0.56, notes: [49.0, 98.0, 146.83, 233.08] },
  // back to D with the ninth on top — sound leaving the mesh
  { at: 0.69, notes: [73.42, 146.83, 220.0, 329.63] },
  // A minor: the electronics
  { at: 0.76, notes: [55.0, 110.0, 164.81, 220.0] },
  // the case again, wide
  { at: 0.85, notes: [58.27, 116.54, 174.61, 233.08] },
  // resolve
  { at: 0.92, notes: [73.42, 146.83, 220.0, 293.66] },
]

function chordAt(t: number) {
  let i = 0
  while (i < CHORDS.length - 1 && CHORDS[i + 1].at <= t) i++
  return i
}

export class Engine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private tone: BiquadFilterNode | null = null
  private wet: GainNode | null = null
  private noise: AudioBuffer | null = null

  private bed: GainNode | null = null
  private air: GainNode | null = null
  private airFilter: BiquadFilterNode | null = null
  private padGain: GainNode | null = null
  private padFilter: BiquadFilterNode | null = null
  private voices: OscillatorNode[] = []
  private subOsc: OscillatorNode | null = null
  private sub: GainNode | null = null
  private grain: GainNode | null = null
  private grainFilter: BiquadFilterNode | null = null

  private chord = -1
  private lastLid = 0
  private lastOut = 0
  private lastBlip = 0
  private raf = 0
  private started = false

  get running() {
    return this.started
  }

  async start() {
    if (this.started) return
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    await ctx.resume()
    this.ctx = ctx

    // ---- master chain ----------------------------------------------------
    // A limiter at the end, because every voice is driven by scroll and they
    // can all peak at once. Without it the loud moments clip rather than
    // simply being loud.
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -10
    limiter.knee.value = 6
    limiter.ratio.value = 12
    limiter.attack.value = 0.004
    limiter.release.value = 0.25
    limiter.connect(ctx.destination)

    this.master = ctx.createGain()
    this.master.gain.value = 0

    // One filter across the whole mix. Closing it as the camera goes inside
    // the shell is the cheapest convincing thing in the piece: the world is
    // muffled in there, and the ear believes the picture because of it.
    this.tone = ctx.createBiquadFilter()
    this.tone.type = 'lowpass'
    this.tone.frequency.value = 18000
    this.tone.Q.value = 0.4
    this.master.connect(this.tone).connect(limiter)

    // ---- reverb send -----------------------------------------------------
    this.noise = this.makeNoise(ctx)
    const verb = ctx.createConvolver()
    verb.buffer = this.makeImpulse(ctx, 2.6)
    this.wet = ctx.createGain()
    this.wet.gain.value = 0.34
    this.wet.connect(verb).connect(this.master)

    // ---- voices ----------------------------------------------------------
    this.buildBed(ctx)
    this.buildAir(ctx)
    this.buildPad(ctx)
    this.buildSub(ctx)
    this.buildGrain(ctx)

    this.started = true
    this.master.gain.setTargetAtTime(1, ctx.currentTime, 0.5)
    this.loop()
  }

  stop() {
    cancelAnimationFrame(this.raf)
    const { ctx, master } = this
    if (!ctx || !master) return
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime)
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4)
    this.started = false
    window.setTimeout(() => {
      void ctx.close()
      this.ctx = null
      this.voices = []
    }, 500)
  }

  // ---- buffers ------------------------------------------------------------

  /** Four seconds of brown-ish noise. Long enough that the loop is inaudible. */
  private makeNoise(ctx: AudioContext) {
    const buf = ctx.createBuffer(2, ctx.sampleRate * 4, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      let last = 0
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1
        last = (last + 0.02 * w) / 1.02
        d[i] = last * 3.2
      }
    }
    return buf
  }

  /**
   * A room, as an exponentially decaying noise burst. A real impulse response
   * would be a download; this is two lines of maths and, at this reverb level,
   * indistinguishable.
   */
  private makeImpulse(ctx: AudioContext, seconds: number) {
    const n = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(2, n, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      for (let i = 0; i < n; i++) {
        const t = i / n
        // a short pre-delay keeps the tail off the transient
        const early = i < ctx.sampleRate * 0.012 ? 0 : 1
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6) * early
      }
    }
    return buf
  }

  // ---- voices -------------------------------------------------------------

  private loopSource(ctx: AudioContext, rate = 1) {
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    src.playbackRate.value = rate
    src.start()
    return src
  }

  /** The room: a wide, quiet bed under everything, breathing slowly. */
  private buildBed(ctx: AudioContext) {
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 420
    lp.Q.value = 0.3

    // A very slow sweep so the bed is never quite static.
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.045
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 130
    lfo.connect(lfoGain).connect(lp.frequency)
    lfo.start()

    this.bed = ctx.createGain()
    this.bed.gain.value = 0
    this.loopSource(ctx, 0.85).connect(lp).connect(this.bed)
    this.bed.connect(this.master!)
    this.bed.connect(this.wet!)
  }

  /** Movement: band-passed noise that swells with the camera's speed. */
  private buildAir(ctx: AudioContext) {
    this.airFilter = ctx.createBiquadFilter()
    this.airFilter.type = 'bandpass'
    this.airFilter.frequency.value = 700
    this.airFilter.Q.value = 0.7

    this.air = ctx.createGain()
    this.air.gain.value = 0
    this.loopSource(ctx, 1.1).connect(this.airFilter).connect(this.air)
    this.air.connect(this.master!)
    this.air.connect(this.wet!)
  }

  /**
   * The harmony: four oscillators that glide between chords rather than
   * retriggering, so the progression moves without ever sounding like notes
   * being played.
   */
  private buildPad(ctx: AudioContext) {
    this.padFilter = ctx.createBiquadFilter()
    this.padFilter.type = 'lowpass'
    this.padFilter.frequency.value = 800
    this.padFilter.Q.value = 0.6

    this.padGain = ctx.createGain()
    this.padGain.gain.value = 0
    this.padFilter.connect(this.padGain)
    this.padGain.connect(this.master!)
    this.padGain.connect(this.wet!)

    const levels = [0.5, 0.42, 0.26, 0.16]
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator()
      osc.type = i < 2 ? 'sine' : 'triangle'
      osc.frequency.value = CHORDS[0].notes[i]
      const g = ctx.createGain()
      g.gain.value = levels[i] * 0.3

      // A second oscillator a few cents off gives the pad a slow beat, which
      // is what stops four pure sines sounding like a test tone.
      const det = ctx.createOscillator()
      det.type = 'sine'
      det.frequency.value = CHORDS[0].notes[i] * 1.0035
      const dg = ctx.createGain()
      dg.gain.value = levels[i] * 0.16

      osc.connect(g).connect(this.padFilter)
      det.connect(dg).connect(this.padFilter)
      osc.start()
      det.start()
      this.voices.push(osc, det)
    }
  }

  /** A sub under the loud moments, felt more than heard. */
  private buildSub(ctx: AudioContext) {
    this.subOsc = ctx.createOscillator()
    this.subOsc.type = 'sine'
    this.subOsc.frequency.value = 36.71
    this.sub = ctx.createGain()
    this.sub.gain.value = 0
    this.subOsc.connect(this.sub).connect(this.master!)
    this.subOsc.start()
  }

  /** The microphone sequence: a narrow, rising band, like air being gathered. */
  private buildGrain(ctx: AudioContext) {
    this.grainFilter = ctx.createBiquadFilter()
    this.grainFilter.type = 'bandpass'
    this.grainFilter.frequency.value = 1400
    this.grainFilter.Q.value = 6

    this.grain = ctx.createGain()
    this.grain.gain.value = 0
    this.loopSource(ctx, 1.4).connect(this.grainFilter).connect(this.grain)
    this.grain.connect(this.master!)
    this.grain.connect(this.wet!)
  }

  // ---- one-shots ----------------------------------------------------------

  /** A click: a transient, so it is drawn each time rather than looped. */
  private click(freq: number, gain: number, decay: number, pan = 0) {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const t = ctx.currentTime

    const src = this.loopSource(ctx, 1.8)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = freq
    bp.Q.value = 3.4

    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay)

    const p = ctx.createStereoPanner()
    p.pan.value = pan

    src.connect(bp).connect(g).connect(p)
    p.connect(this.master)
    p.connect(this.wet!)
    src.stop(t + decay + 0.1)
  }

  /** The hinge: a short friction sweep before the latch lands. */
  private hinge(up: boolean) {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const t = ctx.currentTime

    const src = this.loopSource(ctx, 0.9)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 2.2
    bp.frequency.setValueAtTime(up ? 380 : 900, t)
    bp.frequency.exponentialRampToValueAtTime(up ? 1100 : 320, t + 0.26)

    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.035, t + 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)

    src.connect(bp).connect(g)
    g.connect(this.master)
    g.connect(this.wet!)
    src.stop(t + 0.4)

    // the latch, a beat after the friction
    window.setTimeout(() => this.click(up ? 2400 : 1500, up ? 0.1 : 0.16, 0.12), 210)
  }

  /**
   * The extraction score: the harmonic bed lifted an octave and pushed
   * forward, timed to the same crossing that triggers `lift`. Builds while
   * the buds are actually rising, peaks as they reach height, then breathes
   * back down to the ambient pad level rather than staying lifted for the
   * rest of the piece — a moment, not a new resting state.
   */
  private swell() {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.wet) return
    const t = ctx.currentTime
    const notes = CHORDS[Math.max(0, this.chord)].notes

    const filt = ctx.createBiquadFilter()
    filt.type = 'lowpass'
    filt.Q.value = 0.5
    filt.frequency.setValueAtTime(450, t)
    filt.frequency.exponentialRampToValueAtTime(2600, t + 1.05)
    filt.frequency.exponentialRampToValueAtTime(650, t + 3.7)

    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    // building, while they rise
    g.gain.exponentialRampToValueAtTime(0.17, t + 1.05)
    // the peak, held just long enough to register as an arrival
    g.gain.setTargetAtTime(0.17, t + 1.05, 0.12)
    // a small breath, then a clean release back to silence — the pad
    // underneath is what carries on, not this
    g.gain.setValueAtTime(0.17, t + 1.35)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.0)
    filt.connect(g)
    g.connect(this.master)
    g.connect(this.wet)

    const levels = [0.5, 0.4, 0.28, 0.18]
    const voices: OscillatorNode[] = []
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator()
      o.type = i < 2 ? 'sine' : 'triangle'
      // an octave above the resting pad — the lift needs to read as a
      // register change, not just a volume change
      o.frequency.value = freq * 2
      const og = ctx.createGain()
      og.gain.value = levels[i] ?? 0.2
      o.connect(og).connect(filt)
      o.start(t)
      o.stop(t + 4.1)
      voices.push(o)
    })

    // felt more than heard, right under the peak
    const subO = ctx.createOscillator()
    subO.type = 'sine'
    subO.frequency.value = notes[0] / 2
    const subG = ctx.createGain()
    subG.gain.setValueAtTime(0, t)
    subG.gain.linearRampToValueAtTime(0.13, t + 1.0)
    subG.gain.exponentialRampToValueAtTime(0.0001, t + 2.0)
    subO.connect(subG).connect(this.master)
    subO.start(t)
    subO.stop(t + 2.1)
  }

  /** A soft rising breath as the buds leave, or settle as they return. */
  private lift(up: boolean) {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const t = ctx.currentTime

    const src = this.loopSource(ctx, 1.0)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.1
    bp.frequency.setValueAtTime(up ? 260 : 900, t)
    bp.frequency.exponentialRampToValueAtTime(up ? 900 : 260, t + 0.8)

    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.05, t + 0.3)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95)

    src.connect(bp).connect(g)
    g.connect(this.master)
    g.connect(this.wet!)
    src.stop(t + 1.1)

    if (!up) {
      // two contacts landing, a hair apart and to either side
      window.setTimeout(() => this.click(1800, 0.08, 0.09, -0.35), 620)
      window.setTimeout(() => this.click(1750, 0.08, 0.09, 0.35), 700)
    }
  }

  /** A single high blip, for data moving along the board. */
  private blip() {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 1100 + Math.random() * 900
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.022, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    const p = ctx.createStereoPanner()
    p.pan.value = Math.random() * 1.4 - 0.7
    osc.connect(g).connect(p)
    p.connect(this.master)
    p.connect(this.wet!)
    osc.start(t)
    osc.stop(t + 0.25)
  }

  // ---- per-frame ----------------------------------------------------------

  private set(node: GainNode | null, v: number, time = 0.1) {
    if (!node || !this.ctx) return
    // setTargetAtTime rather than ramps: these follow scroll and change every
    // frame, and scheduling a ramp per frame stacks events until it stutters.
    node.gain.setTargetAtTime(Math.max(0, v), this.ctx.currentTime, time)
  }

  private loop = () => {
    if (!this.started || !this.ctx) return
    const s = read()
    const ctx = this.ctx
    const t = ctx.currentTime

    // ---- harmony ---------------------------------------------------------
    const ci = chordAt(clock.t)
    if (ci !== this.chord) {
      this.chord = ci
      const notes = CHORDS[ci].notes
      // Long glides: the chord should arrive without anyone noticing it moved.
      this.voices.forEach((osc, i) => {
        const note = notes[Math.floor(i / 2)]
        const target = i % 2 ? note * 1.0035 : note
        osc.frequency.cancelScheduledValues(t)
        osc.frequency.setValueAtTime(osc.frequency.value, t)
        osc.frequency.exponentialRampToValueAtTime(target, t + 3.2)
      })
      if (this.subOsc) {
        this.subOsc.frequency.cancelScheduledValues(t)
        this.subOsc.frequency.setValueAtTime(this.subOsc.frequency.value, t)
        this.subOsc.frequency.exponentialRampToValueAtTime(notes[0] / 2, t + 3.2)
      }
    }

    // ---- levels ----------------------------------------------------------
    const speed = Math.min(1, Math.abs(clock.velocity) * 26)

    // Kept close to inaudible — a sense of room, not a permanent hiss.
    this.set(this.bed, 0.016)
    this.set(this.air, 0.015 + speed * 0.055, 0.22)
    if (this.airFilter) {
      // faster camera, brighter air
      this.airFilter.frequency.setTargetAtTime(560 + speed * 1500, t, 0.25)
    }

    // The pad sits under everything and blooms for the output sequence.
    this.set(this.padGain, 0.055 + s.fxSound * 0.1 + s.fxEnergy * 0.03, 0.4)
    if (this.padFilter) {
      this.padFilter.frequency.setTargetAtTime(
        620 + s.fxSound * 1800 + speed * 400,
        t,
        0.4,
      )
    }
    this.set(this.sub, s.fxSound * 0.09 + s.fxEnergy * 0.05, 0.5)

    this.set(this.grain, s.fxMic * 0.05, 0.3)
    if (this.grainFilter) {
      this.grainFilter.frequency.setTargetAtTime(900 + s.fxMic * 2600, t, 0.3)
    }

    // Inside the shell, everything is muffled. This is driven by the same
    // channels that cut the shell away, so the picture and the sound agree.
    const inside = Math.max(s.clip, s.xray * 0.55)
    if (this.tone) {
      this.tone.frequency.setTargetAtTime(18000 - inside * 16600, t, 0.25)
    }
    if (this.wet) {
      // and reverberant, the way a small sealed volume is
      this.wet.gain.setTargetAtTime(0.3 + inside * 0.4, t, 0.3)
    }

    // ---- events ----------------------------------------------------------
    if (s.lid > 0.06 && this.lastLid <= 0.06) this.hinge(true)
    if (s.lid < 0.94 && this.lastLid >= 0.94) this.hinge(false)
    this.lastLid = s.lid

    if (s.podsOut > 0.04 && this.lastOut <= 0.04) {
      this.lift(true)
      this.swell()
    }
    if (s.podsOut < 0.96 && this.lastOut >= 0.96) this.lift(false)
    this.lastOut = s.podsOut

    // Blips, while data is moving. Rate follows the channel, not a metronome.
    if (s.fxData > 0.15 && t - this.lastBlip > 0.09 + (1 - s.fxData) * 0.5) {
      this.lastBlip = t
      this.blip()
    }

    this.raf = requestAnimationFrame(this.loop)
  }
}

export const engine = new Engine()
