<script setup lang="ts">
import type { StatsDiffResponse } from '@/types/api/users'
import { computed } from 'vue'

const props = defineProps<{
  statsDiff: StatsDiffResponse | null
}>()

const totalXpDiff = computed(() => {
  const d = props.statsDiff
  if (!d) return 0
  return (d.scoreXpDiff ?? 0)
    + (d.milestoneXpDiff ?? 0)
    + (d.milestoneSetBonusXpDiff ?? 0)
    + (d.missionXpDiff ?? 0)
})

const direction = computed<'up' | 'down' | null>(() => {
  if (!totalXpDiff.value) return null
  return totalXpDiff.value > 0 ? 'up' : 'down'
})

function withSign(value: number | null | undefined): string {
  const n = Math.round(value ?? 0)
  return n >= 0 ? `+${n}` : `${n}`
}
</script>

<template>
  <span v-if="direction" class="xp-trend" :class="`xp-trend--${direction}`">
    {{ direction === 'up' ? '\u25B2' : '\u25BC' }}
    {{ withSign(totalXpDiff) }} XP
    <span class="xp-trend__info" tabindex="0" aria-label="XP breakdown">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span class="xp-trend__tooltip" role="tooltip">
        <span class="xp-trend__row">
          <span class="xp-trend__label">Score XP</span>
          <span class="xp-trend__value xp-trend__value--score">{{ withSign(statsDiff?.scoreXpDiff) }}</span>
        </span>
        <span class="xp-trend__row">
          <span class="xp-trend__label">Milestone XP</span>
          <span class="xp-trend__value xp-trend__value--milestone">{{ withSign(statsDiff?.milestoneXpDiff) }}</span>
        </span>
        <span class="xp-trend__row">
          <span class="xp-trend__label">Set Bonus XP</span>
          <span class="xp-trend__value xp-trend__value--set-bonus">{{ withSign(statsDiff?.milestoneSetBonusXpDiff) }}</span>
        </span>
        <span class="xp-trend__row">
          <span class="xp-trend__label">Mission XP</span>
          <span class="xp-trend__value xp-trend__value--mission">{{ withSign(statsDiff?.missionXpDiff) }}</span>
        </span>
      </span>
    </span>
  </span>
</template>

<style scoped>
.xp-trend {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
}

.xp-trend--up {
  color: var(--success);
}

.xp-trend--down {
  color: var(--error);
}

.xp-trend__info {
  position: relative;
  display: inline-flex;
  align-items: center;
  color: var(--text-tertiary);
  cursor: help;
  transition: color 120ms ease;
}

.xp-trend__info:hover,
.xp-trend__info:focus-visible {
  color: var(--text-secondary);
}

.xp-trend__tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  padding: var(--space-sm) var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 120ms ease;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.xp-trend__tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: var(--bg-overlay);
}

.xp-trend__info:hover .xp-trend__tooltip,
.xp-trend__info:focus-visible .xp-trend__tooltip {
  opacity: 1;
}

.xp-trend__row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-lg);
}

.xp-trend__label {
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.xp-trend__value {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
}

.xp-trend__value--score {
  color: var(--accent);
}

.xp-trend__value--milestone {
  color: var(--tier-gold);
}

.xp-trend__value--set-bonus {
  color: var(--tier-platinum);
}

.xp-trend__value--mission {
  color: var(--tier-diamond);
}
</style>
