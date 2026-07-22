import type { PracticeScoreSubmission } from '@/types/api/practiceScores'
import { post } from './client'

export function submitPracticeScores(entries: PracticeScoreSubmission[]): Promise<void> {
  return post('/practice-scores', entries)
}
