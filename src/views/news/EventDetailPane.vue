<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue'
import SkeletonLoader from '@/components/common/SkeletonLoader.vue'
import { useNow } from '@/composables/useNow'
import EventMissionsPanel from '@/views/news/EventMissionsPanel.vue'
import RewardItemTile from '@/views/news/RewardItemTile.vue'
import type { EventResponse } from '@/types/api/events'
import {
  EVENT_STATUS_COLOR,
  eventCountdown,
  eventStatus,
  missionViewFromDefinition,
  missionViewFromProgress,
  type EventMissionView,
} from '@/utils/events'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  eventId: string
  loggedIn: boolean
}>()

const emit = defineEmits<{
  loaded: [event: EventResponse | null]
}>()

const now = useNow()

const event = ref<EventResponse | null>(null)
const missions = ref<EventMissionView[]>([])
const bonusAwarded = ref(false)
const loading = ref(true)
const failed = ref(false)

const status = computed(() => (event.value ? eventStatus(event.value, now.value) : 'past'))
const statusColor = computed(() => EVENT_STATUS_COLOR[status.value])
const countdown = computed(() => (event.value ? eventCountdown(event.value, now.value) : null))

const timing = computed(() => {
  const e = event.value
  if (!e) return ''
  const parts: string[] = []
  if (status.value === 'past') return `Ran ${formatDate(e.startsAt)} to ${formatDate(e.endsAt)}`
  if (status.value === 'upcoming') {
    parts.push(`Begins ${formatDate(e.startsAt)}`)
    if (e.totalWeeks > 1) parts.push(`${e.totalWeeks} weeks`)
    return parts.join(' · ')
  }
  if (e.currentWeek) parts.push(`Week ${e.currentWeek} of ${e.totalWeeks}`)
  parts.push(`Ends ${formatDate(e.endsAt)}`)
  return parts.join(' · ')
})

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

async function load(id: string, loggedIn: boolean) {
  loading.value = true
  failed.value = false
  try {
    const api = await import('@/api/events')
    if (loggedIn) {
      const res = await api.getEventProgress(id)
      event.value = res.event
      missions.value = res.missions.map(missionViewFromProgress)
      bonusAwarded.value = res.bonusAwarded
    } else {
      const res = await api.getEventDetail(id)
      event.value = res.event
      missions.value = res.missions.map(missionViewFromDefinition)
      bonusAwarded.value = false
    }
  } catch {
    event.value = null
    missions.value = []
    failed.value = true
  } finally {
    loading.value = false
    emit('loaded', event.value)
  }
}

watch(
  () => [props.eventId, props.loggedIn] as const,
  ([id, loggedIn]) => load(id, loggedIn),
  { immediate: true },
)
</script>

<template>
  <div class="event-detail" :style="{ '--status-accent': statusColor }">
    <div v-if="loading" class="event-detail__loading">
      <SkeletonLoader variant="text" style="height: 56px; width: 70%" />
      <SkeletonLoader variant="text" style="height: 22px; width: 45%; margin-top: var(--space-md)" />
      <SkeletonLoader variant="card" style="height: 240px; margin-top: var(--space-xl)" />
    </div>

    <EmptyState v-else-if="failed || !event" message="This event couldn't be loaded." />

    <div v-else class="event-detail__grid">
      <div class="event-detail__lead">
        <h1 class="event-detail__title">{{ event.title }}</h1>

        <p v-if="countdown" class="event-detail__countdown">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <polyline points="12 7 12 12 15 14" />
          </svg>
          {{ countdown }}
        </p>
        <p class="event-detail__timing">{{ timing }}</p>

        <p v-if="event.description" class="event-detail__description">{{ event.description }}</p>

        <div v-if="event.bonusXp || event.bonusItems.length" class="event-detail__bonus">
          <div class="event-detail__bonus-head">
            <span class="event-detail__bonus-label">Complete all missions to earn</span>
            <span v-if="bonusAwarded" class="event-detail__bonus-claimed">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
                stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Claimed
            </span>
          </div>
          <div class="event-detail__bonus-rewards">
            <div v-if="event.bonusXp" class="event-detail__xp-tile" :title="`${event.bonusXp?.toLocaleString()} XP`">
              <span class="event-detail__xp-amount">{{ event.bonusXp?.toLocaleString() }}</span>
              <span class="event-detail__xp-label">XP</span>
            </div>
            <RewardItemTile
              v-for="item in event.bonusItems"
              :key="item.id"
              :item-id="item.id"
              :name="item.name"
              :size="64"
            />
          </div>
        </div>

        <p v-if="!loggedIn" class="event-detail__signin">Log in to track your mission progress.</p>
      </div>

      <EventMissionsPanel
        class="event-detail__missions"
        :missions="missions"
        :current-week="event.currentWeek ?? null"
        :total-weeks="event.totalWeeks"
      />
    </div>
  </div>
</template>

<style scoped>
.event-detail {
  --page-accent: var(--accent-overall);
}

.event-detail__loading {
  display: flex;
  flex-direction: column;
}

.event-detail__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
  gap: var(--space-3xl);
  align-items: start;
}

.event-detail__lead {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  min-width: 0;
}

.event-detail__title {
  margin: var(--space-xs) 0 0;
  font-size: clamp(2rem, 3.4vw, 3rem);
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: -0.015em;
  color: var(--text-primary);
}

.event-detail__countdown {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  align-self: flex-start;
  margin: 0;
  color: var(--status-accent);
  font-size: 1.05rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.event-detail__timing {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.event-detail__description {
  margin: var(--space-xs) 0 0;
  max-width: 62ch;
  font-size: 1.0625rem;
  line-height: 1.7;
  color: var(--text-secondary);
  white-space: pre-line;
}

.event-detail__bonus {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
  padding: var(--space-md) var(--space-lg);
  width: fit-content;
  max-width: 100%;
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  background: var(--bg-surface);
}

.event-detail__bonus-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.event-detail__bonus-label {
  font-size: var(--text-caption);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
}

.event-detail__bonus-claimed {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--success);
}

.event-detail__bonus-rewards {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  align-items: center;
}

.event-detail__xp-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  border: 1px solid color-mix(in srgb, var(--tier-gold) 45%, transparent);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--tier-gold) 8%, var(--bg-base));
  color: var(--tier-gold);
}

.event-detail__xp-amount {
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 0.85rem;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.event-detail__xp-label {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.event-detail__signin {
  margin: var(--space-xs) 0 0;
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

@media (max-width: 959px) {
  .event-detail__grid {
    grid-template-columns: 1fr;
    gap: var(--space-2xl);
  }

  .event-detail__title {
    font-size: clamp(1.75rem, 7vw, 2.25rem);
  }
}
</style>
