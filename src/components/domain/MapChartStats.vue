<script setup lang="ts">
import type { MapChartStatsSource } from '@/types/api/maps'
import { buildChartStats } from '@/utils/chartMetadata'
import { computed } from 'vue'

const props = defineProps<{
  source: MapChartStatsSource | null
}>()

const stats = computed(() => buildChartStats(props.source))
</script>

<template>
  <div v-if="stats.length > 0" class="chart-stats">
    <div v-for="stat in stats" :key="stat.key" class="chart-stats__item">
      <span class="chart-stats__label">{{ stat.label }}</span>
      <span class="chart-stats__value">{{ stat.value }}</span>
    </div>
  </div>
</template>

<style scoped>
.chart-stats {
  display: grid;
  width: 100%;
  max-width: 520px;
  grid-template-columns: repeat(auto-fit, minmax(64px, 1fr));
  gap: var(--space-xs) var(--space-md);
  padding: var(--space-sm) 0;
  border-top: 1px solid var(--bg-overlay);
  border-bottom: 1px solid var(--bg-overlay);
}

.chart-stats__item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.chart-stats__label {
  font-size: 0.5625rem;
  font-weight: 700;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.chart-stats__value {
  font-family: var(--font-mono);
  font-size: var(--text-stat-inline);
  font-weight: 500;
  color: var(--text-secondary);
}
</style>
