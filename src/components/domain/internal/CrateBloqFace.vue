<script setup lang="ts">
import ItemPreview from '@/components/domain/ItemPreview.vue'
import type { ItemModifierRef, ItemResponse } from '@/types/api/items'
import { displayItemName } from '@/utils/items'
import { computed } from 'vue'

const props = defineProps<{
  item: ItemResponse
  modifiers?: ItemModifierRef[]
  arrow?: boolean
}>()

const name = computed(() => displayItemName(props.modifiers, props.item.name))
</script>

<template>
  <div class="bloq">
    <div class="bloq__bevel" aria-hidden="true" />
    <svg
      v-if="arrow"
      class="bloq__arrow"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
    <div class="bloq__icon">
      <ItemPreview :item="item" selected />
    </div>
  </div>
  <div class="bloq-caption">
    <div class="bloq-caption__name">{{ name }}</div>
    <div class="bloq-caption__rarity">{{ item.rarity }}</div>
  </div>
</template>

<style scoped>
.bloq {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  flex-shrink: 0;
  border-radius: 8px;
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--rarity-color, var(--text-tertiary)) 26%, var(--bg-elevated)) 0%,
    color-mix(in srgb, var(--rarity-color, var(--text-tertiary)) 10%, var(--bg-surface)) 100%
  );
  border: 1px solid color-mix(in srgb, var(--rarity-color, var(--text-tertiary)) 40%, var(--bg-overlay));
  overflow: hidden;
}

.bloq__bevel {
  position: absolute;
  inset: 4px;
  border-radius: 5px;
  border-top: 2px solid color-mix(in srgb, var(--rarity-color, var(--text-tertiary)) 38%, transparent);
  border-left: 2px solid color-mix(in srgb, var(--rarity-color, var(--text-tertiary)) 30%, transparent);
  border-right: 2px solid color-mix(in srgb, var(--bg-base) 55%, transparent);
  border-bottom: 2px solid color-mix(in srgb, var(--bg-base) 65%, transparent);
  pointer-events: none;
}

.bloq__arrow {
  position: absolute;
  top: 5px;
  left: 50%;
  width: 18px;
  height: 18px;
  margin-left: -9px;
  color: var(--text-primary);
  animation: bloq-arrow-in 140ms ease-out backwards;
}

@keyframes bloq-arrow-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.bloq__icon {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 58%;
  height: 58%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.bloq-caption {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  width: 100%;
  padding-top: 4px;
  min-height: 0;
}

.bloq-caption__name {
  max-width: 100%;
  font-size: var(--text-caption);
  font-weight: 500;
  line-height: 1.15;
  color: var(--text-primary);
  text-align: center;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.bloq-caption__rarity {
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 600;
  color: var(--rarity-color, var(--text-tertiary));
}

@media (prefers-reduced-motion: reduce) {
  .bloq__arrow {
    animation: none;
  }
}
</style>
