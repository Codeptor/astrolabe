import { describe, it, expect } from "vitest"
import { periodToBinary, binaryToTicks, periodToTicks } from "../binary-encoding"

describe("periodToBinary", () => {
  it("encodes a 1-second period", () => {
    const bits = periodToBinary(1.0)
    expect(bits).toBeGreaterThan(1_000_000_000n)
  })

  it("encodes Crab Pulsar period (0.0334 s)", () => {
    const bits = periodToBinary(0.0334)
    expect(bits).toBeGreaterThan(47_000_000n)
    expect(bits).toBeLessThan(48_000_000n)
  })
})

describe("binaryToTicks", () => {
  it("converts small value to tick marks", () => {
    const ticks = binaryToTicks(0b1010n)
    expect(ticks).toEqual([1, 0, 1, 0])
  })

  it("handles large binary values", () => {
    const ticks = binaryToTicks(47_441_552n)
    expect(ticks[0]).toBe(1)
    expect(ticks.length).toBeGreaterThan(20)
  })
})

describe("periodToTicks", () => {
  it("produces a non-empty array for any positive period", () => {
    const ticks = periodToTicks(0.001)
    expect(ticks.length).toBeGreaterThan(0)
    expect(ticks[0]).toBe(1)
  })
})
