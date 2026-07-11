<script setup lang="ts">
import { useCountUp } from '@/composables/useCountUp';
import { computed } from 'vue';

const props = defineProps<{
  label: string
  value: number | string
  icon?: string
  trend?: number
  accentColor?: string
  decimals?: number
}>()

const isNumeric = computed(() => typeof props.value === 'number')

const numericRef = computed(() => (typeof props.value === 'number' ? props.value : 0))
const { displayValue } = useCountUp(numericRef, { decimals: props.decimals ?? 2 })

const trendClass = computed(() => {
  if (!props.trend) return ''
  return props.trend > 0 ? 'stat-block__trend--up' : 'stat-block__trend--down'
})

const trendText = computed(() => {
  if (!props.trend) return ''
  const sign = props.trend > 0 ? '+' : ''
  const formatted = Number.isInteger(props.trend) ? String(props.trend) : props.trend.toFixed(2)
  return `${sign}${formatted}`
})

const trendArrow = computed(() => {
  if (!props.trend) return ''
  return props.trend > 0 ? '\u25B2' : '\u25BC'
})
</script>

<template>
  <div class="stat-block" :style="accentColor ? { '--stat-accent': accentColor } : undefined">
    <div class="stat-block__header">
      <span v-if="icon" class="stat-block__icon">{{ icon }}</span>
      <span class="stat-block__label">{{ label }}</span>
      <slot name="label-suffix" />
    </div>
    <div class="stat-block__value">
      {{ isNumeric ? displayValue : value }}
    </div>
    <div v-if="trend" class="stat-block__trend" :class="trendClass">
      {{ trendArrow }} {{ trendText }}
    </div>
  </div>
</template>

<style scoped>
.stat-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-md);
}

.stat-block__header {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.stat-block__icon {
  font-size: 1rem;
  color: var(--stat-accent, var(--text-secondary));
}

.stat-block__label {
  font-size: var(--text-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.stat-block__value {
  font-family: var(--font-mono);
  font-size: var(--text-section-heading);
  font-weight: 500;
  color: var(--text-primary);
}

.stat-block__trend {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
}

.stat-block__trend--up {
  color: var(--success);
}

.stat-block__trend--down {
  color: var(--error);
}
</style>
