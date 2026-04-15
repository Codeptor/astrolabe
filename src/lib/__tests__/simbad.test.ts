import { describe, expect, it } from "vitest"
import { buildTapLikeQuery } from "../simbad"

describe("buildTapLikeQuery", () => {
  it("adds deterministic ranking to fallback SIMBAD lookups", () => {
    const query = buildTapLikeQuery("Stephenson 2-18")

    expect(query).toContain("ORDER BY")
    expect(query).toContain("CASE")
    expect(query).toContain("LOWER(i.id)")
  })

  it("sanitizes wildcard and quote characters from user input", () => {
    const query = buildTapLikeQuery("foo%'_bar")

    expect(query).not.toContain("%'_")
    expect(query).toContain("foo")
    expect(query).toContain("bar")
  })
})
