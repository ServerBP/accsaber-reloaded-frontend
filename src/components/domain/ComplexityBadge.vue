<script setup lang="ts">
import { computed } from 'vue'
import { useAppearance } from '@/composables/useAppearance'
import {
  COMPLEXITY_GRADIENT,
  COMPLEXITY_GRADIENT_GHOST,
  complexityColor,
  complexityPercent,
} from '@/utils/complexity'

const props = defineProps<{
  complexity: number
}>()

const { complexityNumberStyle, complexityBar: showBar } = useAppearance()

const formatted = computed(() => props.complexity.toFixed(1))

const styles = computed(() => ({
  '--complexity-percent': Math.max(complexityPercent(props.complexity), 0.5).toFixed(2),
  '--complexity-gradient': COMPLEXITY_GRADIENT,
  '--complexity-gradient-ghost': COMPLEXITY_GRADIENT_GHOST,
  '--complexity-value-color': complexityNumberStyle.value === 'colored'
    ? complexityColor(props.complexity)
    : 'var(--text-primary)',
}))
</script>

<template>
  <span class="complexity-badge" :class="{ 'complexity-badge--barred': showBar }" :style="styles">
    <span class="complexity-badge__value">{{ formatted }}</span>
    <span v-if="showBar" class="complexity-badge__track" aria-hidden="true">
      <span class="complexity-badge__fill" />
    </span>
  </span>
</template>

<style scoped>
.complexity-badge {
  display: inline-flex;
  align-items: center;
  color: var(--complexity-value-color);
  font-family: var(--font-mono);
  font-size: var(--text-body);
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}

.complexity-badge--barred {
  flex-direction: column;
  align-items: stretch;
  gap: 3px;
  min-width: 42px;
}

.complexity-badge__track {
  position: relative;
  overflow: hidden;
  height: 3px;
  border-radius: 2px;
  background-image: var(--complexity-gradient-ghost);
}

.complexity-badge__fill {
  position: absolute;
  inset: 0 auto 0 0;
  min-width: 2px;
  width: calc(var(--complexity-percent) * 1%);
  background-image: var(--complexity-gradient);
  background-size: calc(10000% / var(--complexity-percent)) 100%;
  transition: width 200ms ease-out;
}
</style>
