// Web Audio playback of pulsar periods.
//
// Each pulsar plays a short percussive click at its actual rotation period.
// Millisecond pulsars (P0 < 50ms) get scaled UP into audible frequencies as
// a continuous tone, since 200 clicks per second sounds like a buzz, not
// individual beats. Slower pulsars play discrete clicks via scheduled
// oscillator bursts.

import type { RelativePulsar } from "./types"

let ctx: AudioContext | null = null

function getContext(): AudioContext {
  if (ctx) return ctx
  const AudioCtor =
    (window.AudioContext as typeof AudioContext | undefined) ||
    ((window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext as typeof AudioContext | undefined)
  if (!AudioCtor) throw new Error("Web Audio API not available")
  ctx = new AudioCtor()
  return ctx
}

export interface PulsarVoice {
  stop: () => void
}

// Create a single percussive click at "now"
function scheduleClick(audioCtx: AudioContext, time: number, baseFreq: number, gain: number) {
  const osc = audioCtx.createOscillator()
  const env = audioCtx.createGain()

  osc.type = "sine"
  osc.frequency.setValueAtTime(baseFreq, time)
  osc.frequency.exponentialRampToValueAtTime(Math.max(baseFreq * 0.3, 40), time + 0.05)

  env.gain.setValueAtTime(0, time)
  env.gain.linearRampToValueAtTime(gain, time + 0.001)
  env.gain.exponentialRampToValueAtTime(0.0001, time + 0.04)

  osc.connect(env)
  env.connect(audioCtx.destination)
  osc.start(time)
  osc.stop(time + 0.05)
}

// Hash a pulsar name → consistent base frequency variation (90–500 Hz)
function baseFreqFor(name: string): number {
  let h = 2166136261
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return 90 + (Math.abs(h) % 410)
}

// Play a pulsar's period as repeated clicks
export function playPulsar(rp: RelativePulsar, gain = 0.25): PulsarVoice {
  const audioCtx = getContext()
  // Resume in case the context was suspended (browser autoplay policy)
  if (audioCtx.state === "suspended") void audioCtx.resume()

  const period = rp.pulsar.p0
  const baseFreq = baseFreqFor(rp.pulsar.name)

  // Very fast pulsars (millisecond): play as a continuous tone at 1/period Hz
  // capped to a sane audible range
  if (period < 0.05) {
    const tone = audioCtx.createOscillator()
    const env = audioCtx.createGain()
    const freq = Math.min(Math.max(1 / period, 100), 2000)
    tone.type = "triangle"
    tone.frequency.setValueAtTime(freq, audioCtx.currentTime)
    env.gain.setValueAtTime(0, audioCtx.currentTime)
    env.gain.linearRampToValueAtTime(gain * 0.4, audioCtx.currentTime + 0.05)
    tone.connect(env)
    env.connect(audioCtx.destination)
    tone.start()
    return {
      stop: () => {
        env.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.05)
        tone.stop(audioCtx.currentTime + 0.06)
      },
    }
  }

  // Slow / normal pulsars: schedule a stream of clicks via setInterval
  let stopped = false
  const tick = () => {
    if (stopped) return
    scheduleClick(audioCtx, audioCtx.currentTime, baseFreq, gain)
  }
  tick() // first beat immediately
  const id = window.setInterval(tick, period * 1000)

  return {
    stop: () => {
      stopped = true
      window.clearInterval(id)
    },
  }
}

// Force-stop the audio context (used on unmount)
export function shutdownAudio() {
  if (ctx) {
    void ctx.close().catch(() => {})
    ctx = null
  }
}

// Short UI click for the mute / unmute toggle. Rising blip when going on,
// falling blip when going off — cribbed from kharcha's tickUp / tickDown.
export function playToggleCue(turningOn: boolean) {
  try {
    const c = getContext()
    if (c.state === "suspended") void c.resume()
    const t = c.currentTime
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = "sine"
    if (turningOn) {
      osc.frequency.setValueAtTime(120, t)
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.03)
      gain.gain.setValueAtTime(0.2, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
      osc.connect(gain)
      gain.connect(c.destination)
      osc.start(t)
      osc.stop(t + 0.045)
    } else {
      osc.frequency.setValueAtTime(350, t)
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.035)
      gain.gain.setValueAtTime(0.24, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045)
      osc.connect(gain)
      gain.connect(c.destination)
      osc.start(t)
      osc.stop(t + 0.05)
    }
  } catch {
    // Audio context not ready (autoplay policy) — silently swallow.
  }
}
