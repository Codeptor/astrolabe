const H_FREQ = 1_420_405_751.768 // Hz — hydrogen 21cm spin-flip
const H_PERIOD = 1 / H_FREQ       // ~7.04024e-10 seconds

export function periodToBinary(periodSeconds: number): bigint {
  const units = Math.round(periodSeconds / H_PERIOD)
  return BigInt(units)
}

export function binaryToTicks(value: bigint): (0 | 1)[] {
  if (value === 0n) return [0]
  const bits: (0 | 1)[] = []
  let v = value
  while (v > 0n) {
    bits.unshift((v & 1n) === 1n ? 1 : 0)
    v >>= 1n
  }
  return bits
}

export function periodToTicks(periodSeconds: number): (0 | 1)[] {
  return binaryToTicks(periodToBinary(periodSeconds))
}
