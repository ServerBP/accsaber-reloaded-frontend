<script setup lang="ts">
import { ESSENCE_GLYPH, formatEssenceAmount } from '@/utils/essence'
import { computed } from 'vue'

const props = defineProps<{
  amount: number
}>()

const formatted = computed(() => formatEssenceAmount(props.amount))
</script>

<template>
  <span class="essence-amount" :aria-label="`${formatted} essence`">
    <span class="essence-amount__glyph" aria-hidden="true">{{ ESSENCE_GLYPH }}</span>
    <span class="essence-amount__value">{{ formatted }}</span>
  </span>
</template>

<style scoped>
.essence-amount {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3em;
  white-space: nowrap;
}

.essence-amount__glyph {
  color: var(--tier-gold);
  font-size: 0.85em;
  line-height: 1;
}

.essence-amount__value {
  font-family: var(--font-mono);
  font-weight: 600;
  color: inherit;
}
</style>
