import type { AppState } from "@/lib/state"
import { DEFAULT_STATE } from "@/lib/state"

export interface ViewPreset {
  id: string
  label: string
  description: string
  state: AppState
}

export const VIEW_PRESETS: ViewPreset[] = [
  {
    id: "pioneer-1972",
    label: "Pioneer 1972",
    description:
      "The 14 pulsars Frank Drake and Carl Sagan engraved on Pioneer 10/11 and Voyager 1/2. Fixed line art, Sol as observer, epoch held at launch.",
    state: {
      ...DEFAULT_STATE,
      mode: "1972",
      observer: { kind: "star", name: "Sol" },
      pulsar: null,
      count: 14,
      algorithm: "gdop",
      epoch: 0,
    },
  },
  {
    id: "modern-default",
    label: "2026 · modern",
    description:
      "Current ATNF catalogue, re-selected for best triangulation from Sol today. The 'clean-sheet' comparison against Pioneer's 1972 set.",
    state: {
      ...DEFAULT_STATE,
      mode: "custom",
      observer: { kind: "star", name: "Sol" },
      count: 14,
      algorithm: "gdop",
      epoch: 0,
    },
  },
  {
    id: "alpha-centauri",
    label: "α Centauri",
    description:
      "The plaque from our nearest Sun-like neighbour — 1.3 pc from Sol. Geometry is almost identical, which is exactly why Drake chose pulsars as landmarks.",
    state: {
      ...DEFAULT_STATE,
      observer: { kind: "star", name: "Alpha Centauri A" },
      count: 14,
      algorithm: "gdop",
      epoch: 0,
    },
  },
  {
    id: "galactic-centre",
    label: "galactic centre",
    description:
      "Sagittarius A*, the supermassive black hole at the centre of the Milky Way. 8.2 kpc from Sol — pulsars cluster around the observer in every direction.",
    state: {
      ...DEFAULT_STATE,
      observer: { kind: "star", name: "Sagittarius A*" },
      count: 20,
      algorithm: "gdop",
      epoch: 0,
    },
  },
  {
    id: "millisecond-only",
    label: "millisecond clocks",
    description:
      "The fastest-rotating pulsars — natural millisecond-precision clocks. Binary ticks look denser; distance ranges drop.",
    state: {
      ...DEFAULT_STATE,
      observer: { kind: "star", name: "Sol" },
      count: 14,
      algorithm: "fastest",
      epoch: 0,
    },
  },
  {
    id: "deep-past",
    label: "−1 Myr past",
    description:
      "Rewind the time machine one million years. Pulsars drift via synthetic proper motion, periods slow via magnetic braking. Binary ticks flip.",
    state: {
      ...DEFAULT_STATE,
      observer: { kind: "star", name: "Sol" },
      count: 14,
      algorithm: "gdop",
      epoch: -1_000_000,
    },
  },
]
