export function formatRelativeDate(dateString: string): string {
  const now = Date.now()
  const then = new Date(dateString).getTime()
  const diffMs = now - then
  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (years > 0) return `${years}y ago`
  if (months > 0) return `${months}mo ago`
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

export function isRecentDate(dateString: string, withinDays = 7): boolean {
  const days = (Date.now() - new Date(dateString).getTime()) / 86400000
  return days < withinDays
}

export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '...' : str
}

/**
 * A recorded score is itself a play, so an unreported or zero play count still
 * means at least one attempt.
 */
export function formatPlayCount(value: unknown): number {
  const plays = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return plays > 0 ? plays : 1
}

export function parseNullableNumber(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}
