import type { MissionType, UserMissionResponse } from './missions'

export type EventState = 'live' | 'upcoming' | 'past'

export interface EventBonusItem {
  id: string
  name: string
}

export interface EventResponse {
  id: string
  title: string
  description?: string
  backgroundUrl?: string
  iconUrl?: string
  startsAt: string
  endsAt: string
  bonusXp?: number
  bonusItems: EventBonusItem[]
  active: boolean
  live: boolean
  currentWeek?: number
  totalWeeks: number
}

export interface EventMissionTargets {
  categoryId?: string
  mapDifficultyId?: string
  playerId?: number
  acc?: number
  ap?: number
  score?: number
  count?: number
  xp?: number
  thresholdAp?: number
  streak?: number
}

export interface EventMissionResponse {
  id: string
  code: string
  name: string
  description: string
  type: MissionType
  unlocksAt: string
  completableUntil: string
  week: number
  unlocked: boolean
  open: boolean
  repeatable: boolean
  maxCompletions?: number
  xp?: number
  awardsItemId?: string
  awardsItemName?: string
  targets?: EventMissionTargets
  categoryCode?: string
  targetMapSongName?: string
  targetPlayerName?: string
}

export interface EventDetailResponse {
  event: EventResponse
  missions: EventMissionResponse[]
}

export interface EventMissionProgressResponse {
  mission: EventMissionResponse
  current?: UserMissionResponse
  completions: number
  completed: boolean
}

export interface EventProgressResponse {
  event: EventResponse
  missions: EventMissionProgressResponse[]
  bonusAwarded: boolean
}

export interface EventListParams {
  state?: EventState
}

export interface EventRequest {
  title?: string
  description?: string
  backgroundUrl?: string
  iconUrl?: string
  startsAt?: string
  endsAt?: string
  bonusXp?: number
  bonusItemIds?: string[]
  active?: boolean
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
  targets?: EventMissionTargets
}
