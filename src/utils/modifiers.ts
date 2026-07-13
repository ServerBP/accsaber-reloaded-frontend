const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

export const MONTH_OPTIONS = MONTH_LABELS.map((label, i) => ({
  value: String(i + 1),
  label,
}))

export function maxDayForMonth(month: number): number {
  if (month < 1 || month > 12) return 31
  return DAYS_IN_MONTH[month - 1]
}

export function decimalToPercent(decimal: number): number {
  return Math.round(decimal * 1e6) / 1e4
}

export function percentToDecimal(percent: number): number {
  return Math.round((percent / 100) * 1e8) / 1e8
}

export function formatChancePercent(
  decimal: number | null | undefined,
  digits = 2,
): string {
  if (decimal == null) return '-'
  return `${decimalToPercent(decimal).toFixed(digits).replace(/\.?0+$/, '')}%`
}

export function isValidMonthDay(value: string): boolean {
  const m = /^(\d{2})-(\d{2})$/.exec(value)
  if (!m) return false
  const month = Number(m[1])
  const day = Number(m[2])
  if (month < 1 || month > 12) return false
  return day >= 1 && day <= maxDayForMonth(month)
}

export function toMonthDay(month: number, day: number): string {
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseMonthDay(value: string | null): { month: number; day: number } | null {
  if (!value) return null
  const m = /^(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  return { month: Number(m[1]), day: Number(m[2]) }
}

export function formatMonthDay(value: string | null | undefined): string {
  const parsed = parseMonthDay(value ?? null)
  if (!parsed) return value ?? '-'
  return `${MONTH_LABELS[parsed.month - 1] ?? '?'} ${parsed.day}`
}

export function isModifierInSeason(
  modifier: { seasonStart: string | null; seasonEnd: string | null },
  now = new Date(),
): boolean {
  const start = parseMonthDay(modifier.seasonStart)
  const end = parseMonthDay(modifier.seasonEnd)
  if (!start || !end) return true
  const md = (now.getMonth() + 1) * 100 + now.getDate()
  const from = start.month * 100 + start.day
  const to = end.month * 100 + end.day
  if (from <= to) return md >= from && md <= to
  return md >= from || md <= to
}

export function formatSeasonWindow(
  start: string | null,
  end: string | null,
): string {
  if (!start && !end) return 'Year-round'
  return `${formatMonthDay(start)} → ${formatMonthDay(end)}`
}
