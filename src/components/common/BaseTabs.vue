<script setup lang="ts">
import type { Tab } from '@/types/display'

defineProps<{
  tabs: Tab[]
  modelValue: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="base-tabs" role="tablist">
    <button v-for="tab in tabs" :key="tab.key" class="base-tabs__tab"
      :class="{ 'base-tabs__tab--active': modelValue === tab.key }"
      :style="modelValue === tab.key ? { '--tab-accent': tab.accentColor ?? 'var(--accent)' } : undefined" role="tab"
      :aria-selected="modelValue === tab.key" @click="$emit('update:modelValue', tab.key)">
      {{ tab.label }}
    </button>
  </div>
</template>

<style scoped>
.base-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  border-bottom: 1px solid var(--bg-overlay);
}

.base-tabs__tab {
  position: relative;
  padding: var(--space-sm) var(--space-md);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: 500;
  cursor: pointer;
  transition: color 120ms ease;
  white-space: nowrap;
}

.base-tabs__tab::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 3px;
  background: transparent;
}

.base-tabs__tab:hover {
  color: var(--text-primary);
}

.base-tabs__tab--active {
  color: var(--tab-accent, var(--accent));
  font-weight: 600;
}

.base-tabs__tab--active::after {
  background: var(--tab-accent, var(--accent));
}

@media (max-width: 767px) {
  .base-tabs__tab {
    white-space: normal;
    flex-shrink: 0;
  }
}
</style>
