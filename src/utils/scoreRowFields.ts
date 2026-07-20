import type { ScoreRowField } from '@/types/api/settings'
import type { TableColumn } from '@/types/display'

export const SCORE_ROW_FIELD_LABELS: Record<ScoreRowField, string> = {
  difficulty: 'Difficulty',
  accuracy: 'Accuracy',
  ap: 'AP',
  weighted_ap: 'Weighted AP',
  complexity: 'Complexity',
  category: 'Category',
  streak_115: '115 streak',
  pauses: 'Pauses',
  play_count: 'Play count',
  date: 'Date',
}

export const ALL_SCORE_ROW_FIELDS = Object.keys(SCORE_ROW_FIELD_LABELS) as ScoreRowField[]

export const DEFAULT_SCORE_ROW_FIELDS: ScoreRowField[] = [
  'difficulty',
  'accuracy',
  'ap',
  'weighted_ap',
  'complexity',
  'category',
  'streak_115',
  'date',
]

const FIELD_SET = new Set<string>(ALL_SCORE_ROW_FIELDS)

export function sanitizeScoreRowFields(raw: unknown): ScoreRowField[] {
  if (!Array.isArray(raw)) return [...DEFAULT_SCORE_ROW_FIELDS]
  const seen = new Set<string>()
  const out: ScoreRowField[] = []
  for (const entry of raw) {
    if (typeof entry !== 'string' || !FIELD_SET.has(entry) || seen.has(entry)) continue
    seen.add(entry)
    out.push(entry as ScoreRowField)
  }
  return out
}

export interface ScoreColumnLayout {
  leading?: TableColumn[]
  fields: Partial<Record<ScoreRowField, TableColumn | null>>
  trailing?: TableColumn[]
}

export function buildScoreColumns(
  order: ScoreRowField[],
  layout: ScoreColumnLayout,
): TableColumn[] {
  const configured = order
    .map((field) => layout.fields[field])
    .filter((col): col is TableColumn => !!col)
  return [...(layout.leading ?? []), ...configured, ...(layout.trailing ?? [])]
}
