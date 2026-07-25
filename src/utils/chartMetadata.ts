import type { MapChartStatsSource } from '@/types/api/maps'

export interface ChartStat {
  key: string
  label: string
  value: string
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function formatChartNumber(value: number | null | undefined): string | null {
  const n = finite(value)
  return n === null ? null : String(Number(n.toFixed(2)))
}

export function formatChartCount(value: number | null | undefined): string | null {
  const n = finite(value)
  return n === null ? null : Math.round(n).toLocaleString()
}

export function formatChartDuration(seconds: number | null | undefined): string | null {
  const n = finite(seconds)
  if (n === null || n <= 0) return null
  const total = Math.round(n)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function buildChartStats(source: MapChartStatsSource | null | undefined): ChartStat[] {
  const meta = source?.metadata
  const entries: Array<[string, string, string | null]> = [
    ['bpm', 'BPM', formatChartNumber(meta?.bpm)],
    ['nps', 'NPS', formatChartNumber(source?.nps)],
    ['notes', 'Notes', formatChartCount(meta?.notes ?? source?.maxCombo)],
    ['bombs', 'Bombs', formatChartCount(meta?.bombs)],
    ['walls', 'Walls', formatChartCount(meta?.walls)],
    ['duration', 'Duration', formatChartDuration(meta?.duration)],
  ]
  return entries.flatMap(([key, label, value]) => (value === null ? [] : [{ key, label, value }]))
}
