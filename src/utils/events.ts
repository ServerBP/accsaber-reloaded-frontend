import type { EventMissionProgressResponse, EventResponse } from '@/types/api/events'
import type { ItemResponse } from '@/types/api/items'
import type { MissionResponse } from '@/types/api/missions'

export interface EventMissionView {
  id: string
  name: string
  description: string
  week: number
  unlocked: boolean
  unlocksAt: string
  open: boolean
  completed: boolean
  repeatable: boolean
  completions: number | null
  maxCompletions: number | null
  progressCurrent: number | null
  progressTarget: number | null
  xpReward: number | null
  itemReward: ItemResponse | null
  tracked: boolean
  weekLocked: boolean
}

export function missionViewFromDefinition(def: MissionResponse): EventMissionView {
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    week: def.week ?? 1,
    unlocked: def.unlocked ?? false,
    unlocksAt: def.unlocksAt ?? '',
    open: def.open ?? false,
    completed: false,
    repeatable: def.repeatable ?? false,
    completions: null,
    maxCompletions: def.maxCompletions ?? null,
    progressCurrent: null,
    progressTarget: def.targetCount ?? null,
    xpReward: def.xpReward ?? null,
    itemReward: def.itemReward ?? null,
    tracked: false,
    weekLocked: false,
  }
}

export function missionViewFromProgress(entry: EventMissionProgressResponse): EventMissionView {
  const def = entry.mission
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    week: def.week ?? 1,
    unlocked: def.unlocked ?? false,
    unlocksAt: def.unlocksAt ?? '',
    open: def.open ?? false,
    completed: entry.completed,
    repeatable: def.repeatable ?? false,
    completions: entry.completions,
    maxCompletions: def.maxCompletions ?? null,
    progressCurrent: entry.current?.progressCount ?? null,
    progressTarget: entry.current?.targetCount ?? def.targetCount ?? null,
    xpReward: def.xpReward ?? null,
    itemReward: def.itemReward ?? null,
    tracked: true,
    weekLocked: entry.weekLocked,
  }
}

export type MissionLock = 'not-begun' | 'calendar' | 'progression' | null

export interface MissionLockContext {
  begun: boolean | null
  currentWeek: number | null
  live: boolean
}

export function missionLockState(view: EventMissionView, ctx: MissionLockContext): MissionLock {
  if (ctx.begun === false) return 'not-begun'
  if (!ctx.live || ctx.currentWeek == null || view.week > ctx.currentWeek) return 'calendar'
  if (view.weekLocked) return 'progression'
  return null
}

export type EventStatus = 'live' | 'ending-soon' | 'upcoming' | 'past'

const ENDING_SOON_MS = 24 * 60 * 60 * 1000

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  live: 'Live',
  'ending-soon': 'Ending soon',
  upcoming: 'Upcoming',
  past: 'Ended',
}

export const EVENT_STATUS_COLOR: Record<EventStatus, string> = {
  live: 'var(--success)',
  'ending-soon': 'var(--warning)',
  upcoming: 'var(--info)',
  past: 'var(--text-tertiary)',
}

export function eventStatus(event: EventResponse, now: number): EventStatus {
  const start = new Date(event.startsAt).getTime()
  const end = new Date(event.endsAt).getTime()
  if (now < start) return 'upcoming'
  if (now >= end) return 'past'
  return end - now <= ENDING_SOON_MS ? 'ending-soon' : 'live'
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function eventCountdown(event: EventResponse, now: number): string {
  const status = eventStatus(event, now)
  if (status === 'past') return 'Ended'
  if (status === 'upcoming') {
    const diff = new Date(event.startsAt).getTime() - now
    return diff <= 0 ? 'Starting now' : `Starts in ${formatDuration(diff)}`
  }
  const diff = new Date(event.endsAt).getTime() - now
  return diff <= 0 ? 'Ending now' : `Ending in ${formatDuration(diff)}`
}

export type EventTiming = 'live' | 'upcoming' | 'past'

export function eventTiming(event: EventResponse, now: number): EventTiming {
  const start = new Date(event.startsAt).getTime()
  const end = new Date(event.endsAt).getTime()
  if (now < start) return 'upcoming'
  if (now >= end) return 'past'
  return 'live'
}

export const EVENT_TIMING_LABEL: Record<EventTiming, string> = {
  live: 'Live',
  upcoming: 'Upcoming',
  past: 'Ended',
}

export const EVENT_TIMING_COLOR: Record<EventTiming, string> = {
  live: 'var(--success)',
  upcoming: 'var(--info)',
  past: 'var(--text-tertiary)',
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function isoToLocalInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function localInputToIso(local: string): string | null {
  if (!local) return null
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
