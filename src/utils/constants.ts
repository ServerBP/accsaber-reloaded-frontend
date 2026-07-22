import type { MetricType, TimeRange } from '@/types/display';

export const TIME_RANGE_PARAMS: Record<TimeRange, { amount: number; unit: 'h' | 'd' | 'w' | 'mo' }> = {
  '24h': { amount: 24, unit: 'h' },
  '7d': { amount: 7, unit: 'd' },
  '14d': { amount: 14, unit: 'd' },
  '30d': { amount: 30, unit: 'd' },
  '90d': { amount: 90, unit: 'd' },
  '1y': { amount: 12, unit: 'mo' },
  'all': { amount: 240, unit: 'mo' },
}

export const DIFFICULTY_ORDER = ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'EXPERT_PLUS'] as const

export const DIFF_COLOR: Record<string, string> = {
  EASY: 'var(--diff-easy)',
  NORMAL: 'var(--diff-normal)',
  HARD: 'var(--diff-hard)',
  EXPERT: 'var(--diff-expert)',
  EXPERT_PLUS: 'var(--diff-expert-plus)',
}

export const MAP_STATUS_ACCENT: Record<string, string> = {
  QUEUE: 'var(--accent-overall)',
  QUALIFIED: 'var(--accent-low-mid)',
  RANKED: 'var(--accent-standard-acc)',
}

import type { MapDifficultyStatus } from '@/types/enums'

export const QUEUE_STATUSES: MapDifficultyStatus[] = ['QUEUE', 'QUALIFIED']

import type { NewsType } from '@/types/enums'

export const NEWS_TYPE_LABELS: Record<NewsType, string> = {
  GENERAL: 'General',
  BATCH: 'Batch',
  CAMPAIGN: 'Campaign',
  MILESTONE_SET: 'Milestones',
  ITEMS: 'Items',
  PLUGIN: 'Plugin',
  CURVE: 'Curve',
}

export const NEWS_TYPE_ACCENT: Record<NewsType, string> = {
  GENERAL: 'var(--text-secondary)',
  BATCH: 'var(--accent-standard-acc)',
  CAMPAIGN: 'var(--accent-overall)',
  MILESTONE_SET: 'var(--tier-gold)',
  ITEMS: 'var(--tier-platinum)',
  PLUGIN: 'var(--tier-bronze)',
  CURVE: 'var(--accent-true-acc)',
}

export const NEWS_TYPE_ORDER: NewsType[] = [
  'GENERAL',
  'BATCH',
  'CAMPAIGN',
  'MILESTONE_SET',
  'ITEMS',
  'PLUGIN',
  'CURVE',
]

export const STANDALONE_NEWS_TYPES: NewsType[] = ['GENERAL', 'ITEMS', 'PLUGIN']

import type { EventState } from '@/types/api/events'

export const EVENT_STATE_LABELS: Record<EventState, string> = {
  live: 'Live',
  upcoming: 'Upcoming',
  past: 'Past',
}

export const EVENT_STATE_ORDER: EventState[] = ['live', 'upcoming', 'past']

export const EVENT_STATE_ACCENT: Record<EventState, string> = {
  live: 'var(--success)',
  upcoming: 'var(--accent-overall)',
  past: 'var(--text-tertiary)',
}

export const CATEGORY_ORDER = ['true_acc', 'standard_acc', 'tech_acc', 'low_mid', 'overall'] as const

export const KOFI_URL = 'https://ko-fi.com/accsaberreloaded'

export const DISCORD_URL = 'https://discord.gg/DmzKSgcJWe'

export const ROLE_ORDER: Record<string, number> = {
  ADMIN: 0,
  DEVELOPER: 1,
  MODERATOR: 2,
  RANKING_HEAD: 3,
  RANKING: 4,
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  DEVELOPER: 'Developer',
  MODERATOR: 'Moderator',
  RANKING_HEAD: 'Head Ranking',
  RANKING: 'Ranking',
}


export const SCORE_DETAIL_METRICS: { key: MetricType; label: string }[] = [
  { key: 'accuracy' as MetricType, label: 'Accuracy' },
  { key: 'ap' as MetricType, label: 'AP' },
  { key: 'xpCumulative', label: 'XP (Cumulative)' },
  { key: 'xpPerAttempt', label: 'XP (Per Attempt)' },
]

export const MAP_STATS_METRICS: { key: MetricType; label: string }[] = [
  { key: 'ap', label: 'Max AP' },
  { key: 'avgAccuracy', label: 'Avg Accuracy' },
  { key: 'rankedPlays', label: 'Total Scores' },
]

export const TIER_COLORS: Record<string, string> = {
  BRONZE: 'var(--tier-bronze)',
  SILVER: 'var(--tier-silver)',
  GOLD: 'var(--tier-gold)',
  PLATINUM: 'var(--tier-platinum)',
  DIAMOND: 'var(--tier-diamond)',
  APEX: 'var(--tier-apex)',
}

export const TIER_ORDER: Record<string, number> = {
  BRONZE: 0, bronze: 0,
  SILVER: 1, silver: 1,
  GOLD: 2, gold: 2,
  PLATINUM: 3, platinum: 3,
  DIAMOND: 4, diamond: 4,
  APEX: 5, apex: 5,
}

export const TIER_SCALES: Record<string, number> = {
  BRONZE: 0.8,
  SILVER: 0.9,
  GOLD: 1.0,
  PLATINUM: 1.15,
  DIAMOND: 1.3,
  APEX: 1.8,
}

export function tierColor(tier: string): string {
  return TIER_COLORS[tier.toUpperCase()] ?? 'var(--text-tertiary)'
}

export function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function formatPercent(value: number, decimals = 1): string {
  if (value >= 100) return '100'
  if (value <= 0) return '0'
  const formatted = value.toFixed(decimals)
  if (formatted === (100).toFixed(decimals)) {
    return (100 - Math.pow(10, -decimals)).toFixed(decimals)
  }
  if (formatted === (0).toFixed(decimals)) {
    for (let d = decimals + 1; d <= 10; d++) {
      const attempt = value.toFixed(d)
      if (parseFloat(attempt) > 0) return attempt
    }
  }
  return formatted
}

export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}
