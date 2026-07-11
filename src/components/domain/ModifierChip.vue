<script setup lang="ts">
import { useItemModifierStore } from '@/stores/itemModifiers'
import type { ItemModifierRef } from '@/types/api/items'
import { modifierAccentHex } from '@/utils/items'
import { computed, onMounted, useId } from 'vue'

const props = defineProps<{
  modifier: ItemModifierRef
}>()

const modifierStore = useItemModifierStore()

const color = computed(() => modifierAccentHex(props.modifier))

const description = computed(() => modifierStore.byKey.get(props.modifier.key)?.description ?? null)

const tipId = useId()

const chipStyle = computed(() =>
  color.value
    ? {
        color: color.value,
        borderColor: `color-mix(in srgb, ${color.value} 50%, transparent)`,
        background: `color-mix(in srgb, ${color.value} 10%, transparent)`,
      }
    : undefined,
)

onMounted(() => {
  modifierStore.fetchModifiers()
})
</script>

<template>
  <span class="modifier-chip">
    <span
      class="modifier-chip__pill"
      :class="{ 'modifier-chip__pill--described': description }"
      :style="chipStyle"
      :tabindex="description ? 0 : undefined"
      :aria-describedby="description ? tipId : undefined"
    >{{ modifier.name }}</span>
    <span v-if="description" :id="tipId" class="modifier-chip__tip" role="tooltip">
      {{ description }}
    </span>
  </span>
</template>

<style scoped>
.modifier-chip {
  position: relative;
  display: inline-flex;
}

.modifier-chip__pill {
  display: inline-flex;
  align-items: center;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--bg-overlay);
  background: var(--bg-base);
  color: var(--text-secondary);
}

.modifier-chip__pill--described {
  cursor: help;
}

.modifier-chip__pill--described:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
}

.modifier-chip__tip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translate(-50%, 4px);
  z-index: 40;
  width: max-content;
  max-width: 200px;
  padding: var(--space-xs) var(--space-sm);
  background: var(--bg-elevated);
  border: 1px solid var(--bg-overlay);
  border-radius: var(--radius-card);
  color: var(--text-secondary);
  font-size: var(--text-caption);
  font-weight: 400;
  letter-spacing: normal;
  line-height: 1.4;
  text-align: left;
  white-space: normal;
  pointer-events: none;
  opacity: 0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  transition: opacity 120ms ease, transform 120ms ease;
}

.modifier-chip__pill--described:hover + .modifier-chip__tip,
.modifier-chip__pill--described:focus-visible + .modifier-chip__tip {
  opacity: 1;
  transform: translate(-50%, 0);
}

@media (prefers-reduced-motion: reduce) {
  .modifier-chip__tip {
    transition: none;
  }
}
</style>
