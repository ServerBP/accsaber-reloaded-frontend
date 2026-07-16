import { onUnmounted, ref } from 'vue'

const MUTE_KEY = 'crate:muted'
const TICK_MIN_GAP_MS = 24
const TICK_LOOKAHEAD = 0.02
const CHIME_PARTIAL_RATIO = 2.4

export interface CrateTick {
  t: number
  progress: number
}

interface NoiseHitOptions {
  type: BiquadFilterType
  freq: number
  peak: number
  decay: number
  freqEnd?: number
  q?: number
  attack?: number
  at?: number
}

interface ToneOptions {
  type: OscillatorType
  freq: number
  peak: number
  decay: number
  freqEnd?: number
  detune?: number
  attack?: number
  delay?: number
  at?: number
}

function impulse(ac: AudioContext): AudioBuffer {
  const length = Math.floor(ac.sampleRate * 1.4)
  const buf = ac.createBuffer(2, length, ac.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3)
    }
  }
  return buf
}

interface SharedAudio {
  ctx: AudioContext
  master: GainNode
  reverb: ConvolverNode
}

let sharedCtx: AudioContext | null = null
let sharedMaster: GainNode | null = null
let sharedReverb: ConvolverNode | null = null
let sharedNoise: AudioBuffer | null = null
let activeInstances = 0

function sharedAudio(): SharedAudio | null {
  if (typeof AudioContext === 'undefined') return null
  if (!sharedCtx || !sharedMaster || !sharedReverb) {
    sharedCtx = new AudioContext()
    sharedMaster = sharedCtx.createGain()
    sharedMaster.gain.value = 0.45
    sharedMaster.connect(sharedCtx.destination)
    sharedReverb = sharedCtx.createConvolver()
    sharedReverb.buffer = impulse(sharedCtx)
    const wet = sharedCtx.createGain()
    wet.gain.value = 0.25
    sharedReverb.connect(wet).connect(sharedMaster)
  }
  if (sharedCtx.state === 'suspended') void sharedCtx.resume()
  return { ctx: sharedCtx, master: sharedMaster, reverb: sharedReverb }
}

function sharedNoiseBuffer(ac: AudioContext): AudioBuffer {
  if (!sharedNoise) {
    sharedNoise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate)
    const data = sharedNoise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  return sharedNoise
}

