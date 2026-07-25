<script setup lang="ts">
import StatBlock from '@/components/common/StatBlock.vue'
import type { MapChartStatsSource } from '@/types/api/maps'
import { buildChartStats } from '@/utils/chartMetadata'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    source: MapChartStatsSource | null
    variant?: 'tile' | 'inline'
  }>(),
  { variant: 'tile' },
)

const stats = computed(() => buildChartStats(props.source))
</script>

<template>
  <div v-if="stats.length > 0" class="chart-stats" :class="`chart-stats--${variant}`">
    <template v-if="variant === 'tile'">
      <StatBlock v-for="stat in stats" :key="stat.key" :label="stat.label" :value="stat.value" />
    </template>
    <template v-else>
      <div v-for="stat in stats" :key="stat.key" class="chart-stats__item">
        <span class="chart-stats__label">{{ stat.label }}</span>
        <span class="chart-stats__value">{{ stat.value }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.chart-stats--tile {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-sm);
}

.chart-stats--inline {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
  gap: var(--space-sm);
  padding: var(--space-sm) 0;
  border-top: 1px solid var(--bg-overlay);
  border-bottom: 1px solid var(--bg-overlay);
}

.chart-stats__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.chart-stats__label {
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.chart-stats__value {
  font-family: var(--font-mono);
  font-size: var(--text-stat-inline);
  font-weight: 500;
  color: var(--text-primary);
}
</style>
