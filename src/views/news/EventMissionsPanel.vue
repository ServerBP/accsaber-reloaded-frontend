<script setup lang="ts">
import BaseTabs from '@/components/common/BaseTabs.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import EventMissionRow from '@/views/news/EventMissionRow.vue'
import type { Tab } from '@/types/display'
import type { EventMissionView } from '@/utils/events'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  missions: EventMissionView[]
  currentWeek: number | null
  totalWeeks: number
}>()

const activeWeek = ref(1)

const weeks = computed(() => Math.max(1, props.totalWeeks))
const showTabs = computed(() => weeks.value > 1)

const weekTabs = computed<Tab[]>(() =>
  Array.from({ length: weeks.value }, (_, i) => ({
    key: String(i + 1),
    label: `Week ${i + 1}`,
  })),
)

const activeKey = computed<string>({
  get: () => String(activeWeek.value),
  set: (value) => {
    activeWeek.value = Number(value)
  },
})

const visibleMissions = computed(() => {
  if (!showTabs.value) return props.missions
  return props.missions.filter((m) => m.week === activeWeek.value)
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
      <BaseTabs v-if="showTabs" v-model="activeKey" :tabs="weekTabs" />
    </header>

    <EmptyState v-if="!visibleMissions.length" message="No missions unlocked for this week yet." />
    <div v-else class="missions__list">
      <EventMissionRow v-for="mission in visibleMissions" :key="mission.id" :mission="mission" />
    </div>
  </section>
</template>

<style scoped>
.missions {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.missions__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.missions__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}

.missions__list {
  display: flex;
  flex-direction: column;
}
</style>
