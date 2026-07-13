<script setup lang="ts">
import ItemPreview from '@/components/domain/ItemPreview.vue'
import PublicCratePreview from '@/components/domain/PublicCratePreview.vue'
import VariantSplitPreview from '@/components/domain/VariantSplitPreview.vue'
import ItemPreviewModal from '@/components/domain/ItemPreviewModal.vue'
import type { ItemResponse } from '@/types/api/items'
import { itemVariantPreviews, rarityClass } from '@/utils/items'
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    item?: ItemResponse | null
    itemId?: string | null
    name?: string | null
    size?: number
  }>(),
  { item: null, itemId: null, name: null, size: 56 },
)

const itemCache = new Map<string, Promise<ItemResponse | null>>()

function loadItem(id: string): Promise<ItemResponse | null> {
  const cached = itemCache.get(id)
  if (cached) return cached
  const request = import('@/api/items')
    .then((m) => m.getItem(id))
    .catch(() => null)
  itemCache.set(id, request)
  return request
}

const fetched = ref<ItemResponse | null>(null)
const open = ref(false)

const resolved = computed(() => props.item ?? fetched.value)

watch(
  () => [props.item, props.itemId] as const,
  async ([inline, id]) => {
    if (inline) return
    fetched.value = null
    if (!id) return
    const result = await loadItem(id)
    if (props.itemId === id && !props.item) fetched.value = result
  },
  { immediate: true },
)

const isCrate = computed(() => resolved.value?.typeKey === 'crate')
const isTitle = computed(() => resolved.value?.typeKey === 'title')
const clickable = computed(() => resolved.value !== null)
const variants = computed(() => (resolved.value ? itemVariantPreviews(resolved.value) : null))
const displayName = computed(() => resolved.value?.name ?? props.name ?? 'Reward')
const initial = computed(() => displayName.value.charAt(0).toUpperCase())

const hoverTitle = computed(() => {
  const type = resolved.value ? resolved.value.typeKey.replace(/_/g, ' ') : null
  let base = type ? `${displayName.value} · ${type}` : displayName.value
  if (variants.value) base += ` · ${variants.value.length} variants`
  if (clickable.value) base += ' (click to preview)'
  return base
})
</script>

<template>
  <component
    :is="clickable ? 'button' : 'div'"
    :type="clickable ? 'button' : undefined"
    class="reward-tile"
    :class="[
      resolved ? rarityClass(resolved.rarity) : 'reward-tile--plain',
      { 'reward-tile--clickable': clickable, 'reward-tile--wide': isTitle },
    ]"
    :style="{ '--tile-size': `${size}px` }"
    :title="hoverTitle"
    :aria-label="isCrate ? `Preview crate: ${displayName}` : `Preview ${displayName}`"
    @click="clickable && (open = true)"
  >
    <VariantSplitPreview v-if="resolved && variants" :item="resolved" :variants="variants" />
    <ItemPreview v-else-if="resolved" :item="resolved" />
    <span v-else-if="name" class="reward-tile__initial">{{ initial }}</span>
    <svg v-else class="reward-tile__glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>

    <span v-if="variants" class="reward-tile__variant-count" aria-hidden="true">{{ variants.length }}</span>

    <span v-if="clickable" class="reward-tile__view-hint" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
        stroke-linejoin="round">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    </span>

    <PublicCratePreview v-if="isCrate" :open="open" :crate="resolved" @close="open = false" />
    <ItemPreviewModal v-else :open="open" :item="resolved" @close="open = false" />
  </component>
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

button.reward-tile {
  cursor: pointer;
  transition: border-color 120ms ease, transform 120ms ease;
}

.reward-tile--clickable:hover {
  transform: translateY(-1px);
  border-color: var(--text-primary);
}

.reward-tile.rarity--common { --rarity-color: var(--text-tertiary); }
.reward-tile.rarity--uncommon { --rarity-color: var(--success); }
.reward-tile.rarity--rare { --rarity-color: var(--info); }
.reward-tile.rarity--epic { --rarity-color: var(--tier-apex); }
.reward-tile.rarity--legendary { --rarity-color: var(--tier-gold); }
.reward-tile.rarity--mythic { --rarity-color: var(--error); }

.reward-tile__initial {
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: calc(var(--tile-size) * 0.4);
  color: var(--text-secondary);
}

.reward-tile__glyph {
  width: 45%;
  height: 45%;
  color: var(--text-tertiary);
}

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
</style>
