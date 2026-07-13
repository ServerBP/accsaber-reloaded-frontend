<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue'
import EventMissionRow from '@/views/news/EventMissionRow.vue'
import { missionLockState, type EventMissionView } from '@/utils/events'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  missions: EventMissionView[]
  currentWeek: number | null
  totalWeeks: number
  unlockedWeek: number | null
  begun: boolean | null
  live: boolean
}>()

const activeWeek = ref(1)

const weeks = computed(() => Math.max(1, props.totalWeeks))
const showTabs = computed(() => weeks.value > 1)

function weekLocked(w: number): boolean {
  if (props.currentWeek == null || w > props.currentWeek) return true
  if (props.begun && props.unlockedWeek != null && w > props.unlockedWeek) return true
  return false
}

const weekList = computed(() =>
  Array.from({ length: weeks.value }, (_, i) => {
    const n = i + 1
    return { n, locked: weekLocked(n), current: props.currentWeek === n }
  }),
)

const visibleRows = computed(() => {
  const filtered = showTabs.value
    ? props.missions.filter((m) => m.week === activeWeek.value)
    : props.missions
  return filtered.map((mission) => ({
    mission,
    lock: missionLockState(mission, {
      begun: props.begun,
      currentWeek: props.currentWeek,
      live: props.live,
    }),
  }))
})

watch(
  () => [props.totalWeeks, props.currentWeek] as const,
  () => {
    const target = props.currentWeek ?? 1
    activeWeek.value = Math.min(weeks.value, Math.max(1, target))
  },
  { immediate: true },
)
</script>

<template>
  <section class="missions">
    <header class="missions__header">
      <h2 class="missions__title">Missions</h2>
      <div v-if="showTabs" class="week-tabs" role="tablist" aria-label="Event weeks">
        <button
          v-for="w in weekList"
          :key="w.n"
          type="button"
          role="tab"
          class="week-tab"
          :class="{ 'week-tab--active': w.n === activeWeek, 'week-tab--locked': w.locked }"
          :aria-selected="w.n === activeWeek"
          @click="activeWeek = w.n"
        >
          Week {{ w.n }}
          <svg v-if="w.locked" class="week-tab__lock" width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </button>
      </div>
    </header>

    <EmptyState v-if="!visibleRows.length" message="No missions unlocked for this week yet." />
    <div v-else class="missions__list">
      <EventMissionRow
        v-for="row in visibleRows"
        :key="row.mission.id"
        :mission="row.mission"
        :lock="row.lock"
      />
    </div>
  </section>
</template>

<style scoped>
.missions {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.missions__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.missions__title {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--text-primary);
}

.week-tabs {
  display: flex;
  gap: var(--space-lg);
  border-bottom: 1px solid var(--bg-overlay);
}

.week-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 0 var(--space-sm);
  margin-bottom: -1px;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: 600;
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease;
}

.week-tab:hover {
  color: var(--text-primary);
}

.week-tab--active {
  color: var(--text-primary);
  border-bottom-color: var(--page-accent, var(--accent));
}

.week-tab--locked {
  color: var(--text-tertiary);
}

.week-tab--locked.week-tab--active {
  color: var(--text-secondary);
}

.week-tab__lock {
  flex-shrink: 0;
}

.missions__list {
  display: flex;
  flex-direction: column;
}
</style>
