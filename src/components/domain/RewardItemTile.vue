<script setup lang="ts">
import ItemPreview from '@/components/domain/ItemPreview.vue'
import PublicCratePreview from '@/components/domain/PublicCratePreview.vue'
import VariantSplitPreview from '@/components/domain/VariantSplitPreview.vue'
import ItemPreviewModal from '@/components/domain/ItemPreviewModal.vue'
import type { ItemResponse } from '@/types/api/items'
import { itemVariantPreviews, rarityClass } from '@/utils/items'
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    item: ItemResponse
    size?: number
  }>(),
  { size: 56 },
)

const open = ref(false)

const isCrate = computed(() => props.item.typeKey === 'crate')
const isTitle = computed(() => props.item.typeKey === 'title')
const variants = computed(() => itemVariantPreviews(props.item))

const hoverTitle = computed(() => {
  let base = `${props.item.name} · ${props.item.typeKey.replace(/_/g, ' ')}`
  if (variants.value) base += ` · ${variants.value.length} variants`
  return `${base} (click to preview)`
})
</script>

<template>
  <button
    type="button"
    class="reward-tile"
    :class="[rarityClass(item.rarity), { 'reward-tile--wide': isTitle }]"
    :style="{ '--tile-size': `${size}px` }"
    :title="hoverTitle"
    :aria-label="isCrate ? `Preview crate: ${item.name}` : `Preview ${item.name}`"
    @click="open = true"
  >
    <VariantSplitPreview v-if="variants" :item="item" :variants="variants" />
    <ItemPreview v-else :item="item" />

    <span v-if="variants" class="reward-tile__variant-count" aria-hidden="true">{{ variants.length }}</span>

    <span class="reward-tile__view-hint" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
        stroke-linejoin="round">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    </span>

    <PublicCratePreview v-if="isCrate" :open="open" :crate="item" @close="open = false" />
    <ItemPreviewModal v-else :open="open" :item="item" @close="open = false" />
  </button>
</template>

<style scoped>
.reward-tile {
  --rarity-color: var(--text-tertiary);
  --cell-accent: var(--rarity-color);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--tile-size);
  height: var(--tile-size);
  padding: 0;
  flex-shrink: 0;
  background: var(--bg-base);
  border: 1px solid var(--rarity-color);
  border-radius: var(--radius-card);
  overflow: hidden;
  color: var(--text-secondary);
  cursor: pointer;
  transition: border-color 120ms ease, transform 120ms ease;
}

.reward-tile:hover {
  transform: translateY(-1px);
  border-color: var(--text-primary);
}

.reward-tile--wide {
  width: max-content;
  min-width: var(--tile-size);
  max-width: 280px;
  padding-inline: 10px;
}

.reward-tile--wide :deep(.item-preview__title),
.reward-tile--wide :deep(.title-renderer__text) {
  max-width: none;
  overflow: visible;
  text-overflow: clip;
}

.reward-tile.rarity--common { --rarity-color: var(--text-tertiary); }
.reward-tile.rarity--uncommon { --rarity-color: var(--success); }
.reward-tile.rarity--rare { --rarity-color: var(--info); }
.reward-tile.rarity--epic { --rarity-color: var(--tier-apex); }
.reward-tile.rarity--legendary { --rarity-color: var(--tier-gold); }
.reward-tile.rarity--mythic { --rarity-color: var(--error); }

.reward-tile__variant-count {
  position: absolute;
  top: 3px;
  right: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--bg-base) 70%, transparent);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 0.6rem;
  font-weight: 700;
  line-height: 1;
}

.reward-tile__view-hint {
  position: absolute;
  right: 3px;
  bottom: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--bg-base) 70%, transparent);
  color: var(--text-secondary);
  opacity: 0.75;
}

.reward-tile__view-hint svg {
  width: 10px;
  height: 10px;
}

@media (prefers-reduced-motion: reduce) {
  .reward-tile {
    transition: none;
  }

  .reward-tile:hover {
    transform: none;
  }
}
</style>
