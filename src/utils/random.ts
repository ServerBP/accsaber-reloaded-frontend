export function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function hash01(n: number): number {
  let h = (n * 1103515245 + 12345) >>> 0
  h ^= h >>> 15
  h = (h * 2246822519) >>> 0
  return (h % 100000) / 100000
}

export function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) || 1
}

export function makeRng(seed: string): () => number {
  let k = hashSeed(seed)
  return () => {
    k = (Math.imul(k, 1103515245) + 12345) & 0x7fffffff
    return (k >> 8) / 0x7fffff
  }
}