export function useCrateSounds() {
  const muted = ref(localStorage.getItem(MUTE_KEY) === '1')

  let bus: GainNode | null = null
  let tickBus: GainNode | null = null
  let disposed = false

  activeInstances++

  function out(): GainNode | null {
    if (muted.value || disposed) return null
    const shared = sharedAudio()
    if (!shared) return null
    if (!bus) {
      bus = shared.ctx.createGain()
      bus.connect(shared.master)
      bus.connect(shared.reverb)
    }
    return bus
  }

  function reset() {
    if (bus) {
      bus.disconnect()
      bus = null
    }
    if (tickBus) {
      tickBus.disconnect()
      tickBus = null
    }
  }

  function noise(ac: AudioContext): AudioBufferSourceNode {
    const src = ac.createBufferSource()
    src.buffer = sharedNoiseBuffer(ac)
    return src
  }

  function envelope(
    ac: AudioContext,
    peak: number,
    at: number,
    attack: number,
    decay: number,
  ): GainNode {
    const gain = ac.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(peak, at + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay)
    return gain
  }

  function noiseHit(dest: GainNode, opts: NoiseHitOptions) {
    const ac = dest.context as AudioContext
    const at = opts.at ?? ac.currentTime
    const attack = opts.attack ?? 0.004
    const src = noise(ac)
    const filter = ac.createBiquadFilter()
    filter.type = opts.type
    filter.Q.value = opts.q ?? 1
    filter.frequency.setValueAtTime(opts.freq, at)
    if (opts.freqEnd) {
      filter.frequency.exponentialRampToValueAtTime(opts.freqEnd, at + attack + opts.decay)
    }
    const gain = envelope(ac, opts.peak, at, attack, opts.decay)
    src.connect(filter).connect(gain).connect(dest)
    src.start(at)
    src.stop(at + attack + opts.decay + 0.05)
  }

  function tone(dest: GainNode, opts: ToneOptions) {
    const ac = dest.context as AudioContext
    const at = (opts.at ?? ac.currentTime) + (opts.delay ?? 0)
    const attack = opts.attack ?? 0.004
    const osc = ac.createOscillator()
    osc.type = opts.type
    osc.detune.value = opts.detune ?? 0
    osc.frequency.setValueAtTime(opts.freq, at)
    if (opts.freqEnd && opts.freqEnd !== opts.freq) {
      osc.frequency.exponentialRampToValueAtTime(opts.freqEnd, at + attack + opts.decay)
    }
    const gain = envelope(ac, opts.peak, at, attack, opts.decay)
    osc.connect(gain).connect(dest)
    osc.start(at)
    osc.stop(at + attack + opts.decay + 0.05)
  }

  function tickAt(dest: GainNode, at: number, progress: number) {
    const jitter = 0.95 + Math.random() * 0.1
    noiseHit(dest, { type: 'highpass', freq: 5200 * jitter, peak: 0.2, decay: 0.012, at })
    noiseHit(dest, {
      type: 'bandpass',
      freq: (1500 + progress * 400) * jitter,
      q: 3,
      peak: 0.1,
      decay: 0.02,
      at,
    })
    tone(dest, { type: 'sine', freq: 200, freqEnd: 150, peak: 0.04, decay: 0.03, at })
  }

  function scheduleTicks(ticks: CrateTick[]) {
    if (muted.value || disposed) return
    const shared = sharedAudio()
    if (!shared) return
    if (tickBus) tickBus.disconnect()
    tickBus = shared.ctx.createGain()
    tickBus.connect(shared.master)
    const base = shared.ctx.currentTime + TICK_LOOKAHEAD
    let lastKept = -Infinity
    for (const { t, progress } of ticks) {
      if (t - lastKept < TICK_MIN_GAP_MS) continue
      lastKept = t
      tickAt(tickBus, base + t / 1000, progress)
    }
  }

  function land() {
    const dest = out()
    if (!dest) return
    tone(dest, { type: 'sine', freq: 240, freqEnd: 130, peak: 0.2, decay: 0.16 })
    tone(dest, { type: 'sine', freq: 420, freqEnd: 380, peak: 0.07, decay: 0.08 })
    noiseHit(dest, { type: 'lowpass', freq: 900, peak: 0.1, decay: 0.07 })
  }

  function swing() {
    const dest = out()
    if (!dest) return
    noiseHit(dest, {
      type: 'bandpass',
      freq: 380,
      freqEnd: 2600,
      q: 1.2,
      peak: 0.24,
      attack: 0.02,
      decay: 0.17,
    })
    tone(dest, {
      type: 'sine',
      freq: 300,
      freqEnd: 900,
      peak: 0.05,
      attack: 0.02,
      decay: 0.15,
    })
    tone(dest, {
      type: 'sine',
      freq: 300,
      freqEnd: 900,
      detune: 12,
      peak: 0.04,
      attack: 0.02,
      decay: 0.15,
    })
  }

  function slice(score01: number) {
    const dest = out()
    if (!dest) return
    noiseHit(dest, {
      type: 'highpass',
      freq: 3800,
      freqEnd: 5800 + 1600 * score01,
      peak: 0.3,
      attack: 0.012,
      decay: 0.3,
    })
    noiseHit(dest, { type: 'bandpass', freq: 7200, q: 0.8, peak: 0.2, decay: 0.12 })
    noiseHit(dest, {
      type: 'bandpass',
      freq: 1100,
      freqEnd: 3600 + 1400 * score01,
      q: 6,
      peak: 0.14,
      decay: 0.1,
    })
    noiseHit(dest, { type: 'lowpass', freq: 1800, freqEnd: 320, peak: 0.14, decay: 0.13 })
    tone(dest, { type: 'sine', freq: 140, freqEnd: 70, peak: 0.12, decay: 0.09 })
  }

  function reveal(rarityIndex: number) {
    const dest = out()
    if (!dest) return
    const tier = Math.max(0, Math.min(5, rarityIndex))
    const notes = tier >= 4 ? [659.26, 880, 1318.5] : tier >= 2 ? [659.26, 880] : [880]
    const decay = 0.5 + tier * 0.12
    notes.forEach((freq, i) => {
      const delay = i * 0.09
      tone(dest, { type: 'sine', freq, peak: 0.09, decay, delay })
      tone(dest, {
        type: 'sine',
        freq: freq * CHIME_PARTIAL_RATIO,
        peak: 0.028,
        decay: decay * 0.6,
        delay,
      })
    })
  }

  function prime() {
    if (!muted.value && !disposed) sharedAudio()
  }

  function toggleMute() {
    muted.value = !muted.value
    localStorage.setItem(MUTE_KEY, muted.value ? '1' : '0')
    if (muted.value) reset()
  }

  onUnmounted(() => {
    disposed = true
    reset()
    activeInstances = Math.max(0, activeInstances - 1)
    if (activeInstances === 0 && sharedCtx && sharedCtx.state === 'running') {
      void sharedCtx.suspend()
    }
  })

  return { muted, toggleMute, prime, reset, scheduleTicks, land, swing, slice, reveal }
}
