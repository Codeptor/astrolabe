import { describe, it, expect } from "vitest"
import {
  raDecToGalactic,
  galacticToCartesian,
  cartesianToGalactic,
  relativePosition,
} from "../coordinates"

describe("raDecToGalactic", () => {
  it("converts Crab Pulsar RA/Dec to galactic coords", () => {
    const { gl, gb } = raDecToGalactic(83.633, 22.0145)
    expect(gl).toBeCloseTo(184.56, 0)
    expect(gb).toBeCloseTo(-5.78, 0)
  })

  it("converts galactic center RA/Dec correctly", () => {
    const { gl, gb } = raDecToGalactic(266.417, -29.008)
    expect(gl).toBeCloseTo(0, 0)
    expect(gb).toBeCloseTo(0, 0)
  })
})

describe("galacticToCartesian", () => {
  it("galactic center direction gives x=d, y~0, z~0", () => {
    const v = galacticToCartesian(0, 0, 8.5)
    expect(v.x).toBeCloseTo(8.5, 5)
    expect(v.y).toBeCloseTo(0, 5)
    expect(v.z).toBeCloseTo(0, 5)
  })

  it("north galactic pole gives z=d", () => {
    const v = galacticToCartesian(0, 90, 1.0)
    expect(v.x).toBeCloseTo(0, 5)
    expect(v.y).toBeCloseTo(0, 5)
    expect(v.z).toBeCloseTo(1.0, 5)
  })
})

describe("cartesianToGalactic", () => {
  it("round-trips through Cartesian", () => {
    const gl = 123.45, gb = -30.5, dist = 2.5
    const cart = galacticToCartesian(gl, gb, dist)
    const result = cartesianToGalactic(cart)
    expect(result.gl).toBeCloseTo(gl, 4)
    expect(result.gb).toBeCloseTo(gb, 4)
    expect(result.dist).toBeCloseTo(dist, 4)
  })
})

describe("relativePosition", () => {
  it("returns identity for observer at origin", () => {
    const observer = { gl: 0, gb: 0, dist: 0 }
    const target = { gl: 90, gb: 0, dist: 1.0 }
    const rel = relativePosition(observer, target)
    expect(rel.gl).toBeCloseTo(90, 4)
    expect(rel.gb).toBeCloseTo(0, 4)
    expect(rel.dist).toBeCloseTo(1.0, 4)
  })

  it("computes correct distance for opposing positions", () => {
    const observer = { gl: 180, gb: 0, dist: 1.0 }
    const target = { gl: 0, gb: 0, dist: 1.0 }
    const rel = relativePosition(observer, target)
    expect(rel.dist).toBeCloseTo(2.0, 4)
  })
})
