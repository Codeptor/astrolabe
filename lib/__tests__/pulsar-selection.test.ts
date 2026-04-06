import { describe, it, expect } from "vitest"
import { selectPulsars } from "../pulsar-selection"
import type { Pulsar } from "../types"

function makePulsar(name: string, gl: number, gb: number, dist: number, p0: number, p1: number | null = null): Pulsar {
  return { name, gl, gb, dist, p0, p1 }
}

describe("selectPulsars", () => {
  const pulsars = Array.from({ length: 15 }, (_, i) =>
    makePulsar(`P${i}`, i * 24, (i % 3 - 1) * 20, 1 + i * 0.3, 0.001 + i * 0.001, 1e-20 + i * 1e-18)
  )

  it("selects exactly 14 pulsars", () => {
    const result = selectPulsars(pulsars, { gl: 0, gb: 0, dist: 0 })
    expect(result.length).toBe(14)
  })

  it("returns fewer if not enough pulsars", () => {
    const result = selectPulsars(pulsars.slice(0, 5), { gl: 0, gb: 0, dist: 0 })
    expect(result.length).toBe(5)
  })

  it("each selected pulsar has a valid angle", () => {
    const result = selectPulsars(pulsars, { gl: 0, gb: 0, dist: 0 })
    for (const rp of result) {
      expect(rp.angle).toBeGreaterThanOrEqual(-Math.PI)
      expect(rp.angle).toBeLessThanOrEqual(Math.PI)
    }
  })
})
