import { describe, expect, it } from "vitest"
import { createLatestOnlyRunner } from "../async-latest"

describe("createLatestOnlyRunner", () => {
  it("marks only the most recent request as current", async () => {
    const resolvers = new Map<string, (value: string) => void>()
    const run = createLatestOnlyRunner(
      (label: string) =>
        new Promise<string>((resolve) => {
          resolvers.set(label, resolve)
        }),
    )

    const first = run("first")
    const second = run("second")

    resolvers.get("second")?.("second-result")
    resolvers.get("first")?.("first-result")

    await expect(second).resolves.toEqual({
      value: "second-result",
      isLatest: true,
    })
    await expect(first).resolves.toEqual({
      value: "first-result",
      isLatest: false,
    })
  })
})
