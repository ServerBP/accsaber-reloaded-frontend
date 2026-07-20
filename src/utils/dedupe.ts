const inFlight = new Map<string, Promise<unknown>>()

/**
 * Shares one call between identical concurrent requests. Entries clear on
 * settle, so results are never cached across refetches - this collapses
 * duplicate in-flight work only. Keys must be namespaced by the caller.
 */
export function dedupeRequest<T>(key: string, request: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined
  if (existing) return existing
  const pending = request().finally(() => inFlight.delete(key))
  inFlight.set(key, pending)
  return pending
}
