<script setup lang="ts">
import type { EventProfileResponse } from '@/types/api/events'
import { computed } from 'vue'

const props = defineProps<{
  profile: EventProfileResponse
  totalMissions: number
  totalWeeks: number
}>()

const pct = computed(() =>
  props.totalMissions > 0
    ? Math.min(100, Math.round((props.profile.missionsCompleted / props.totalMissions) * 100))
    : 0,
)

const completed = computed(() => props.profile.completedAt != null || props.profile.bonusAwarded)
const unlockedWeek = computed(() => Math.min(props.profile.unlockedWeek, props.totalWeeks))
</script>

<template>
  <div class="event-progress" :class="{ 'event-progress--done': completed }">
    <div class="event-progress__head">
      <span class="event-progress__label">
        <svg v-if="completed" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        {{ completed ? 'Event complete' : 'Your progress' }}
      </span>
      <span class="event-progress__count">{{ profile.missionsCompleted }} / {{ totalMissions }} missions</span>
    </div>

    <div class="event-progress__track">
      <div class="event-progress__fill" :style="{ width: `${pct}%` }" />
    </div>

    <div class="event-progress__meta">
      <span class="event-progress__pct">{{ pct }}%</span>
      <span v-if="totalWeeks > 1">Week {{ unlockedWeek }} of {{ totalWeeks }} unlocked</span>
    </div>
  </div>
</template>

<style scoped>
.event-progress {
  --bar-accent: var(--page-accent, var(--accent));
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-lg);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  background: var(--bg-surface);
}

.event-progress--done {
  --bar-accent: var(--success);
  border-color: color-mix(in srgb, var(--success) 40%, var(--bg-overlay));
}

.event-progress__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-md);
}

.event-progress__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-caption);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--bar-accent);
}

.event-progress__count {
  font-family: var(--font-mono);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.event-progress__track {
  height: 10px;
  border-radius: var(--radius-pill);
  background: var(--bg-overlay);
  overflow: hidden;
}

.event-progress__fill {
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--bar-accent);
  transition: width 400ms ease;
}

.event-progress__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.event-progress__pct {
  color: var(--bar-accent);
  font-weight: 600;
}
</style>
