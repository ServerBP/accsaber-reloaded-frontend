<script setup lang="ts">
import RewardItemTile from '@/views/news/RewardItemTile.vue'
import type { EventMissionView } from '@/utils/events'
import { computed } from 'vue'

const props = defineProps<{
  mission: EventMissionView
}>()

const hasBar = computed(
  () => props.mission.progressTarget !== null && props.mission.progressTarget > 0,
)

const progressPct = computed(() => {
  if (!hasBar.value) return props.mission.completed ? 100 : 0
  const current = props.mission.progressCurrent ?? 0
  const target = props.mission.progressTarget as number
  return Math.min(100, Math.max(0, (current / target) * 100))
})

const state = computed<'completed' | 'locked' | 'open'>(() => {
  if (props.mission.completed) return 'completed'
  if (!props.mission.unlocked) return 'locked'
  return 'open'
})

const completionsLabel = computed(() => {
  const m = props.mission
  if (!m.repeatable || m.completions === null) return null
  return m.maxCompletions ? `${m.completions}/${m.maxCompletions}` : `×${m.completions}`
})
</script>

<template>
  <div class="mission" :class="[`mission--${state}`]">
    <div class="mission__head">
      <span class="mission__status" :class="`mission__status--${state}`" aria-hidden="true">
        <svg v-if="state === 'completed'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <svg v-else-if="state === 'locked'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span v-else class="mission__dot" />
      </span>

      <span class="mission__name">{{ mission.name }}</span>

      <div class="mission__rewards">
        <span v-if="mission.xp" class="mission__reward mission__reward--xp">+{{ mission.xp }} XP</span>
        <RewardItemTile
          v-if="mission.itemId || mission.itemName"
          :item-id="mission.itemId"
          :name="mission.itemName"
          :size="34"
        />
      </div>
    </div>

    <p v-if="mission.description" class="mission__desc">{{ mission.description }}</p>

    <div v-if="mission.tracked" class="mission__progress">
      <template v-if="hasBar">
        <div class="mission__track">
          <div class="mission__fill" :style="{ width: `${progressPct}%` }" />
        </div>
        <span class="mission__count">{{ mission.progressCurrent ?? 0 }} / {{ mission.progressTarget }}</span>
      </template>
      <span v-else-if="state === 'completed'" class="mission__flag mission__flag--done">Completed</span>
      <span v-else-if="state === 'locked'" class="mission__flag">Locked</span>
      <span v-else class="mission__flag">In progress</span>
      <span v-if="completionsLabel" class="mission__completions">{{ completionsLabel }}</span>
    </div>

    <div v-else-if="state === 'locked'" class="mission__progress">
      <span class="mission__flag">Locked</span>
    </div>
  </div>
</template>

<style scoped>
.mission {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-md) 0;
  border-bottom: 1px solid var(--bg-overlay);
}

.mission:last-child {
  border-bottom: none;
}

.mission--locked {
  opacity: 0.55;
}

.mission__head {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.mission__status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border-radius: var(--radius-input);
}

.mission__status--completed {
  color: var(--success);
}

.mission__status--locked {
  color: var(--text-tertiary);
}

.mission__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 2px solid var(--page-accent, var(--accent));
}

.mission__name {
  flex: 1;
  min-width: 0;
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--text-primary);
}

.mission__rewards {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.mission__reward {
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  font-size: 0.68rem;
  font-weight: 600;
  white-space: nowrap;
}

.mission__reward--xp {
  color: var(--tier-gold);
  border: 1px solid color-mix(in srgb, var(--tier-gold) 35%, transparent);
}

.mission__desc {
  margin: 0;
  padding-left: calc(20px + var(--space-sm));
  font-size: var(--text-caption);
  color: var(--text-secondary);
  line-height: 1.45;
}

.mission__progress {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding-left: calc(20px + var(--space-sm));
}

.mission__track {
  flex: 1;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--bg-overlay);
  overflow: hidden;
}

.mission__fill {
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--page-accent, var(--accent));
  transition: width 300ms ease;
}

.mission__count {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.mission__flag {
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}

.mission__flag--done {
  color: var(--success);
  font-weight: 600;
}

.mission__completions {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--text-tertiary);
}
</style>
