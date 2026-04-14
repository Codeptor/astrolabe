import { describe, expect, it } from "vitest"
import {
  looksLikeObserverInput,
  parseCoordObserverString,
  parseObserverInput,
} from "../custom-observer"

describe("parseObserverInput", () => {
  it("parses valid galactic coordinates", () => {
    expect(parseObserverInput("l=120 b=-15 d=2.5")).toEqual({
      name: "l=120 b=-15 d=2.5kpc",
      gl: 120,
      gb: -15,
      dist: 2.5,
    })
  })

  it("rejects invalid galactic coordinates", () => {
    expect(parseObserverInput("l=999 b=120 d=1")).toBeNull()
    expect(parseObserverInput("l=120 b=0 d=0")).toBeNull()
    expect(parseObserverInput("l=120 b=0 d=-1")).toBeNull()
  })

  it("rejects invalid equatorial coordinates", () => {
    expect(parseObserverInput("ra=361 dec=0 d=1")).toBeNull()
    expect(parseObserverInput("ra=120 dec=91 d=1")).toBeNull()
    expect(parseObserverInput("ra=120 dec=0 d=-2")).toBeNull()
  })
})

describe("parseCoordObserverString", () => {
  it("parses valid serialized observer coordinates", () => {
    expect(parseCoordObserverString("coord:l=120,b=-15,d=2.5")).toEqual({
      name: "l=120 b=-15 d=2.5kpc",
      gl: 120,
      gb: -15,
      dist: 2.5,
    })
  })

  it("rejects invalid serialized observer coordinates", () => {
    expect(parseCoordObserverString("coord:l=999,b=120,d=1")).toBeNull()
    expect(parseCoordObserverString("coord:l=120,b=0,d=-1")).toBeNull()
  })
})

describe("looksLikeObserverInput", () => {
  it("detects structured coordinate-like input", () => {
    expect(looksLikeObserverInput("l=999 b=120 d=1")).toBe(true)
    expect(looksLikeObserverInput("ra=361 dec=0 d=1")).toBe(true)
    expect(looksLikeObserverInput("18h36m56s +38d47m01s d=0.0077")).toBe(true)
  })

  it("does not classify normal star names as coordinate input", () => {
    expect(looksLikeObserverInput("Vega")).toBe(false)
    expect(looksLikeObserverInput("Stephenson 2-18")).toBe(false)
  })
})
