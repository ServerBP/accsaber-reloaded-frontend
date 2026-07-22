import type { PracticeScoreSubmission } from '@/types/api/practiceScores'

const SCORES_KEY = 'range:scores'
const PENDING_KEY = 'range:pending'
const NAME_KEY = 'range:name'
const MAX_LOCAL = 50
const MAX_PENDING = 20

function loadList(key: string): PracticeScoreSubmission[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? (parsed as PracticeScoreSubmission[]) : []
  } catch {
    return []
  }
}

export function loadLocalScores(): PracticeScoreSubmission[] {
  return loadList(SCORES_KEY)
}

export function addLocalScore(entry: PracticeScoreSubmission): PracticeScoreSubmission[] {
  const scores = [...loadLocalScores(), entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_LOCAL)
  localStorage.setItem(SCORES_KEY, JSON.stringify(scores))
  const pending = [...loadList(PENDING_KEY), entry].slice(-MAX_PENDING)
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
  return scores
}

export function loadLastName(): string {
  return localStorage.getItem(NAME_KEY) ?? ''
}

export function saveLastName(name: string) {
  localStorage.setItem(NAME_KEY, name)
}

export async function flushPendingScores(): Promise<void> {
  const pending = loadList(PENDING_KEY)
  if (pending.length === 0) return
  const { submitPracticeScores } = await import('@/api/practiceScores')
  try {
    await submitPracticeScores(pending)
    localStorage.removeItem(PENDING_KEY)
  } catch {
  }
}
