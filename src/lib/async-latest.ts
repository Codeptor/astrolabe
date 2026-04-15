export function createLatestOnlyRunner<TArgs extends unknown[], TResult>(
  runner: (...args: TArgs) => Promise<TResult>,
) {
  let latestRun = 0

  return async (...args: TArgs): Promise<{ value: TResult; isLatest: boolean }> => {
    const runId = ++latestRun
    const value = await runner(...args)
    return {
      value,
      isLatest: runId === latestRun,
    }
  }
}
