import type { ItemResponse } from './items'
import type { MissionResponse, MissionType } from './missions'

export type EventState = 'live' | 'upcoming' | 'past'

export interface EventBonusItem {
  id: string
  name: string
}

export interface EventResponse {
  id: string
  slug: string
  title: string
  description?: string
  backgroundUrl?: string
  iconUrl?: string
  startsAt: string
  endsAt: string
  bonusXp?: number
  bonusItems: ItemResponse[]
  active: boolean
  live: boolean
  currentWeek?: number | null
  totalWeeks: number
}

export interface EventDetailResponse {
  event: EventResponse
  missions: MissionResponse[]
}

export interface EventMissionProgressResponse {
  mission: MissionResponse
  current?: MissionResponse
  completions: number
  completed: boolean
  weekLocked: boolean
}

export interface EventProfileResponse {
  unlockedWeek: number
  missionsCompleted: number
  startedAt: string
  completedAt?: string | null
  bonusAwarded: boolean
  bonusXp: number
}

export interface EventProgressResponse {
  event: EventResponse
  profile: EventProfileResponse | null
  begun: boolean
  missions: EventMissionProgressResponse[]
  bonusAwarded: boolean
}

export interface EventListParams {
  state?: EventState
}

export interface EventRequest {
  title?: string
  slug?: string
  description?: string
  backgroundUrl?: string
  iconUrl?: string
  startsAt?: string
  endsAt?: string
  bonusXp?: number
  bonusItemIds?: string[]
  active?: boolean
}

export interface MissionTemplateTargets {
  categoryId?: string
  mapDifficultyId?: string
  playerId?: string
  acc?: number
  ap?: number
  score?: number
  count?: number
  xp?: number
  thresholdAp?: number
  streak?: number
}

export interface MissionTemplateResponse {
  id: string
  code: string
  name: string
  description: string
  type: MissionType
  pool: string
  weight: number
  guaranteedDoable: boolean
  xpCurveId?: string
  awardsItemId?: string
  awardsItemName?: string
  xpMultiplier: number
  bandEasy: number
  bandMedium: number
  bandHard: number
  targetCountMin?: number
  targetCountMax?: number
  active: boolean
  eventId?: string
  unlocksAt?: string
  completableUntil?: string
  repeatable?: boolean
  maxCompletions?: number
  fixedXp?: number
  targets?: MissionTemplateTargets
}
