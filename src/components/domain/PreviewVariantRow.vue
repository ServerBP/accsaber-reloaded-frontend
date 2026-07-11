<script setup lang="ts">
import type { ItemVariant } from '@/types/api/items'

defineProps<{ variants: ItemVariant[]; modelValue: string | null }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div v-if="variants.length" class="preview-variant-row">
    <button
      v-for="variant in variants"
      :key="variant.key"
      type="button"
      class="preview-variant-row__btn"
      :class="{ 'preview-variant-row__btn--active': modelValue === variant.key }"
      @click="$emit('update:modelValue', variant.key)"
    >
      {{ variant.label || variant.key }}
    </button>
  </div>
</template>

<style scoped>
.preview-variant-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.preview-variant-row__btn {
  padding: 3px var(--space-sm);
  background: var(--bg-surface);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-btn);
  color: var(--text-secondary);
  font-size: var(--text-caption);
  font-family: var(--font-sans);
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease;
}

.preview-variant-row__btn:hover {
  border-color: var(--text-tertiary);
  color: var(--text-primary);
}

.preview-variant-row__btn--active {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
