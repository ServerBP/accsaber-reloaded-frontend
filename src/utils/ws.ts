export function wsOrigin(): string {
  const wsBase: string = import.meta.env.VITE_WS_BASE ?? ''
  if (wsBase) {
    try {
      const parsed = new URL(wsBase)
      return `${parsed.protocol}//${parsed.host}`
    } catch {
      return wsBase
    }
  }
  const apiBase: string = import.meta.env.VITE_API_BASE ?? ''
  try {
    const parsed = new URL(apiBase)
    const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${wsProtocol}//${parsed.host}`
  } catch {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${wsProtocol}//${window.location.host}`
  }
}

export function parseSocketJson<T>(data: unknown): T | null {
  if (typeof data !== 'string') return null
  try {
    const sanitized = data.replace(/:\s*(\d{16,})/g, ': "$1"')
    return JSON.parse(sanitized) as T
  } catch {
    return null
  }
}
