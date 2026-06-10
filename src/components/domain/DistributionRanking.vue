<script setup lang="ts">
import type { DistributionEntryResponse } from '@/types/api/statistics';

const props = withDefaults(
  defineProps<{
    title: string
    entries: DistributionEntryResponse[]
    accentColor?: string
    maxEntries?: number
  }>(),
  {
    accentColor: 'var(--accent)',
    maxEntries: 8,
  },
)

const visibleEntries = computed(() => props.entries.slice(0, props.maxEntries))
const maxCount = computed(() => Math.max(...props.entries.map((e) => e.count), 1))

import { computed } from 'vue';
</script>

<template>
  <div class="distribution-ranking">
    <h3 class="distribution-ranking__title">{{ title }}</h3>
    <div class="distribution-ranking__list">
      <div v-for="(entry, index) in visibleEntries" :key="entry.label" class="distribution-ranking__row">
        <div class="distribution-ranking__bar" :style="{
          '--progress': entry.count / maxCount,
          backgroundColor: accentColor,
        }" />
        <span class="distribution-ranking__rank">{{ index + 1 }}</span>
        <span class="distribution-ranking__label">{{ entry.label }}</span>
        <span class="distribution-ranking__count">{{ entry.count.toLocaleString() }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.distribution-ranking {
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: 6px;
  padding: var(--space-md);
  overflow: hidden;
}

.distribution-ranking__title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  margin: 0 0 var(--space-sm);
}

.distribution-ranking__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.distribution-ranking__row {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  border-radius: 4px;
  overflow: hidden;
  min-height: 32px;
}

.distribution-ranking__row:nth-child(odd) {
  background: var(--bg-surface);
}

.distribution-ranking__row:nth-child(even) {
  background: var(--bg-elevated);
}

.distribution-ranking__bar {
  position: absolute;
  inset: 0;
  opacity: 0.12;
  border-radius: 4px;
  pointer-events: none;
  transform-origin: left;
  transform: scaleX(var(--progress, 0));
  transition: transform 300ms ease-out;
}

.distribution-ranking__rank {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-tertiary);
  min-width: 20px;
  text-align: right;
  position: relative;
}

.distribution-ranking__label {
  flex: 1;
  font-size: 0.875rem;
  color: var(--text-primary);
  position: relative;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.distribution-ranking__count {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  color: var(--text-secondary);
  position: relative;
  white-space: nowrap;
}
</style>
